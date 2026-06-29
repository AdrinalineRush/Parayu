#!/usr/bin/env python3
"""Validate the Whisper fine-tuning dataset. Offline, stdlib-only.

Run from the project root (cwd = ~/Desktop/parayu-whisper-training). Reads
data/metadata.csv and checks every referenced clip. Prints a human log plus a
final machine-readable line: "__RESULT__ {json}".
"""
import sys, os, csv, json, wave, contextlib, argparse


def is_malayalam_script(text):
    return any("ഀ" <= ch <= "ൿ" for ch in text)


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Checking metadata.csv"}', flush=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", default=None,
                     help="expected audio language tag (e.g. ml, en); used to sanity-check transcript script")
    ap.add_argument("--task", default=None,
                     help="transcribe (output in --language's script) or translate (output always English)")
    args = ap.parse_args()
    project = os.getcwd()
    meta = os.path.join(project, "data", "metadata.csv")
    result = {
        "total_clips": 0,
        "total_duration_sec": 0.0,
        "missing_files": [],
        "wrong_format": [],
        "missing_transcripts": [],
        "script_mismatch": [],
        "ok": False,
    }

    if not os.path.exists(meta):
        print("metadata.csv not found at:", meta)
        print("__RESULT__ " + json.dumps(result))
        print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
        return 1

    rows = []
    with open(meta, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    result["total_clips"] = len(rows)
    print("Found %d row(s) in data/metadata.csv\n" % len(rows))

    metadata_count = len(rows)
    valid_clips = []
    for r in rows:
        rel = (r.get("audio") or r.get("file") or "").strip()
        path = os.path.join(project, rel)
        if not os.path.exists(path):
            alt_path = os.path.join(project, "data", rel)
            if os.path.exists(alt_path):
                path = alt_path
        if rel and os.path.exists(path):
            valid_clips.append(r)
    valid_clip_count = len(valid_clips)
    selected_count = len(rows)

    print(f"metadata_count = {metadata_count}", flush=True)
    print(f"valid_clip_count = {valid_clip_count}", flush=True)
    print(f"selected_count = {selected_count}", flush=True)
    print(f"scope = all_valid_clips", flush=True)

    # task=translate always outputs English (Latin script) regardless of the
    # spoken language; task=transcribe outputs in --language's native script.
    expect_malayalam_script = None
    if args.task == "translate":
        expect_malayalam_script = False
    elif args.task == "transcribe" and args.language:
        expect_malayalam_script = (args.language == "ml")

    print('__PROGRESS__ {"percent": 33, "stage": "Checking audio files"}', flush=True)
    print('__PROGRESS__ {"percent": 66, "stage": "Checking format"}', flush=True)
    for r in rows:
        rel = (r.get("audio") or r.get("file") or "").strip()
        text = (r.get("text") or "").strip()
        path = os.path.join(project, rel)
        if not os.path.exists(path):
            alt_path = os.path.join(project, "data", rel)
            if os.path.exists(alt_path):
                path = alt_path

        if not rel or not os.path.exists(path):
            result["missing_files"].append(rel or "(blank)")
            print("MISSING FILE:      %s" % (rel or "(blank)"))
            continue

        if not text:
            result["missing_transcripts"].append(rel)
            print("MISSING TRANSCRIPT: %s" % rel)
        elif expect_malayalam_script is not None:
            # Whisper's --language flag sets the OUTPUT script for transcribe,
            # not just the spoken language. A romanized/Manglish transcript
            # paired with language=ml (or a Malayalam-script transcript paired
            # with translate, which always outputs English) silently trains
            # the model against contradictory labels — this caught the exact
            # bug that produced a 9% trained-model collapse earlier.
            has_ml = is_malayalam_script(text)
            if has_ml != expect_malayalam_script:
                result["script_mismatch"].append(rel)
                print("SCRIPT MISMATCH:    %s  (transcript script doesn't match --language/--task)" % rel)

        try:
            with contextlib.closing(wave.open(path, "rb")) as w:
                ch, sr, sw = w.getnchannels(), w.getframerate(), w.getsampwidth()
                dur = w.getnframes() / float(sr) if sr else 0.0
                result["total_duration_sec"] += dur
                issues = []
                if ch != 1:
                    issues.append("%dch" % ch)
                if sr != 16000:
                    issues.append("%dHz" % sr)
                if sw != 2:
                    issues.append("%dbit" % (sw * 8))
                if issues:
                    result["wrong_format"].append({"audio": rel, "issues": issues})
                    print("WRONG FORMAT:      %s  (%s)" % (rel, ", ".join(issues)))
                else:
                    print("OK:                %s  %.1fs" % (rel, dur))
        except Exception as e:
            result["wrong_format"].append({"audio": rel, "issues": ["unreadable WAV: %s" % e]})
            print("WRONG FORMAT:      %s  (%s)" % (rel, e))

    result["ok"] = (
        result["total_clips"] > 0
        and not result["missing_files"]
        and not result["wrong_format"]
        and not result["missing_transcripts"]
        and not result["script_mismatch"]
    )

    mins = int(result["total_duration_sec"] // 60)
    secs = int(result["total_duration_sec"] % 60)
    print("\n----------------------------------------")
    print("Total clips:         %d" % result["total_clips"])
    print("Total duration:      %d:%02d" % (mins, secs))
    print("Missing files:       %d" % len(result["missing_files"]))
    print("Wrong format:        %d" % len(result["wrong_format"]))
    print("Missing transcripts: %d" % len(result["missing_transcripts"]))
    if expect_malayalam_script is not None:
        print("Script mismatches:   %d  (--language %s --task %s expects %s transcripts)" % (
            len(result["script_mismatch"]), args.language, args.task,
            "Malayalam-script" if expect_malayalam_script else "Latin-script"))
    print("VALIDATION:          %s" % ("PASS" if result["ok"] else "FAIL"))
    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps(result))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
