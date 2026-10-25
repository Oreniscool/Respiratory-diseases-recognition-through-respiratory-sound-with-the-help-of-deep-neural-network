"""Normal-vs-abnormal AUROC on KAUH, comparable to Ong Ly et al. (npj Digit Med 2024: 0.97 → 0.60).

For every KAUH evaluation already on disk, the abnormality score of a patient is 1 − mean P(healthy)
over the patient's recordings. KAUH "N" (normal) patients are negatives; every other diagnosis,
including the out-of-label ones (heart failure, fibrosis, effusion, ...), is positive. Patient-level
AUROC with a 95% patient bootstrap interval (2,000 draws).

Writes ``backend/artifacts/experiments/binary_external.json``.

    python research/tools/binary_external.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score

ART = Path(__file__).resolve().parents[2] / "backend" / "artifacts"
HEALTHY = 3  # index of "healthy" in the ordered classes asthma, bronchial, copd, healthy, pneumonia
EVALUATIONS = {
    "EXP-011 pre-round-2 model, 72 external patients": "experiments-round2a/external/previous_served_model_recordings.json",
    "EXP-013 round-2 model, 72 external patients": "experiments-round2a/external/served_round2_recordings.json",
    "EXP-017 round-2 model, 51-patient holdout": "experiments/external/previous_round2_on_holdout_recordings.json",
    "X3 round-2b model, 51-patient holdout": "experiments/external/served_round2b_final_recordings.json",
}


def patient_scores(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    groups: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        groups[row["patient_id"]].append(row)
    truth = np.asarray([int(g[0]["label"] != "healthy") for g in groups.values()])
    score = np.asarray([1.0 - np.mean([r["probabilities"][HEALTHY] for r in g]) for g in groups.values()])
    return truth, score


def bootstrap(truth: np.ndarray, score: np.ndarray, rng, draws: int = 2_000) -> list[float]:
    values = []
    for _ in range(draws):
        idx = rng.integers(0, len(truth), len(truth))
        if 0 < truth[idx].sum() < len(idx):
            values.append(roc_auc_score(truth[idx], score[idx]))
    return [float(x) for x in np.percentile(values, [2.5, 97.5])]


def main() -> None:
    rng = np.random.default_rng(0)
    result = {"method": "patient-level AUROC of 1 − mean P(healthy); normal = KAUH diagnosis 'N'; 2,000 patient bootstrap draws"}
    for name, path in EVALUATIONS.items():
        rows = json.loads((ART / path).read_text())
        truth, score = patient_scores(rows)
        result[name] = {"patients": int(len(truth)), "normal": int((truth == 0).sum()), "abnormal": int(truth.sum()),
                        "auroc": float(roc_auc_score(truth, score)), "auroc_ci95": bootstrap(truth, score, rng)}
        r = result[name]
        print(f"{name}: AUROC {r['auroc']:.3f} [{r['auroc_ci95'][0]:.3f}, {r['auroc_ci95'][1]:.3f}] "
              f"({r['normal']} normal / {r['abnormal']} abnormal patients)")
    (ART / "experiments/binary_external.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
