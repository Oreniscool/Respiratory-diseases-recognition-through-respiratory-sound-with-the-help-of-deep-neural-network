"""Second, independent copy detector: landmark fingerprinting (Wang 2003-style).

The audit's detector (``cross_dataset_overlap.py``) slides each clip over each reference with
normalized cross-correlation on band-limited *waveforms*. This one never correlates waveforms: it
reduces every recording to constellation landmarks, i.e. local maxima of the log-magnitude
spectrogram, hashes pairs of nearby landmarks as (f1, f2, dt), and counts, per (reference, time
offset), how many hashes of the clip agree. A copy gives hundreds of votes at one offset; unrelated
audio gives a handful by chance. It is gain-invariant (log spectrogram, peaks relative to a
percentile of the recording itself).

Settings fixed **before** any comparison with the NCC results (D-30): audio at 4 kHz, band 100–1,000 Hz
(the same band as the NCC detector, so the two see the same signal), n_fft 256, hop 64, peak
neighbourhood 9×9 bins, peaks above the 85th percentile of the clip's own log-magnitude, 5 target
peaks per anchor within 1–40 frames, detection at ≥ 25 aligned votes. The threshold was set from a
smoke test (a gain-changed cut of a known recording: 63 votes; unrelated noise: 2) and is checked
against a chance distribution measured first, on 300 time-reversed ICBHI windows that cannot be
copies (reported as ``chance_votes``). Neighbouring offsets are merged (±1 frame).

Outputs ``artifacts/experiments/fingerprint_match.json``:
- recall on the 100 synthetic degraded cuts of ``match_validation.py`` (the second detector's own
  validation, independent of the first);
- agreement with the NCC detector on every Kaggle clip against ICBHI and KAUH
  (``data/kaggle_icbhi_overlap.csv``, ``data/kaggle_kauh_overlap.csv``): confusion counts, whether the
  best reference is the same recording, and the votes distribution of both groups.

    python -m experiments.fingerprint_match
"""

from __future__ import annotations

import csv
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter

from cross_dataset_overlap import MATCH_BAND_HZ, MATCH_SAMPLE_RATE, load_band_limited

OUT = Path("artifacts/experiments/fingerprint_match.json")
ICBHI_DIR = Path("dataset/ICBHI_final_dataset")
KAUH_DIR = Path("dataset/KAUH/audio")
KAGGLE_DIR = Path("dataset/Asthma_Detection_V2/Asthma Detection Dataset Version 2/Asthma Detection Dataset Version 2")
N_FFT, HOP = 256, 64
NEIGHBOURHOOD = (9, 9)
PERCENTILE = 85
FAN_OUT, MAX_DT = 5, 40
THRESHOLD = 25
FREQ_BINS = (int(MATCH_BAND_HZ[0] * N_FFT / MATCH_SAMPLE_RATE), int(MATCH_BAND_HZ[1] * N_FFT / MATCH_SAMPLE_RATE) + 1)


