"""Find clips of one dataset that are cut from recordings of another.

Kaggle "Asthma Detection Dataset V2" states that part of it was segmented from ICBHI 2017.
Such clips are not new evidence: merged naively, a segment and its source recording carry
different patient IDs and can land on opposite sides of the train/test split.

Each clip is located inside every reference recording with normalized cross-correlation
(NCC) on a band-limited, low-rate signal. NCC is gain-invariant, so the dataset's
amplification step does not hide a match. Verbatim segments score ~1.0; unrelated audio
scores far lower.

Usage
-----
  python cross_dataset_overlap.py \\
      --clips      "dataset/Asthma_Detection_V2/Asthma Detection Dataset Version 2/Asthma Detection Dataset Version 2" \\
      --references dataset/ICBHI_final_dataset \\
      --output     data/kaggle_icbhi_overlap.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, fftconvolve, sosfiltfilt

MATCH_SAMPLE_RATE = 4_000
MATCH_BAND_HZ = (100.0, 1_000.0)
# On Kaggle V2 vs ICBHI (2026-10-21) every verbatim cut scored >= 0.795 with a second-best
# <= 0.57 and a same-label source, while no other clip scored above 0.70. 0.75 sits in that gap.
DEFAULT_THRESHOLD = 0.75
_SOS = butter(4, MATCH_BAND_HZ, btype="bandpass", fs=MATCH_SAMPLE_RATE, output="sos")
FIELDS = [
    "clip", "clip_class", "clip_seconds", "best_ncc", "offset_seconds",
    "reference", "second_ncc", "second_reference", "is_overlap",
]


def band_limited(signal: np.ndarray) -> np.ndarray:
    return sosfiltfilt(_SOS, np.asarray(signal, dtype=np.float64)).astype(np.float32)


def load_band_limited(path: str | Path) -> np.ndarray:
    audio, _ = librosa.load(str(path), sr=MATCH_SAMPLE_RATE, mono=True)
    return band_limited(audio)


def max_normalized_cross_correlation(clip: np.ndarray, reference: np.ndarray) -> tuple[float, int]:
    """Best |NCC| of ``clip`` against every same-length window of ``reference``, and its offset."""
    if len(reference) < len(clip):
        clip, reference = reference, clip
    n = len(clip)
    centered = clip.astype(np.float64) - float(np.mean(clip))
    norm = float(np.linalg.norm(centered))
    if n < 2 or norm < 1e-12:
        return 0.0, 0
    # float32 FFT is ample for a score that separates ~1.0 from <=0.7 and is ~2x faster;
    # the running sums below stay in float64 for numerical stability.
    kernel = (centered / norm)[::-1].astype(np.float32)
    numerator = fftconvolve(reference.astype(np.float32, copy=False), kernel, mode="valid")
    values = reference.astype(np.float64)
    sum_1 = np.concatenate([[0.0], np.cumsum(values)])
    sum_2 = np.concatenate([[0.0], np.cumsum(values * values)])
    window_sum = sum_1[n:] - sum_1[:-n]
    window_energy = sum_2[n:] - sum_2[:-n] - window_sum**2 / n
    ncc = np.abs(numerator / np.sqrt(np.maximum(window_energy, 1e-12)))
    offset = int(np.argmax(ncc))
    return float(ncc[offset]), offset


_REFERENCES: list[tuple[str, np.ndarray]] = []


def _load_references(paths: list[str], single_threaded: bool = False) -> None:
    global _REFERENCES
    if single_threaded:
        # One process per core already saturates the CPU; per-process BLAS/OpenMP thread pools
        # on top (16 threads x 12 workers) thrash the scheduler and made a run 4x slower.
        try:
            from threadpoolctl import threadpool_limits

            threadpool_limits(1)
        except ImportError:
            pass
    _REFERENCES = [(Path(path).name, load_band_limited(path)) for path in paths]


def _match_clip(job: tuple[str, str, float]) -> dict[str, object]:
    clip_path, clip_label, threshold = job
    clip = load_band_limited(clip_path)
    scored = sorted(
        ((*max_normalized_cross_correlation(clip, reference), name) for name, reference in _REFERENCES),
        reverse=True,
    )
    (best, offset, name), (second, _, second_name) = scored[0], scored[1]
    return {
        "clip": clip_label,
        "clip_class": Path(clip_path).parent.name.lower(),
        "clip_seconds": round(len(clip) / MATCH_SAMPLE_RATE, 2),
        "best_ncc": round(best, 4),
        "offset_seconds": round(offset / MATCH_SAMPLE_RATE, 2),
        "reference": name,
        "second_ncc": round(second, 4),
        "second_reference": second_name,
        "is_overlap": best >= threshold,
    }


def find_overlaps(
    clip_paths: list[str],
    reference_paths: list[str],
    *,
    threshold: float = DEFAULT_THRESHOLD,
    workers: int = 1,
    clip_root: str | Path | None = None,
) -> list[dict[str, object]]:
    """Best-matching reference recording for every clip.

    ``clip`` in each result is the path relative to ``clip_root`` when given, so the
    evidence file does not depend on where the dataset lives.
    """
    if len(reference_paths) < 2:
        raise ValueError("At least two reference recordings are required")

    def label(path: str) -> str:
        return Path(path).relative_to(clip_root).as_posix() if clip_root else str(path)

    jobs = [(str(path), label(str(path)), threshold) for path in clip_paths]
    references = [str(path) for path in reference_paths]
    if workers <= 1:
        _load_references(references)
        return [_match_clip(job) for job in jobs]
    rows: list[dict[str, object]] = []
    started = time.monotonic()
    with ProcessPoolExecutor(
        workers, initializer=_load_references, initargs=(references, True)
    ) as pool:
        for done, row in enumerate(pool.map(_match_clip, jobs, chunksize=4), 1):
            rows.append(row)
            if done % 100 == 0 or done == len(jobs):
                print(f"[overlap] {done}/{len(jobs)} clips, {time.monotonic() - started:.0f}s",
                      file=sys.stderr, flush=True)
    return rows


def summarize(rows: list[dict[str, object]], threshold: float) -> dict[str, object]:
    by_class: dict[str, dict[str, int]] = {}
    for row in rows:
        counts = by_class.setdefault(str(row["clip_class"]), {"clips": 0, "overlaps": 0})
        counts["clips"] += 1
        counts["overlaps"] += int(bool(row["is_overlap"]))
    overlap_scores = [float(row["best_ncc"]) for row in rows if row["is_overlap"]]
    other_scores = [float(row["best_ncc"]) for row in rows if not row["is_overlap"]]
    return {
        "threshold": threshold,
        "clips": len(rows),
        "overlaps": sum(counts["overlaps"] for counts in by_class.values()),
        "by_class": by_class,
        "min_overlap_ncc": min(overlap_scores, default=None),
        "max_non_overlap_ncc": max(other_scores, default=None),
    }


def overlap_key(path: str | Path) -> str:
    """Identify a clip by ``<lowercase class folder>/<file name>``, independent of location."""
    path = Path(path)
    return f"{path.parent.name.lower()}/{path.name}"


def load_overlap_evidence(csv_path: str | Path) -> tuple[set[str], set[str]]:
    """Return (all clip keys covered by the evidence file, keys flagged as overlaps)."""
    covered: set[str] = set()
    overlapping: set[str] = set()
    with Path(csv_path).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            key = overlap_key(row["clip"])
            covered.add(key)
            if str(row["is_overlap"]).strip().lower() == "true":
                overlapping.add(key)
    return covered, overlapping


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--clips", required=True, help="Folder of candidate clips (searched recursively)")
    parser.add_argument("--references", required=True, help="Folder of reference recordings")
    parser.add_argument("--output", required=True, help="CSV of per-clip matches")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    clips = sorted(str(path) for path in Path(args.clips).rglob("*.wav"))
    references = sorted(str(path) for path in Path(args.references).rglob("*.wav"))
    rows = find_overlaps(
        clips, references, threshold=args.threshold, workers=args.workers, clip_root=args.clips
    )
    output = Path(args.output)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    summary = summarize(rows, args.threshold)
    output.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
