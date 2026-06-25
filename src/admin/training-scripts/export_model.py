#!/usr/bin/env python3
"""Merge the LoRA adapter into the base model and export a Hugging Face model.

Writes output/merged-model (safetensors). Does NOT overwrite the app's ggml .bin
and does NOT convert to ggml automatically — that final step needs whisper.cpp
tooling, and the exact commands are printed at the end. Run from project root.
"""
import sys, os, json, argparse

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


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Preparing adapter"}', flush=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--adapter", default=None)
    args = ap.parse_args()
    project = os.getcwd()
    adapter = args.adapter or os.path.join(project, "output", "lora-adapter")
    out = os.path.join(project, "output", "merged-model")

    if not os.path.exists(adapter):
        log("No LoRA adapter at:", adapter)
        log("Run 'Start LoRA Training' first.")
        print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
        return 1
    os.makedirs(out, exist_ok=True)

    print('__PROGRESS__ {"percent": 20, "stage": "Preparing adapter"}', flush=True)
    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    from peft import PeftModel

    log("Loading base model:", args.base)
    print('__PROGRESS__ {"percent": 25, "stage": "Preparing adapter"}', flush=True)
    base = WhisperForConditionalGeneration.from_pretrained(args.base)
    log("Loading LoRA adapter:", adapter)
    print('__PROGRESS__ {"percent": 40, "stage": "Preparing adapter"}', flush=True)
    merged = PeftModel.from_pretrained(base, adapter)
    log("Merging LoRA weights into the base model…")
    print('__PROGRESS__ {"percent": 50, "stage": "Merging LoRA"}', flush=True)
    merged = merged.merge_and_unload()
    print('__PROGRESS__ {"percent": 75, "stage": "Saving merged Hugging Face model"}', flush=True)
    merged.save_pretrained(out)
    WhisperProcessor.from_pretrained(args.base).save_pretrained(out)

    print('__PROGRESS__ {"percent": 90, "stage": "Verifying output"}', flush=True)
    log("\nMerged Hugging Face model saved to: %s" % out)
    log("")
    log("NOTE: the Parayu app loads whisper.cpp ggml format (.bin), not this HF model.")
    log("To produce ggml-small-q5_1.bin for 'Replace App Model', convert with whisper.cpp:")
    log("  python <whisper.cpp>/models/convert-h5-to-ggml.py %s <whisper.cpp> %s" % (out, os.path.join(project, "output")))
    log("  <whisper.cpp>/quantize %s %s q5_1" % (
        os.path.join(project, "output", "ggml-model.bin"),
        os.path.join(project, "output", "ggml-small-q5_1.bin"),
    ))
    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps({"merged": out}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
