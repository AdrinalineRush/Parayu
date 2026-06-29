#!/usr/bin/env python3
"""Report the training environment + a quick dataset summary as JSON.

Run with the project's venv python so the package checks reflect that env. Imports
are guarded so a missing package is reported, not fatal. Prints one line:
"__RESULT__ {json}". stdlib-only for the dataset scan.
"""
import sys, os, json, csv, wave, contextlib


def has(import_name):
    try:
        m = __import__(import_name)
        return True, getattr(m, "__version__", "")
    except Exception:
        return False, ""


def dataset_stats(project):
    meta = os.path.join(project, "data", "metadata.csv")
    stats = {"metadata_exists": os.path.exists(meta), "clips": 0, "valid_clips": 0, "duration_sec": 0.0}
    if not stats["metadata_exists"]:
        return stats
    with open(meta, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rel = (r.get("audio") or r.get("file") or "").strip()
            txt = (r.get("text") or "").strip()
            if not rel:
                continue
            stats["clips"] += 1
            path = os.path.join(project, rel)
            if not os.path.exists(path):
                alt_path = os.path.join(project, "data", rel)
                if os.path.exists(alt_path):
                    path = alt_path
            ok = bool(txt) and os.path.exists(path)
            if os.path.exists(path):
                try:
                    with contextlib.closing(wave.open(path, "rb")) as w:
                        ch, sr, sw = w.getnchannels(), w.getframerate(), w.getsampwidth()
                        stats["duration_sec"] += w.getnframes() / float(sr) if sr else 0.0
                        if not (ch == 1 and sr == 16000 and sw == 2):
                            ok = False
                except Exception:
                    ok = False
            else:
                ok = False
            if ok:
                stats["valid_clips"] += 1
    return stats


def main():
    project = os.getcwd()
    out = {"python_version": sys.version.split()[0]}

    torch_ok, torch_ver = has("torch")
    out["torch"] = torch_ok
    out["torch_version"] = torch_ver
    for name in ["transformers", "peft", "datasets", "librosa", "soundfile"]:
        ok, _ = has(name)
        out[name] = ok

    cuda = mps = False
    if torch_ok:
        try:
            import torch
            cuda = bool(torch.cuda.is_available())
            mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        except Exception:
            pass
    out["cuda_available"] = cuda
    out["mps_available"] = mps
    out["device"] = "cuda" if cuda else ("mps" if mps else "cpu")

    out["dataset"] = dataset_stats(project)
    print("__RESULT__ " + json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
