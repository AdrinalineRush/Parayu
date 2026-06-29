#!/usr/bin/env python3
"""LoRA fine-tune openai/whisper-small on the local dataset.

This never touches the app's ggml .bin. It trains a small LoRA adapter on the
Hugging Face base model and saves it to output/lora-adapter. Offline except for
the one-time base-model download (cached under .hf-cache). Run from the project
root. Streams training logs; prints a final "__RESULT__ {json}" line.

Built for large datasets (hours of clips, not a handful): audio is loaded
lazily per-example rather than all at once, training checkpoints periodically
and can resume after a crash, and a held-out validation split is used to catch
overfitting/collapse instead of trusting a single end-of-run number.
"""
import sys, os, csv, json, argparse, time, random
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
    metadata_count = 0
    valid_clips = []

    if os.path.exists(meta):
        with open(meta, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rel = (r.get("audio") or r.get("file") or "").strip()
                txt = (r.get("text") or "").strip()
                if rel:
                    metadata_count += 1
                    audio_path = os.path.join(project, rel)
                    if not os.path.exists(audio_path):
                        alt_path = os.path.join(project, "data", rel)
                        if os.path.exists(alt_path):
                            audio_path = alt_path
                    if os.path.exists(audio_path) and txt:
                        valid_clips.append({"audio": audio_path, "text": txt})
                    elif not os.path.exists(audio_path):
                        print(f"Warning: Audio file not found: {audio_path}", flush=True)

    valid_clip_count = len(valid_clips)
    selected_count = len(valid_clips)

    print(f"metadata_count = {metadata_count}", flush=True)
    print(f"valid_clip_count = {valid_clip_count}", flush=True)
    print(f"selected_count = {selected_count}", flush=True)
    print(f"scope = all_valid_clips", flush=True)

    return valid_clips


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Checking dataset"}', flush=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--language", default="en")
    ap.add_argument("--task", default="transcribe")
    # epochs=3/grad-accum=8 (effective batch 32) was tuned to avoid collapse on
    # a ~20-clip smoke-test set, where heavy gradient averaging mattered more
    # than update count. At tens-to-hundreds of clips that same effective
    # batch leaves only a handful of optimizer steps for the whole run (e.g.
    # ~75 clips / batch 4 / grad-accum 8 / 3 epochs ≈ 6 total updates) — far
    # too few to learn anything. Lower grad-accum and more epochs trades some
    # of that gradient smoothing for enough actual weight updates to learn.
    ap.add_argument("--epochs", type=float, default=12)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--grad-accum", type=int, default=2,
                     help="gradient accumulation steps; effective batch = batch * grad-accum")
    ap.add_argument("--encoder-lora", action="store_true",
                     help="also apply LoRA to encoder attention (default: decoder-only, safer on smaller datasets)")
    ap.add_argument("--val-fraction", type=float, default=0.05,
                     help="fraction of clips held out for validation (min 1 clip)")
    ap.add_argument("--save-steps", type=int, default=200)
    ap.add_argument("--eval-steps", type=int, default=200)
    ap.add_argument("--resume", action="store_true", help="resume from latest checkpoint in the run dir")
    ap.add_argument("--output", default=None, help="custom output path for adapter")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    project = os.getcwd()
    out_dir = args.output if args.output else os.path.join(project, "output", "lora-adapter")
    ckpt_dir = os.path.join(out_dir, "checkpoints")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(ckpt_dir, exist_ok=True)

    rows = load_rows(project)
    if not rows:
        log("No (audio,text) pairs with transcripts. Validate the dataset first.")
        return 1
    log("Training on %d clip(s). Base model: %s" % (len(rows), args.base))

    print('__PROGRESS__ {"percent": 5, "stage": "Checking dataset"}', flush=True)
    import torch, librosa
    from torch.utils.data import Dataset
    from transformers import (
        WhisperProcessor,
        WhisperForConditionalGeneration,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        TrainerCallback,
        EarlyStoppingCallback,
    )
    from peft import LoraConfig, get_peft_model

    device_note = "CPU"
    if torch.cuda.is_available():
        device_note = "CUDA GPU"
    elif torch.backends.mps.is_available():
        device_note = "Apple GPU (MPS)"
    log("Compute device: %s" % device_note)

    print('__PROGRESS__ {"percent": 10, "stage": "Loading processor"}', flush=True)
    processor = WhisperProcessor.from_pretrained(args.base, language=args.language, task=args.task)
    processor.tokenizer.set_prefix_tokens(language=args.language, task=args.task)

    # Split off a held-out validation set so we can catch overfitting/collapse
    # during training instead of finding out only at the end.
    rng = random.Random(args.seed)
    shuffled = rows[:]
    rng.shuffle(shuffled)
    val_count = max(1, int(len(shuffled) * args.val_fraction)) if len(shuffled) > 1 else 0
    val_rows = shuffled[:val_count]
    train_rows = shuffled[val_count:] if val_count else shuffled
    log("Train clips: %d, validation clips: %d" % (len(train_rows), len(val_rows)))

    class ClipDataset(Dataset):
        """Loads + extracts features per-example on access instead of all at
        once upfront, so multi-hour datasets don't have to fit in memory."""

        def __init__(self, rows):
            self.rows = rows

        def __len__(self):
            return len(self.rows)

        def __getitem__(self, idx):
            row = self.rows[idx]
            try:
                speech, _ = librosa.load(row["audio"], sr=16000, mono=True)
                feat = processor.feature_extractor(speech, sampling_rate=16000).input_features[0]
            except Exception as e:
                log(f"Warning: failed to load {row['audio']}: {e}; substituting silence")
                feat = processor.feature_extractor([0.0] * 16000, sampling_rate=16000).input_features[0]
            labels = processor.tokenizer(row["text"]).input_ids
            return {"input_features": feat, "labels": labels}

    train_dataset = ClipDataset(train_rows)
    eval_dataset = ClipDataset(val_rows) if val_rows else None

    from dataclasses import dataclass

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

    print('__PROGRESS__ {"percent": 20, "stage": "Loading model"}', flush=True)
    model = WhisperForConditionalGeneration.from_pretrained(args.base)
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    print('__PROGRESS__ {"percent": 30, "stage": "Initializing LoRA adapter"}', flush=True)
    # Decoder-only by default: with limited/noisy data, tuning the encoder's
    # attention can corrupt its pretrained audio representations. Pass
    # --encoder-lora to also adapt encoder attention once you have enough
    # clean data (tens of hours+) to justify it.
    if args.encoder_lora:
        target_modules = ["q_proj", "v_proj"]
    else:
        target_modules = r".*decoder.*\.(q_proj|v_proj)$"
    lconf = LoraConfig(
        r=16, lora_alpha=32, target_modules=target_modules,
        lora_dropout=0.05, bias="none",
    )
    model = get_peft_model(model, lconf)
    model.print_trainable_parameters()

    has_cuda = torch.cuda.is_available()

    targs_kwargs = dict(
        output_dir=ckpt_dir,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        num_train_epochs=args.epochs,
        logging_steps=10,
        save_total_limit=3,
        load_best_model_at_end=bool(eval_dataset),
        metric_for_best_model="eval_loss" if eval_dataset else None,
        greater_is_better=False,
        report_to=[],
        remove_unused_columns=False,
        label_names=["labels"],
        fp16=has_cuda,
        # 0, not >0: ClipDataset is a local class (defined inside main()), and
        # multiprocessing workers need to pickle the dataset to hand it to
        # worker subprocesses — pickling a function-local class always fails
        # on macOS's spawn start method, crashing the run before training starts.
        dataloader_num_workers=0,
    )
    # "evaluation_strategy" was renamed to "eval_strategy" in newer
    # transformers; support either depending on what's installed.
    strategy_key = "eval_strategy" if "eval_strategy" in Seq2SeqTrainingArguments.__init__.__code__.co_varnames else "evaluation_strategy"
    # Fixed eval_steps/save_steps (e.g. 200) silently never fire on small
    # datasets/grad-accum combos where the whole run is under that many total
    # steps — eval_loss never gets logged and load_best_model_at_end has
    # nothing to pick from. Evaluating/saving every epoch scales with the
    # run regardless of how few total steps it has.
    targs_kwargs[strategy_key] = "epoch" if eval_dataset else "no"
    targs_kwargs["save_strategy"] = "epoch" if eval_dataset else "steps"
    if not eval_dataset:
        targs_kwargs["save_steps"] = args.save_steps
    targs = Seq2SeqTrainingArguments(**targs_kwargs)

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
            eval_loss = None
            if state_cb.log_history:
                for log_entry in reversed(state_cb.log_history):
                    if loss is None and "loss" in log_entry:
                        loss = log_entry["loss"]
                    if eval_loss is None and "eval_loss" in log_entry:
                        eval_loss = log_entry["eval_loss"]
                    if loss is not None and eval_loss is not None:
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
            if eval_loss is not None:
                progress_data["eval_loss"] = round(eval_loss, 4)
            if eta is not None:
                progress_data["eta_seconds"] = int(eta)

            print("__PROGRESS__ " + json.dumps(progress_data), flush=True)

    callbacks = [ProgressCallback()]
    if eval_dataset:
        callbacks.append(EarlyStoppingCallback(early_stopping_patience=3))

    trainer = Seq2SeqTrainer(
        args=targs,
        model=model,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=Collator(processor),
        tokenizer=processor.feature_extractor,
        callbacks=callbacks,
    )

    print('__PROGRESS__ {"percent": 35, "stage": "Starting training"}', flush=True)

    resume_from = None
    if args.resume:
        existing = [d for d in os.listdir(ckpt_dir) if d.startswith("checkpoint-")] if os.path.isdir(ckpt_dir) else []
        if existing:
            existing.sort(key=lambda d: int(d.split("-")[-1]))
            resume_from = os.path.join(ckpt_dir, existing[-1])
            log("Resuming from checkpoint: %s" % resume_from)

    trainer.train(resume_from_checkpoint=resume_from)

    print('__PROGRESS__ {"percent": 90, "stage": "Saving LoRA adapter"}', flush=True)
    model.save_pretrained(out_dir)
    processor.save_pretrained(out_dir)
    log("\nSaved LoRA adapter to: %s" % out_dir)

    final_eval_loss = None
    if eval_dataset:
        metrics = trainer.evaluate()
        final_eval_loss = metrics.get("eval_loss")
        log("Final validation loss: %s" % final_eval_loss)

    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps({
        "adapter": out_dir,
        "clips": len(rows),
        "train_clips": len(train_rows),
        "val_clips": len(val_rows),
        "final_eval_loss": final_eval_loss,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
