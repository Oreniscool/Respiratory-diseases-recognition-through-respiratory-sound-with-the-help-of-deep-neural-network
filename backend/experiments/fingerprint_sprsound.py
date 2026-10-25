"""Is SPRSound clean to use as an external set? Fingerprint audit against every dataset we trained on.

Uses the landmark-fingerprint detector of ``fingerprint_match.py`` with its fixed settings (D-30:
threshold 25 aligned votes; chance level median 8, p99 16, max 21). Rules fixed before any model ran on
SPRSound (D-32):

- every SPRSound recording (all 6,567 files, including those the manifest excludes) is searched in an
  index of ICBHI (920 recordings), KAUH (336 recordings) and the Kaggle V2 clips (1,211);
- every Kaggle clip is searched in an index of SPRSound (this answers whether any of the 264 clips of
  unknown origin come from SPRSound).

A match (>= 25 votes) is reported and the SPRSound recording is excluded from the evaluation. Writes
``artifacts/experiments/fingerprint_sprsound.json`` and, if any SPRSound recording matches,
``data/sprsound_overlap.csv``.

    python -m experiments.fingerprint_sprsound
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from experiments.fingerprint_match import (ICBHI_DIR, KAGGLE_DIR, KAUH_DIR, THRESHOLD, Index, fingerprint_file,
                                           read_ncc)

OUT = Path("artifacts/experiments/fingerprint_sprsound.json")
OVERLAP_CSV = Path("data/sprsound_overlap.csv")


def main() -> None:
    with Path("data/sprsound_manifest.csv").open(newline="", encoding="utf-8") as handle:
        manifest = list(csv.DictReader(handle))
    spr_paths = [r["path"] for r in manifest]
    ncc = read_ncc("data/kaggle_icbhi_overlap.csv")
    ncc_kauh = read_ncc("data/kaggle_kauh_overlap.csv")
    kaggle_clips = sorted(ncc)
    kaggle_paths = [str(KAGGLE_DIR / c) for c in kaggle_clips]
    print(f"[spr] indexing {len(spr_paths)} SPRSound recordings", flush=True)
    index_spr = Index(spr_paths)
    print("[spr] indexing ICBHI, KAUH and Kaggle references", flush=True)
    refs = {"icbhi": Index(sorted(str(p) for p in ICBHI_DIR.glob("*.wav"))),
            "kauh": Index(sorted(str(p) for p in KAUH_DIR.glob("*.wav"))),
            "kaggle": Index(kaggle_paths)}

    # direction 1: SPRSound recording -> ICBHI / KAUH / Kaggle
    with ProcessPoolExecutor(8) as pool:
        spr_prints = list(pool.map(fingerprint_file, spr_paths, chunksize=16))
    hits = []
    votes = {name: [] for name in refs}
    for row, (_, h, t) in zip(manifest, spr_prints):
        for name, index in refs.items():
            ref, v = index.query(h, t)
            votes[name].append(v)
            if v >= THRESHOLD:
                hits.append({"sprsound": row["path"], "patient_id": row["patient_id"], "status": row["status"],
                             "reference_set": name, "reference": ref, "votes": v})
    # direction 2: Kaggle clip -> SPRSound
    with ProcessPoolExecutor(8) as pool:
        kaggle_prints = list(pool.map(fingerprint_file, kaggle_paths, chunksize=8))
    kaggle_hits = []
    for clip, (_, h, t) in zip(kaggle_clips, kaggle_prints):
        ref, v = index_spr.query(h, t)
        if v >= THRESHOLD:
            kaggle_hits.append({"clip": clip, "sprsound": ref, "votes": v,
                                "known_origin": ncc[clip]["is_overlap"] == "True" or ncc_kauh[clip]["is_overlap"] == "True"})
    result = {
        "threshold": THRESHOLD,
        "sprsound_recordings_searched": len(spr_paths),
        "votes_per_reference_set": {n: {"median": float(np.median(v)), "p99": float(np.percentile(v, 99)), "max": int(max(v))}
                                    for n, v in votes.items()},
        "sprsound_matches": len(hits), "sprsound_matches_by_reference_set": dict(Counter(h["reference_set"] for h in hits)),
        "kaggle_clips_searched": len(kaggle_clips), "kaggle_clips_found_in_sprsound": len(kaggle_hits),
        "kaggle_clips_found_in_sprsound_with_unknown_origin": sum(not h["known_origin"] for h in kaggle_hits),
        "kaggle_unknown_origin_clips": sum(not (ncc[c]["is_overlap"] == "True" or ncc_kauh[c]["is_overlap"] == "True") for c in kaggle_clips),
        "sprsound_hits": hits[:200], "kaggle_hits": kaggle_hits[:200],
    }
    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if hits:
        with OVERLAP_CSV.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(hits[0]))
            writer.writeheader()
            writer.writerows(hits)
    print(json.dumps({k: v for k, v in result.items() if not k.endswith("hits")}, indent=2))


if __name__ == "__main__":
    main()
