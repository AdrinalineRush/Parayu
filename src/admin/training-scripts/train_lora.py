#!/usr/bin/env python3
"""LoRA fine-tune openai/whisper-small on the local dataset.

This never touches the app's ggml .bin. It trains a small LoRA adapter on the
Hugging Face base model and saves it to output/lora-adapter. Offline except for
the one-time base-model download (cached under .hf-cache). Run from the project
root. Streams training logs; prints a final "__RESULT__ {json}" line.
"""
import sys, os, csv, json, argparse, time
from dataclasses import dataclass
from typing import Any, List, Dict

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


def load_rows(project):
    meta = os.path.join(project, "data", "metadata.csv")
    rows = []
    with open(meta, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rel = (r.get("audio") or "").strip()
            txt = (r.get("text") or "").strip()
            if rel and txt:
                rows.append({"audio": os.path.join(project, rel), "text": txt})
    return rows


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Checking dataset"}', flush=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--language", default="en")
    ap.add_argument("--epochs", type=float, default=10)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--batch", type=int, default=1)
    args = ap.parse_args()
    project = os.getcwd()
    out_dir = os.path.join(project, "output", "lora-adapter")
    os.makedirs(out_dir, exist_ok=True)

    rows = load_rows(project)
    if not rows:
        log("No (audio,text) pairs with transcripts. Validate the dataset first.")
        return 1
    log("Training on %d clip(s). Base model: %s" % (len(rows), args.base))

    print('__PROGRESS__ {"percent": 5, "stage": "Checking dataset"}', flush=True)
    import torch, librosa
    from transformers import (
        WhisperProcessor,
        WhisperForConditionalGeneration,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        TrainerCallback,
    )
    from peft import LoraConfig, get_peft_model

    device_note = "CPU"
    if torch.cuda.is_available():
        device_note = "CUDA GPU"
    elif torch.backends.mps.is_available():
        device_note = "Apple GPU (MPS)"
    log("Compute device: %s" % device_note)

    print('__PROGRESS__ {"percent": 10, "stage": "Loading processor"}', flush=True)
    processor = WhisperProcessor.from_pretrained(args.base, language=args.language, task="transcribe")

    def prepare(row):
        speech, _ = librosa.load(row["audio"], sr=16000, mono=True)
        feat = processor.feature_extractor(speech, sampling_rate=16000).input_features[0]
        labels = processor.tokenizer(row["text"]).input_ids
        return {"input_features": feat, "labels": labels}

    print('__PROGRESS__ {"percent": 20, "stage": "Extracting audio features"}', flush=True)
    data = [prepare(r) for r in rows]

    @dataclass
    class Collator:
        processor: Any

        def __call__(self, features: List[Dict[str, Any]]):
            input_features = [{"input_features": f["input_features"]} for f in features]
            batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
            label_features = [{"input_ids": f["labels"]} for f in features]
            labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
            labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
            if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]
            batch["labels"] = labels
            return batch

    print('__PROGRESS__ {"percent": 40, "stage": "Loading model"}', flush=True)
    model = WhisperForConditionalGeneration.from_pretrained(args.base)
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    print('__PROGRESS__ {"percent": 70, "stage": "Initializing LoRA adapter"}', flush=True)
    lconf = LoraConfig(
        r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05, bias="none",
    )
    model = get_peft_model(model, lconf)
    model.print_trainable_parameters()

    targs = Seq2SeqTrainingArguments(
        output_dir=os.path.join(project, "output", "lora-checkpoints"),
        per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=1,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        logging_steps=1,
        save_strategy="no",
        report_to=[],
        remove_unused_columns=False,
        label_names=["labels"],
    )

    class ProgressCallback(TrainerCallback):
        def __init__(self):
            self.start_time = None

        def on_train_begin(self, args_cb, state_cb, control_cb, **kwargs):
            self.start_time = time.time()

        def on_step_end(self, args_cb, state_cb, control_cb, **kwargs):
            if self.start_time is None:
                self.start_time = time.time()

            percent = 0
            if state_cb.max_steps > 0:
                percent = int((state_cb.global_step / state_cb.max_steps) * 100)
                percent = min(percent, 99)

            num_epochs = args_cb.num_train_epochs
            current_epoch = int(state_cb.epoch) + 1 if state_cb.epoch < num_epochs else int(num_epochs)

            loss = None
            if state_cb.log_history:
                for log_entry in reversed(state_cb.log_history):
                    if "loss" in log_entry:
                        loss = log_entry["loss"]
                        break

            eta = None
            if state_cb.global_step > 0:
                elapsed = time.time() - self.start_time
                steps_left = state_cb.max_steps - state_cb.global_step
                eta = (elapsed / state_cb.global_step) * steps_left

            progress_data = {
                "action": "training",
                "percent": percent,
                "stage": f"Epoch {current_epoch}/{int(num_epochs)}",
                "step": state_cb.global_step,
                "total_steps": state_cb.max_steps,
            }
            if loss is not None:
                progress_data["loss"] = round(loss, 4)
            if eta is not None:
                progress_data["eta_seconds"] = int(eta)

            print("__PROGRESS__ " + json.dumps(progress_data), flush=True)

    trainer = Seq2SeqTrainer(
        args=targs,
        model=model,
        train_dataset=data,
        data_collator=Collator(processor),
        tokenizer=processor.feature_extractor,
        callbacks=[ProgressCallback()],
    )

    print('__PROGRESS__ {"percent": 80, "stage": "Starting training"}', flush=True)
    trainer.train()

    print('__PROGRESS__ {"percent": 90, "stage": "Saving LoRA adapter"}', flush=True)
    model.save_pretrained(out_dir)
    processor.save_pretrained(out_dir)
    log("\nSaved LoRA adapter to: %s" % out_dir)
    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps({"adapter": out_dir, "clips": len(rows)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
