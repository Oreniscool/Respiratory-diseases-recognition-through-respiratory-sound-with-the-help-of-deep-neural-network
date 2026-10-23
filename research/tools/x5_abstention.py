"""X5: does the abstention rule flag out-of-label audio, and does it remove wrong in-label calls?

Reads the per-recording outputs of ``backend/experiments/external.py`` for every model evaluated on
KAUH and writes ``backend/artifacts/experiments/x5_abstention.json``. For each evaluation:

- abstention rate on out-of-label recordings vs in-label recordings, and their difference with a
  patient-cluster bootstrap 95% CI (recordings of one patient are resampled together);
- in-label selective accuracy: accuracy on all in-label recordings vs on the ones not abstained.

Descriptive (RESEARCH_PLAN H5). Out-of-label means a KAUH diagnosis outside the five classes
(heart failure, lung fibrosis, pleural effusion, ...), not audio from another domain.

    python research/tools/x5_abstention.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "backend" / "artifacts"
DRAWS, SEED = 10_000, 0
EVALUATIONS = {
    "EXP-011 pre-round-2 model, 45-patient external set": "experiments-round2a/external/previous_served_model_recordings.json",
    "EXP-013 round-2 model, 45-patient external set": "experiments-round2a/external/served_round2_recordings.json",
    "EXP-017 round-2 model, 24-patient holdout": "experiments/external/previous_round2_on_holdout_recordings.json",
    "X3 round-2b model, 24-patient holdout": "experiments/external/served_round2b_final_recordings.json",
}


def grouped(rows: list[dict], key) -> list[np.ndarray]:
    groups: dict[int, list[float]] = {}
    for row in rows:
        groups.setdefault(row["patient_id"], []).append(float(key(row)))
    return [np.asarray(v) for v in groups.values()]


def boot_rate(groups: list[np.ndarray], rng) -> np.ndarray:
    sums, counts = np.asarray([g.sum() for g in groups]), np.asarray([g.size for g in groups])
    draws = rng.integers(0, len(groups), size=(DRAWS, len(groups)))
    return sums[draws].sum(1) / counts[draws].sum(1)


def analyse(rows: list[dict], rng) -> dict[str, object]:
    out_rows = [r for r in rows if r["label"] == "out_of_label"]
    in_rows = [r for r in rows if r["label"] != "out_of_label"]
    out_g, in_g = grouped(out_rows, lambda r: r["uncertain"]), grouped(in_rows, lambda r: r["uncertain"])
    diff = boot_rate(out_g, rng) - boot_rate(in_g, rng)
    accepted = [r for r in in_rows if not r["uncertain"]]
    return {
        "out_of_label": {"recordings": len(out_rows), "patients": len(out_g),
                         "abstention": float(np.mean([r["uncertain"] for r in out_rows]))},
        "in_label": {"recordings": len(in_rows), "patients": len(in_g),
                     "abstention": float(np.mean([r["uncertain"] for r in in_rows]))},
        "difference": float(np.mean([r["uncertain"] for r in out_rows]) - np.mean([r["uncertain"] for r in in_rows])),
        "difference_ci95": [float(x) for x in np.percentile(diff, [2.5, 97.5])],
        "in_label_accuracy_all": float(np.mean([r["model_prediction"] == r["label"] for r in in_rows])),
        "in_label_accuracy_accepted": (float(np.mean([r["model_prediction"] == r["label"] for r in accepted]))
                                       if accepted else None),
        "in_label_accepted": len(accepted),
    }


def main() -> None:
    rng = np.random.default_rng(SEED)
    result = {"method": f"patient-cluster bootstrap, {DRAWS} draws, seed {SEED}; recording-level rates"}
    for name, path in EVALUATIONS.items():
        result[name] = analyse(json.loads((ART / path).read_text()), rng)
    out = ART / "experiments" / "x5_abstention.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    for name, r in result.items():
        if name == "method":
            continue
        print(f"{name}: out {r['out_of_label']['abstention']:.3f} vs in {r['in_label']['abstention']:.3f} "
              f"(Δ {r['difference']:+.3f}, CI {r['difference_ci95'][0]:+.3f} to {r['difference_ci95'][1]:+.3f}); "
              f"in-label acc all {r['in_label_accuracy_all']:.3f} → accepted {r['in_label_accuracy_accepted']} "
              f"(n={r['in_label_accepted']})")


if __name__ == "__main__":
    main()
