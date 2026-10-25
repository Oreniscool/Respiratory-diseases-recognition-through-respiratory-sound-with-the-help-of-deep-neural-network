"""KAUH adaptation learning curve with the fusion's embedding members (exploratory; novelty review R10).

How does performance on held-out KAUH patients change with the number k of KAUH patients in
training? Retraining the full four-member fusion for every k would take hours of GPU time, so this
uses the fusion's embedding members only: YAMNet, OPERA-CE and HeAR logistic heads (standardized,
class-balanced, C = 0.01), averaged with equal weights.

- Training: development patients of split v3 (train + validation) without any KAUH-cohort patient,
  plus k KAUH-cohort patients drawn from the development split (the 3 KAUH test patients stay
  locked). k ∈ {0, 4, 9, 18}, 10 random draws per k > 0, each draw keeping at least one COPD patient.
- Evaluation: the v2 KAUH holdout (``data/kauh_external_holdout_manifest_v2.csv``; 22 in-label
  patients, 27 out-of-label). Patient-level in-label accuracy, healthy and COPD recall, and
  normal-vs-abnormal AUROC over all 49 patients.

This is a **diagnostic** reuse of the holdout (it chooses nothing; D-18 precedent) and is reported as
within-site adaptation, never as cross-site generalization.

Writes ``artifacts/experiments/learning_curve.json``.

    python -m experiments.learning_curve
"""

from __future__ import annotations

import csv
import json
import random
import warnings
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from experiments.cv import OUTPUT_DIR, SEED, embeddings, load_development_records
from featureExtraction import AudioRecord

MEMBERS = ("yamnet", "opera_ce", "hear")
K_VALUES = (0, 4, 9, 18)
DRAWS = 10


def holdout_records() -> list[AudioRecord]:
    with Path("data/kauh_external_holdout_manifest_v2.csv").open(newline="", encoding="utf-8") as handle:
        return [AudioRecord(Path(r["path"]), int(r["patient_id"]), r["label"], "kauh") for r in csv.DictReader(handle)]


def fused_probabilities(train: list[AudioRecord], test: list[AudioRecord], tables, classes) -> np.ndarray:
    y = [r.disease for r in train]
    total = np.zeros((len(test), len(classes)))
    for name in MEMBERS:
        x_train = np.stack([tables[name][str(r.path)] for r in train])
        x_test = np.stack([tables[name][str(r.path)] for r in test])
        model = make_pipeline(StandardScaler(), LogisticRegression(C=0.01, class_weight="balanced", max_iter=5000))
        model.fit(x_train, y)
        order = [list(model.classes_).index(c) for c in classes]
        total += model.predict_proba(x_test)[:, order]
    return total / len(MEMBERS)


def score(test: list[AudioRecord], probabilities: np.ndarray, classes: list[str]) -> dict[str, float]:
    patients: dict[int, list[int]] = {}
    for index, r in enumerate(test):
        patients.setdefault(r.patient_id, []).append(index)
    truth = {p: test[ix[0]].disease for p, ix in patients.items()}
    mean = {p: probabilities[ix].mean(axis=0) for p, ix in patients.items()}
    predicted = {p: classes[int(np.argmax(m))] for p, m in mean.items()}
    in_label = [p for p in patients if truth[p] != "out_of_label"]
    recall = lambda c: float(np.mean([predicted[p] == c for p in in_label if truth[p] == c]))  # noqa: E731
    normal = np.asarray([int(truth[p] != "healthy") for p in patients])
    abnormal_score = np.asarray([1.0 - mean[p][classes.index("healthy")] for p in patients])
    return {"in_label_accuracy": float(np.mean([predicted[p] == truth[p] for p in in_label])),
            "healthy_recall": recall("healthy"), "copd_recall": recall("copd"),
            "normal_vs_abnormal_auroc": float(roc_auc_score(normal, abnormal_score))}


def main() -> None:
    records, _ = load_development_records()
    kauh_dev = sorted({r.patient_id for r in records if r.source == "kauh"})
    base = [r for r in records if r.source != "kauh"]
    test = holdout_records()
    tables = {name: embeddings([*records, *test], name) for name in MEMBERS}
    classes = sorted({r.disease for r in records})
    copd = {r.patient_id for r in records if r.source == "kauh" and r.disease == "copd"}
    rng = random.Random(SEED)
    result: dict[str, object] = {"kauh_dev_patients": len(kauh_dev), "kauh_dev_copd_patients": len(copd),
                                 "holdout": "data/kauh_external_holdout_manifest_v2.csv", "curve": {}}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for k in K_VALUES:
            runs = []
            for _ in range(1 if k in (0, len(kauh_dev)) else DRAWS):
                if k == 0:
                    chosen: set[int] = set()
                elif k >= len(kauh_dev):
                    chosen = set(kauh_dev)
                else:  # at least one COPD patient, the rest drawn from all remaining KAUH patients
                    first = rng.choice(sorted(copd))
                    chosen = {first} | set(rng.sample(sorted(set(kauh_dev) - {first}), k - 1))
                train = base + [r for r in records if r.source == "kauh" and r.patient_id in chosen]
                runs.append(score(test, fused_probabilities(train, test, tables, classes), classes))
            result["curve"][str(k)] = {key: {"mean": float(np.mean([r[key] for r in runs])),
                                             "sd": float(np.std([r[key] for r in runs], ddof=1)) if len(runs) > 1 else 0.0}
                                       for key in runs[0]} | {"draws": len(runs)}
            print(k, {key: round(v["mean"], 3) for key, v in result["curve"][str(k)].items() if isinstance(v, dict)}, flush=True)
    (OUTPUT_DIR / "learning_curve.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
