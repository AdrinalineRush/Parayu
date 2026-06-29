#!/usr/bin/env python3
"""Transcribe one clip and compare against its expected transcript.

Used both for "Test Base Model" (openai/whisper-small) and "Test Trained Model"
(base + LoRA adapter, or a merged model dir). Audio never leaves this machine;
only the base model weights are fetched once (cached under .hf-cache).

Run from the project root. Prints a final "__RESULT__ {json}" line.
"""
import sys, os, csv, json, argparse

# Monkey-patch tqdm to catch base model downloads and emit structured progress
try:
    import tqdm
    class CustomTqdm(tqdm.tqdm):
        def __init__(self, *args, **kwargs):
            self.desc_name = kwargs.get("desc", "Downloading")
            super().__init__(*args, **kwargs)
            self._emit_progress()

        def update(self, n=1):
            super().update(n)
            self._emit_progress()

        def _emit_progress(self):
            if self.total:
                percent = int((self.n / self.total) * 100)
                percent = min(max(percent, 0), 100)
                progress_data = {
                    "percent": percent,
                    "stage": self.desc_name or "Downloading"
                }
                print("__PROGRESS__ " + json.dumps(progress_data), flush=True)

    tqdm.tqdm = CustomTqdm
    try:
        import tqdm.std as tqdm_std
        tqdm_std.tqdm = CustomTqdm
    except ImportError:
        pass
    try:
        import tqdm.auto as tqdm_auto
        tqdm_auto.tqdm = CustomTqdm
    except ImportError:
        pass
except ImportError:
    pass


def log(*a):
    print(*a, flush=True)


def first_clip(project):
    meta = os.path.join(project, "data", "metadata.csv")
    if not os.path.exists(meta):
        return None, ""
    with open(meta, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rel = (r.get("audio") or r.get("file") or "").strip()
            if rel:
                # Resolve path
                audio_path = os.path.join(project, rel)
                if not os.path.exists(audio_path):
                    alt_path = os.path.join(project, "data", rel)
                    if os.path.exists(alt_path):
                        rel = os.path.join("data", rel)
                return rel, (r.get("text") or "").strip()
    return None, ""


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Starting"}', flush=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--adapter", default=None, help="LoRA adapter dir (base + adapter)")
    ap.add_argument("--model", default=None, help="full/merged model dir to load instead of base")
    ap.add_argument("--language", default="en")
    ap.add_argument("--task", default="transcribe")
    args = ap.parse_args()
    project = os.getcwd()

    metadata_count = 0
    valid_clips = []
    meta = os.path.join(project, "data", "metadata.csv")
    if os.path.exists(meta):
        with open(meta, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rel_path = (r.get("audio") or r.get("file") or "").strip()
                text = (r.get("text") or "").strip()
                if rel_path:
                    metadata_count += 1
                    audio_path = os.path.join(project, rel_path)
                    if not os.path.exists(audio_path):
                        alt_path = os.path.join(project, "data", rel_path)
                        if os.path.exists(alt_path):
                            audio_path = alt_path
                            rel_path = os.path.join("data", rel_path)
                    if os.path.exists(audio_path):
                        valid_clips.append((rel_path, text))
                    else:
                        log(f"Warning: Audio file not found: {audio_path}")

    selected = valid_clips
    valid_clip_count = len(valid_clips)
    selected_count = len(selected)

    log(f"metadata_count = {metadata_count}")
    log(f"valid_clip_count = {valid_clip_count}")
    log(f"selected_count = {selected_count}")
    log(f"scope = all_valid_clips")

    if not selected:
        log("No valid audio clips found to test.")
        print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
        return 1

    print('__PROGRESS__ {"percent": 10, "stage": "Starting"}', flush=True)
    import torch, librosa
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    from transformers import WhisperProcessor, WhisperForConditionalGeneration

    src = args.model or args.base
    log("Loading model:", src)
    print('__PROGRESS__ {"percent": 15, "stage": "Loading model"}', flush=True)
    processor = WhisperProcessor.from_pretrained(args.base)
    processor.tokenizer.set_prefix_tokens(language=args.language, task=args.task)
    model = WhisperForConditionalGeneration.from_pretrained(src)
    if args.adapter:
        from peft import PeftModel
        log("Applying LoRA adapter:", args.adapter)
        model = PeftModel.from_pretrained(model, args.adapter)
    model.eval()

    results = []
    total = len(selected)
    for idx, (rel_path, expected) in enumerate(selected):
        current_num = idx + 1
        pct = int((current_num / total) * 100)
        print(f'__PROGRESS__ {{"percent": {pct}, "stage": "Testing clip {current_num}/{total}"}}', flush=True)

        audio_path = rel_path if os.path.isabs(rel_path) else os.path.join(project, rel_path)
        if not os.path.exists(audio_path):
            log(f"Audio file not found: {audio_path}")
            results.append({"audio": rel_path, "expected": expected, "output": "[File missing]", "error": "File missing"})
            continue

        try:
            speech, _ = librosa.load(audio_path, sr=16000, mono=True)
            inputs = processor(speech, sampling_rate=16000, return_tensors="pt")
            forced = processor.get_decoder_prompt_ids(language=args.language, task=args.task)
            
            # Suppress all special tokens (except EOS) to block control/timestamp token loops
            eos_id = processor.tokenizer.eos_token_id
            suppressed_special = list(processor.tokenizer.all_special_ids)
            if eos_id in suppressed_special:
                suppressed_special.remove(eos_id)
                
            with torch.no_grad():
                ids = model.generate(
                    inputs.input_features, 
                    forced_decoder_ids=forced, 
                    max_new_tokens=100,
                    no_repeat_ngram_size=4,
                    suppress_tokens=suppressed_special
                )
            text = processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
            results.append({"audio": rel_path, "expected": expected, "output": text})
            log(f"Tested [{rel_path}]: expected='{expected}', output='{text}'")
        except Exception as e:
            log(f"Failed to transcribe [{rel_path}]: {e}")
            results.append({"audio": rel_path, "expected": expected, "output": f"[Error: {e}]", "error": str(e)})

    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps({"clips": results}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