def landmarks(signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Hashes and their anchor frames for one recording."""
    if len(signal) < N_FFT * 2:
        return np.empty(0, np.int64), np.empty(0, np.int64)
    window = np.hanning(N_FFT).astype(np.float32)
    starts = np.arange(0, len(signal) - N_FFT, HOP)
    frames = np.stack([signal[s:s + N_FFT] * window for s in starts])
    spectrum = np.log1p(np.abs(np.fft.rfft(frames, axis=1))[:, FREQ_BINS[0]:FREQ_BINS[1]])  # (time, freq)
    is_peak = (spectrum == maximum_filter(spectrum, size=NEIGHBOURHOOD)) & (spectrum > np.percentile(spectrum, PERCENTILE))
    t, f = np.nonzero(is_peak)
    order = np.argsort(t, kind="stable")
    t, f = t[order], f[order]
    hashes, anchors = [], []
    for i in range(len(t)):
        j = i + 1
        taken = 0
        while j < len(t) and taken < FAN_OUT and t[j] - t[i] <= MAX_DT:
            if t[j] - t[i] >= 1:
                hashes.append((int(f[i]) << 16) | (int(f[j]) << 8) | int(t[j] - t[i]))
                anchors.append(int(t[i]))
                taken += 1
            j += 1
    return np.asarray(hashes, dtype=np.int64), np.asarray(anchors, dtype=np.int64)


def fingerprint_file(path: str) -> tuple[str, np.ndarray, np.ndarray]:
    return path, *landmarks(load_band_limited(path))


class Index:
    def __init__(self, paths: list[str], workers: int = 8):
        with ProcessPoolExecutor(workers) as pool:
            built = list(pool.map(fingerprint_file, paths, chunksize=4))
        self.names = [Path(p).name for p, _, _ in built]
        hashes = np.concatenate([h for _, h, _ in built])
        times = np.concatenate([t for _, _, t in built])
        owners = np.concatenate([np.full(len(h), i, np.int32) for i, (_, h, _) in enumerate(built)])
        order = np.argsort(hashes, kind="stable")
        self.hashes, self.times, self.owners = hashes[order], times[order], owners[order]

    def query(self, hashes: np.ndarray, anchors: np.ndarray) -> tuple[str | None, int]:
        """Best (reference name, aligned votes); neighbouring offsets (±1 frame) are merged."""
        if len(hashes) == 0:
            return None, 0
        left = np.searchsorted(self.hashes, hashes, "left")
        right = np.searchsorted(self.hashes, hashes, "right")
        counts = right - left
        if counts.sum() == 0:
            return None, 0
        take = np.concatenate([np.arange(a, b) for a, b in zip(left, right) if b > a])
        offsets = self.times[take] - np.repeat(anchors, counts)
        keys = self.owners[take].astype(np.int64) * 1_000_000 + (offsets + 500_000)
        unique, votes = np.unique(keys, return_counts=True)
        neighbour = np.zeros_like(votes)
        position = np.searchsorted(unique, unique + 1)
        found = (position < len(unique)) & (unique[np.minimum(position, len(unique) - 1)] == unique + 1)
        neighbour[found] = votes[position[found]]
        merged = votes + neighbour
        best = int(np.argmax(merged))
        return self.names[int(unique[best] // 1_000_000)], int(merged[best])


def read_ncc(csv_path: str) -> dict[str, dict]:
    with Path(csv_path).open(newline="", encoding="utf-8") as handle:
        return {r["clip"]: r for r in csv.DictReader(handle)}


def main() -> None:
    icbhi_paths = sorted(str(p) for p in ICBHI_DIR.glob("*.wav"))
    kauh_paths = sorted(str(p) for p in KAUH_DIR.glob("*.wav"))
    print(f"[fp] indexing {len(icbhi_paths)} ICBHI + {len(kauh_paths)} KAUH recordings", flush=True)
    index_icbhi, index_kauh = Index(icbhi_paths), Index(kauh_paths)

    # 0. chance level: time-reversed ICBHI windows cannot be copies of anything in the index
    rng = np.random.default_rng(0)
    chance = []
    for path in rng.choice(icbhi_paths, 300, replace=True):
        signal = load_band_limited(path)
        window = 4_000 * 6
        start = int(rng.integers(0, max(1, len(signal) - window)))
        chance.append(index_icbhi.query(*landmarks(signal[start:start + window][::-1].copy()))[1])
    print(f"[fp] chance votes (time-reversed windows): median {np.median(chance):.0f}, "
          f"p99 {np.percentile(chance, 99):.0f}, max {max(chance)}; threshold {THRESHOLD}", flush=True)
    result: dict[str, object] = {"chance_votes": {"windows": len(chance), "median": float(np.median(chance)),
                                                  "p99": float(np.percentile(chance, 99)), "max": int(max(chance))},
                                 "settings": {"n_fft": N_FFT, "hop": HOP, "neighbourhood": NEIGHBOURHOOD, "percentile": PERCENTILE,
                                               "fan_out": FAN_OUT, "max_dt": MAX_DT, "threshold": THRESHOLD}}
    # 1. recall on the synthetic degraded cuts (truth is known)
    synthetic = json.loads(Path("artifacts/experiments/match_validation/synthetic_results.json").read_text())["cuts"]
    hits, votes_synth = 0, []
    for cut in synthetic:
        _, h, t = fingerprint_file(f"artifacts/experiments/match_validation/synthetic_clips/copd/{cut['clip']}")
        name, votes = index_icbhi.query(h, t)
        votes_synth.append(votes)
        hits += name == cut["source"] and votes >= THRESHOLD
    result["synthetic_recall"] = {"cuts": len(synthetic), "found_correct_source": hits, "recall": hits / len(synthetic),
                                  "votes_median": float(np.median(votes_synth)), "votes_p05": float(np.percentile(votes_synth, 5))}
    print("[fp] synthetic recall", result["synthetic_recall"], flush=True)

    # 2. agreement with the NCC detector on every Kaggle clip
    ncc_icbhi, ncc_kauh = read_ncc("data/kaggle_icbhi_overlap.csv"), read_ncc("data/kaggle_kauh_overlap.csv")
    clips = sorted(ncc_icbhi)
    with ProcessPoolExecutor(8) as pool:
        prints = list(pool.map(fingerprint_file, [str(KAGGLE_DIR / c) for c in clips], chunksize=8))
    rows = []
    for clip, (_, h, t) in zip(clips, prints):
        name_i, votes_i = index_icbhi.query(h, t)
        name_k, votes_k = index_kauh.query(h, t)
        rows.append({"clip": clip, "seconds": float(ncc_icbhi[clip]["clip_seconds"]), "hashes": int(len(h)),
                     "icbhi": {"fp_ref": name_i, "votes": votes_i, "fp_found": votes_i >= THRESHOLD,
                               "ncc_found": ncc_icbhi[clip]["is_overlap"] == "True", "ncc_ref": ncc_icbhi[clip]["reference"]},
                     "kauh": {"fp_ref": name_k, "votes": votes_k, "fp_found": votes_k >= THRESHOLD,
                              "ncc_found": ncc_kauh[clip]["is_overlap"] == "True", "ncc_ref": ncc_kauh[clip]["reference"]}})
    for source in ("icbhi", "kauh"):
        both = [r for r in rows if r[source]["fp_found"] and r[source]["ncc_found"]]
        summary = {
            "clips": len(rows),
            "both_found": len(both),
            "ncc_only": sum(r[source]["ncc_found"] and not r[source]["fp_found"] for r in rows),
            "fingerprint_only": sum(r[source]["fp_found"] and not r[source]["ncc_found"] for r in rows),
            "neither": sum(not r[source]["fp_found"] and not r[source]["ncc_found"] for r in rows),
            "same_reference_when_both": sum(r[source]["fp_ref"] == r[source]["ncc_ref"] for r in both),
            "votes_when_ncc_found_median": float(np.median([r[source]["votes"] for r in rows if r[source]["ncc_found"]] or [0])),
            "votes_when_ncc_not_found_p99": float(np.percentile([r[source]["votes"] for r in rows if not r[source]["ncc_found"]] or [0], 99)),
        }
        result[source] = summary
        print(f"[fp] {source}: {summary}", flush=True)
    from kauh import parse_name  # KAUH files each recording as three filter exports (bell / diaphragm / extended)

    result["kauh_reference_differences"] = [
        {"clip": r["clip"], "fingerprint": r["kauh"]["fp_ref"], "ncc": r["kauh"]["ncc_ref"],
         "same_patient": parse_name(r["kauh"]["fp_ref"]).patient == parse_name(r["kauh"]["ncc_ref"]).patient,
         "votes": r["kauh"]["votes"]}
        for r in rows if r["kauh"]["fp_found"] and r["kauh"]["ncc_found"] and r["kauh"]["fp_ref"] != r["kauh"]["ncc_ref"]]
    result["disagreements"] = [{"clip": r["clip"], "seconds": r["seconds"], "hashes": r["hashes"],
                                **{s: {k: r[s][k] for k in ("fp_ref", "votes", "ncc_found", "ncc_ref")} for s in ("icbhi", "kauh")}}
                               for r in rows if any(r[s]["fp_found"] != r[s]["ncc_found"] for s in ("icbhi", "kauh"))]
    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
