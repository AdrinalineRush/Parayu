#!/usr/bin/env python3
"""Validate the Whisper fine-tuning dataset. Offline, stdlib-only.

Run from the project root (cwd = ~/Desktop/parayu-whisper-training). Reads
data/metadata.csv and checks every referenced clip. Prints a human log plus a
final machine-readable line: "__RESULT__ {json}".
"""
import sys, os, csv, json, wave, contextlib


def main():
    print('__PROGRESS__ {"percent": 0, "stage": "Checking metadata.csv"}', flush=True)
    project = os.getcwd()
    meta = os.path.join(project, "data", "metadata.csv")
    result = {
        "total_clips": 0,
        "total_duration_sec": 0.0,
        "missing_files": [],
        "wrong_format": [],
        "missing_transcripts": [],
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

    print('__PROGRESS__ {"percent": 33, "stage": "Checking audio files"}', flush=True)
    print('__PROGRESS__ {"percent": 66, "stage": "Checking format"}', flush=True)
    for r in rows:
        rel = (r.get("audio") or "").strip()
        text = (r.get("text") or "").strip()
        path = os.path.join(project, rel)

        if not rel or not os.path.exists(path):
            result["missing_files"].append(rel or "(blank)")
            print("MISSING FILE:      %s" % (rel or "(blank)"))
            continue

        if not text:
            result["missing_transcripts"].append(rel)
            print("MISSING TRANSCRIPT: %s" % rel)

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
    )

    mins = int(result["total_duration_sec"] // 60)
    secs = int(result["total_duration_sec"] % 60)
    print("\n----------------------------------------")
    print("Total clips:         %d" % result["total_clips"])
    print("Total duration:      %d:%02d" % (mins, secs))
    print("Missing files:       %d" % len(result["missing_files"]))
    print("Wrong format:        %d" % len(result["wrong_format"]))
    print("Missing transcripts: %d" % len(result["missing_transcripts"]))
    print("VALIDATION:          %s" % ("PASS" if result["ok"] else "FAIL"))
    print('__PROGRESS__ {"percent": 100, "stage": "Complete"}', flush=True)
    print("__RESULT__ " + json.dumps(result))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
