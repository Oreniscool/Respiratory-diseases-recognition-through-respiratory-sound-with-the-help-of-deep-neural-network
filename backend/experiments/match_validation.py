"""Validate the cross-correlation copy detector (cross_dataset_overlap.py) used for the dataset audit.

1. **Recall on synthetic cuts** (``synthetic``): random segments of ICBHI recordings, degraded the way a
   re-upload might be (resampling to 4/8/22.05/44.1 kHz, gain 0.3–1.5, white noise at 20–40 dB SNR,
   and in half the cases a 100–2,000 Hz band-pass), are matched against all ICBHI recordings with the
   production threshold. Recall = share matched to their true source recording; the score distribution
   is saved. The false-positive side is covered by real data: 0 of 336 KAUH recordings match ICBHI
   (``data/kauh_icbhi_overlap.csv``).
2. **Blind listening set** (``listening``): N matched Kaggle clips (lowest-scoring matches first, where
   errors would be) and N closest non-matches, each paired with the reference segment at the best
   offset, written as shuffled WAV pairs plus an answer sheet; the key is stored separately.

Usage (from ``backend/``)::

    python -m experiments.match_validation synthetic --cuts 100
    python -m experiments.match_validation listening --pairs 10
"""

from __future__ import annotations

import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np

OUTPUT_DIR = Path("artifacts/experiments/match_validation")
ICBHI_DIR = Path("dataset/ICBHI_final_dataset")
KAGGLE_DIR = Path("dataset/Asthma_Detection_V2/Asthma Detection Dataset Version 2/Asthma Detection Dataset Version 2")


def degrade(waveform: np.ndarray, sample_rate: int, rng: np.random.Generator) -> tuple[np.ndarray, int, dict]:
    """A random cut of the recording, re-encoded with random resampling, gain, noise and filtering."""
    import librosa
    from scipy.signal import butter, sosfiltfilt

    seconds = float(rng.uniform(3.0, 8.0))
    length = min(len(waveform), int(seconds * sample_rate))
    start = int(rng.integers(0, max(1, len(waveform) - length)))
    cut = waveform[start:start + length]
    target_rate = int(rng.choice([4_000, 8_000, 22_050, 44_100]))
    cut = librosa.resample(cut, orig_sr=sample_rate, target_sr=target_rate)
    bandpass = bool(rng.random() < 0.5)
    if bandpass:
        high = min(2_000.0, 0.45 * target_rate)
        cut = sosfiltfilt(butter(4, [100.0, high], btype="bandpass", fs=target_rate, output="sos"), cut)
    gain = float(rng.uniform(0.3, 1.5))
    snr_db = float(rng.uniform(20.0, 40.0))
    power = float(np.mean(cut ** 2)) + 1e-12
    cut = gain * (cut + rng.standard_normal(len(cut)) * np.sqrt(power / 10 ** (snr_db / 10)))
    cut = np.clip(cut / max(1.0, float(np.abs(cut).max()) / 0.99), -1.0, 1.0)
    return cut.astype(np.float32), target_rate, {
        "start_seconds": round(start / sample_rate, 3), "seconds": round(length / sample_rate, 3),
        "rate": target_rate, "bandpass": bandpass, "gain": round(gain, 3), "snr_db": round(snr_db, 1),
    }


def synthetic(cuts: int, workers: int, seed: int = 0) -> dict[str, object]:
    import librosa
    import soundfile as sf

    from cross_dataset_overlap import DEFAULT_THRESHOLD, find_overlaps

    rng = np.random.default_rng(seed)
    references = sorted(str(p) for p in ICBHI_DIR.glob("*.wav"))
    chosen = rng.choice(len(references), size=cuts, replace=False)
    clip_dir = OUTPUT_DIR / "synthetic_clips" / "copd"  # the matcher reads the class from the folder
    clip_dir.mkdir(parents=True, exist_ok=True)
    truth = {}
    for index, ref_index in enumerate(chosen):
        source = references[ref_index]
        waveform, rate = librosa.load(source, sr=None, mono=True)
        cut, cut_rate, params = degrade(waveform, rate, rng)
        name = f"synthetic_{index:03d}.wav"
        sf.write(clip_dir / name, cut, cut_rate, subtype="PCM_16")
        truth[name] = {"source": Path(source).name, **params}
    rows = find_overlaps(sorted(str(p) for p in clip_dir.glob("*.wav")), references,
                         threshold=DEFAULT_THRESHOLD, workers=workers, clip_root=clip_dir.parent)
    detected = correct = 0
    records = []
    for row in rows:
        name = Path(row["clip"]).name
        right = row["reference"] == truth[name]["source"]
        detected += bool(row["is_overlap"])
        correct += bool(row["is_overlap"]) and right
        records.append({**truth[name], "clip": name, "best_ncc": row["best_ncc"], "best_reference": row["reference"],
                        "is_overlap": bool(row["is_overlap"]), "correct_source": right})
    scores = np.asarray([r["best_ncc"] for r in records])
    summary = {
        "cuts": cuts, "threshold": DEFAULT_THRESHOLD,
        "recall_correct_source": correct / cuts, "detected_any": detected / cuts,
        "ncc_min": float(scores.min()), "ncc_p05": float(np.percentile(scores, 5)), "ncc_median": float(np.median(scores)),
        "recall_by_rate": {str(rate): float(np.mean([r["is_overlap"] and r["correct_source"] for r in records if r["rate"] == rate]))
                           for rate in sorted({r["rate"] for r in records})},
        "recall_with_bandpass": float(np.mean([r["is_overlap"] and r["correct_source"] for r in records if r["bandpass"]])),
    }
    (OUTPUT_DIR / "synthetic_results.json").write_text(json.dumps({"summary": summary, "cuts": records}, indent=2))
    print(json.dumps(summary, indent=2))
    return summary


