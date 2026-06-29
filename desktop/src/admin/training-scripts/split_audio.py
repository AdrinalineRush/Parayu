#!/usr/bin/env python3
import os
import sys
import wave
import struct
import math
import argparse
import json

# Window size used to scan for a quiet moment to cut on. Short enough to find
# brief gaps between words, long enough to average out sample-level noise.
ANALYSIS_WINDOW_SEC = 0.02


def frame_rms(samples):
    if not samples:
        return 0.0
    return math.sqrt(sum(float(s) ** 2 for s in samples) / len(samples))


def find_cut_offset(all_samples, target_frame, framerate, tolerance_sec, search_start, max_frame):
    """Search [target_frame - tolerance, target_frame + tolerance] for the
    quietest short window, so the cut lands in a gap between words/sentences
    instead of mid-word. search_start bounds the search so cuts never move
    backwards past the previous cut; max_frame caps how far forward a cut can
    move so a clip never exceeds Whisper's 30s hard limit regardless of the
    requested clip length. Returns a frame offset."""
    tolerance_frames = int(tolerance_sec * framerate)
    window_frames = max(1, int(ANALYSIS_WINDOW_SEC * framerate))

    lo = max(search_start, target_frame - tolerance_frames)
    hi = min(len(all_samples), max_frame, target_frame + tolerance_frames)
    if lo >= hi:
        return min(target_frame, max_frame, len(all_samples))

    best_offset = target_frame
    best_rms = None
    pos = lo
    while pos < hi:
        window = all_samples[pos:pos + window_frames]
        rms = frame_rms(window)
        if best_rms is None or rms < best_rms:
            best_rms = rms
            best_offset = pos
        pos += window_frames

    return best_offset


def split_wav(input_path, output_dir, clip_seconds, skip_silence, silence_threshold=100,
              boundary_tolerance=3.0, smart_boundary=True):
    if not os.path.exists(input_path):
        print(json.dumps({"error": f"Input file {input_path} does not exist."}))
        return 0

    os.makedirs(output_dir, exist_ok=True)

    for f in os.listdir(output_dir):
        if f.startswith("clip_") and f.endswith(".wav"):
            try:
                os.unlink(os.path.join(output_dir, f))
            except Exception:
                pass

    with wave.open(input_path, 'rb') as w:
        params = w.getparams()
        nchannels, sampwidth, framerate, nframes, comptype, compname = params
        raw = w.readframes(nframes)

    if sampwidth != 2:
        print(json.dumps({"error": "Smart boundary detection requires 16-bit audio."}))
        return 0

    # Per-frame samples, averaged across channels, for boundary scanning only
    # (the actual clip writes below use the original interleaved raw bytes).
    num_frames_total = len(raw) // (2 * nchannels)
    all_vals = struct.unpack(f"<{num_frames_total * nchannels}h", raw[:num_frames_total * nchannels * 2])
    if nchannels > 1:
        mono = [sum(all_vals[i:i + nchannels]) / nchannels for i in range(0, len(all_vals), nchannels)]
    else:
        mono = list(all_vals)

    frames_per_clip = int(clip_seconds * framerate)
    bytes_per_frame = nchannels * sampwidth

    # Compute cut points (in frames) up front, each snapped near its target.
    # max_frame caps every clip at 30s from its own start, regardless of
    # --seconds or tolerance, since Whisper truncates anything longer anyway.
    hard_cap_frames = int(30.0 * framerate)
    cuts = [0]
    cursor = 0
    while cursor + int(0.5 * framerate) < num_frames_total:
        target = cursor + frames_per_clip
        if target >= num_frames_total:
            break
        max_frame = cursor + hard_cap_frames
        if smart_boundary:
            cut = find_cut_offset(mono, target, framerate, boundary_tolerance,
                                   search_start=cursor + int(0.5 * framerate), max_frame=max_frame)
        else:
            cut = min(target, max_frame)
        cuts.append(cut)
        cursor = cut
    cuts.append(num_frames_total)

    clip_idx = 1
    created_count = 0
    created_clips = []
    for i in range(len(cuts) - 1):
        start_frame, end_frame = cuts[i], cuts[i + 1]
        actual_frames = end_frame - start_frame
        if actual_frames < int(0.5 * framerate):
            continue

        start_byte = start_frame * bytes_per_frame
        end_byte = end_frame * bytes_per_frame
        frames = raw[start_byte:end_byte]

        if skip_silence:
            num_samples = len(frames) // 2
            if num_samples > 0:
                samples = struct.unpack(f"<{num_samples}h", frames[:num_samples * 2])
                rms = frame_rms(samples)
            else:
                rms = 0
            if rms < silence_threshold:
                print(f"Skipping silent clip: clip_{clip_idx:04d}.wav (RMS: {rms:.2f})", flush=True)
                clip_idx += 1
                continue

        out_filename = f"clip_{clip_idx:04d}.wav"
        out_path = os.path.join(output_dir, out_filename)
        with wave.open(out_path, 'wb') as out_w:
            out_w.setparams((nchannels, sampwidth, framerate, actual_frames, comptype, compname))
            out_w.writeframes(frames)

        created_clips.append({
            "filename": out_filename,
            "start": float(start_frame) / framerate,
            "end": float(end_frame) / framerate
        })

        created_count += 1
        clip_idx += 1

        progress_pct = int((end_frame / num_frames_total) * 100) if num_frames_total > 0 else 100
        progress_pct = min(max(progress_pct, 0), 100)
        print(f"__PROGRESS__ {progress_pct}", flush=True)

    print(json.dumps({"success": True, "count": created_count, "clips": created_clips}))
    return created_count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--seconds", type=float, default=20.0)
    ap.add_argument("--skip-silence", action="store_true")
    ap.add_argument("--threshold", type=int, default=100)
    ap.add_argument("--boundary-tolerance", type=float, default=3.0,
                     help="seconds to search around each cut point for a quiet gap")
    ap.add_argument("--no-smart-boundary", action="store_true",
                     help="disable silence-snapping and cut at exact fixed intervals")
    args = ap.parse_args()
    if args.seconds > 30.0:
        print(f"--seconds capped at 30 (Whisper truncates longer clips anyway); was {args.seconds}", flush=True)
        args.seconds = 30.0

    split_wav(args.input, args.output_dir, args.seconds, args.skip_silence, args.threshold,
               boundary_tolerance=args.boundary_tolerance, smart_boundary=not args.no_smart_boundary)


if __name__ == "__main__":
    main()
