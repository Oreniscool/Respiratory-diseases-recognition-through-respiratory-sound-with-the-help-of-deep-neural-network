"""Frozen-representation test on SPRSound (D-33; hypothesis H9).

Linear heads exactly as ``loso.py`` (standardized logistic regression, C = 0.1, balanced class weights, target
disease != healthy) are trained on the 1,162 development recordings (195 development patients; the locked
test split is never used) and applied to the ``ok`` SPRSound recordings. A patient's score is the mean of
their recordings' P(abnormal); the outcome is the healthy-vs-diseased AUROC over the 718 in-label patients
with a 2,000-draw patient bootstrap. Also written: the within-cohort (patient-grouped CV) AUROC of the same
heads on the development patients for reference, from ``loso.json``.

    python -m experiments.sprsound_heads
"""

from __future__ import annotations

import csv
import json
import warnings
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from experiments.cv import OUTPUT_DIR, SEED, load_development_records

REPRESENTATIONS = ("yamnet", "opera_ce", "hear", "ast")
IN_LABEL = {"healthy", "asthma", "bronchial", "pneumonia"}
DRAWS = 2_000


def load_table(path: Path) -> dict[str, np.ndarray]:
    stored = np.load(path, allow_pickle=False)
    return dict(zip(stored["paths"].tolist(), stored["embeddings"]))


def main() -> None:
    records, _ = load_development_records()
    with Path("data/sprsound_manifest.csv").open(newline="", encoding="utf-8") as handle:
        spr = [r for r in csv.DictReader(handle) if r["status"] == "ok" and r["label"] in IN_LABEL]
    y_dev = np.asarray([int(r.disease != "healthy") for r in records])
    patients = sorted({r["patient_id"] for r in spr})
    label = {r["patient_id"]: int(r["label"] != "healthy") for r in spr}
    rng = np.random.default_rng(SEED)
    loso = json.loads((OUTPUT_DIR / "loso.json").read_text()) if (OUTPUT_DIR / "loso.json").is_file() else {}
    result: dict[str, object] = {"development_recordings": len(records), "sprsound_recordings": len(spr),
                                 "patients": len(patients), "healthy": int(sum(1 for p in patients if label[p] == 0)),
                                 "representations": {}}
    for name in REPRESENTATIONS:
        dev_path, spr_path = OUTPUT_DIR / "cache" / f"emb_{name}.npz", OUTPUT_DIR / "cache" / f"emb_sprsound_{name}.npz"
        if not (dev_path.is_file() and spr_path.is_file()):
            print(f"[heads] {name}: missing cache, skipped")
            continue
        dev, ext = load_table(dev_path), load_table(spr_path)
        x_dev = np.stack([dev[str(r.path)] for r in records])
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = make_pipeline(StandardScaler(), LogisticRegression(C=0.1, class_weight="balanced", max_iter=5000))
            model.fit(x_dev, y_dev)
            scores = model.predict_proba(np.stack([ext[r["path"]] for r in spr]))[:, 1]
        per_patient: dict[str, list[float]] = defaultdict(list)
        for r, s in zip(spr, scores):
            per_patient[r["patient_id"]].append(float(s))
        score = np.asarray([np.mean(per_patient[p]) for p in patients])
        truth = np.asarray([label[p] for p in patients])
        draws = []
        for _ in range(DRAWS):
            idx = rng.integers(0, len(patients), len(patients))
            if 0 < truth[idx].sum() < len(idx):
                draws.append(roc_auc_score(truth[idx], score[idx]))
        auc = float(roc_auc_score(truth, score))
        interval = [float(x) for x in np.percentile(draws, [2.5, 97.5])]
        within = {s: loso[name]["within_cohort_by_source"][s]["auroc"] for s in loso[name]["within_cohort_by_source"]} if name in loso else {}
        result["representations"][name] = {
            "sprsound_auroc": auc, "ci95": interval, "share_of_diseased_patients_scored_above_median_healthy": float(np.mean(
                score[truth == 1] > np.median(score[truth == 0]))),
            "h9_rejected": bool(auc >= 0.70 and interval[0] > 0.60), "within_cohort_auroc_by_source": within}
        print(f"[heads] {name}: SPRSound AUROC {auc:.3f} {[round(x, 3) for x in interval]}", flush=True)
    (OUTPUT_DIR / "sprsound_heads.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