def for_listening(waveform: np.ndarray, sample_rate: int) -> np.ndarray:
    """Band-pass 100–1,800 Hz and bring to a common loudness, identically for both files of a pair.

    Some raw ICBHI recordings carry a full-scale DC offset with the breath sound far below it, which
    plays as near-silence; the matcher band-passes too, so this only makes the pairs audible.
    """
    from scipy.signal import butter, sosfiltfilt

    high = min(1_800.0, 0.45 * sample_rate)
    filtered = sosfiltfilt(butter(4, [100.0, high], btype="bandpass", fs=sample_rate, output="sos"), waveform)
    filtered = 0.1 * filtered / (np.sqrt(np.mean(filtered**2)) + 1e-12)
    return (filtered * min(1.0, 0.99 / (np.abs(filtered).max() + 1e-12))).astype(np.float32)


def comparison_image(clip: np.ndarray, segment: np.ndarray, rate: int, title: str, path: Path) -> None:
    """Waveforms and 0–2 kHz spectrograms of A and B on one time axis (no scores, no labels)."""
    import librosa
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(4, 1, figsize=(10, 7), sharex=True)
    for index, (signal, name) in enumerate(((clip, "A"), (segment, "B"))):
        axes[index].plot(np.arange(len(signal)) / rate, signal, lw=0.5, color="#2a6f97")
        axes[index].set_ylabel(f"{name}\nwaveform")
        axes[index].set_yticks([])
        spectrum = librosa.amplitude_to_db(np.abs(librosa.stft(signal, n_fft=512, hop_length=64)), ref=np.max)
        frequencies = librosa.fft_frequencies(sr=rate, n_fft=512)
        keep = frequencies <= 2_000
        axes[2 + index].pcolormesh(np.arange(spectrum.shape[1]) * 64 / rate, frequencies[keep], spectrum[keep],
                                   shading="auto", cmap="magma", vmin=-70, vmax=0)
        axes[2 + index].set_ylabel(f"{name}\nHz")
    axes[-1].set_xlabel("seconds")
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(path, dpi=90)
    plt.close(fig)


def listening(pairs: int, seed: int = 0) -> None:
    """Shuffled clip/reference WAV pairs (+ comparison images) for blind listening; key kept separately."""
    import librosa
    import soundfile as sf

    from cross_dataset_overlap import MATCH_SAMPLE_RATE

    with Path("data/kaggle_icbhi_overlap.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    matches = sorted((r for r in rows if r["is_overlap"] == "True"), key=lambda r: float(r["best_ncc"]))[:pairs]
    near = sorted((r for r in rows if r["is_overlap"] != "True"), key=lambda r: -float(r["best_ncc"]))[:pairs]
    items = [(r, "match") for r in matches] + [(r, "non-match") for r in near]
    random.Random(seed).shuffle(items)
    out = OUTPUT_DIR / "listening"
    out.mkdir(parents=True, exist_ok=True)
    key, sheet = [], []
    for index, (row, kind) in enumerate(items, 1):
        clip, rate = librosa.load(str(KAGGLE_DIR / row["clip"]), sr=None, mono=True)
        reference, ref_rate = librosa.load(str(ICBHI_DIR / row["reference"]), sr=rate, mono=True)
        offset = int(round(float(row["offset_seconds"]) * rate))
        clip, segment = for_listening(clip, rate), for_listening(reference[offset:offset + len(clip)], rate)
        sf.write(out / f"pair{index:02d}_A.wav", clip, rate, subtype="PCM_16")
        sf.write(out / f"pair{index:02d}_B.wav", segment, rate, subtype="PCM_16")
        comparison_image(clip, segment, rate, f"pair{index:02d}: is B the same recording as A?", out / f"pair{index:02d}.png")
        sheet.append({"pair": index, "same_recording (yes/no/unsure)": ""})
        key.append({"pair": index, "truth": kind, "clip": row["clip"], "reference": row["reference"],
                    "offset_seconds": row["offset_seconds"], "best_ncc": row["best_ncc"]})
    key_dir = OUTPUT_DIR / "listening_key"  # kept apart so the listener cannot see it by accident
    key_dir.mkdir(parents=True, exist_ok=True)
    for path, table in ((out / "answer_sheet.csv", sheet), (key_dir / "answer_key.csv", key)):
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(table[0]))
            writer.writeheader()
            writer.writerows(table)
    print(f"wrote {len(items)} pairs to {out} (key in {OUTPUT_DIR / 'listening_key'}); match sample rate {MATCH_SAMPLE_RATE}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["synthetic", "listening"])
    parser.add_argument("--cuts", type=int, default=100)
    parser.add_argument("--pairs", type=int, default=10)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if args.command == "synthetic":
        synthetic(args.cuts, args.workers)
    else:
        listening(args.pairs)


if __name__ == "__main__":
    main()
