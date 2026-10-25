"""Analyses of the served model's per-recording test outputs (split v3, CPU export).

Reads ``backend/artifacts/experiments/served_test_predictions.json`` (from
``export_test_predictions.py``) and writes ``backend/artifacts/experiments/test_prediction_analyses.json``:

1. **In-cohort normal vs abnormal AUROC** (patient level, 1 − mean P(healthy)), the comparison
   point for the external KAUH AUROCs in ``binary_external.json``.
2. **Without the Kaggle remainder**: test metrics after dropping the patients whose clips have no
   traced origin (Kaggle clips matching neither ICBHI nor KAUH).
3. **Model vs the no-audio rule, paired**: patient balanced-accuracy difference between the served
   model and the source + stethoscope rule of ``source_baseline.py``, with a 2,000-draw paired
   patient bootstrap.

    python research/tools/test_prediction_analyses.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
from experiments.cv import recording_device  # noqa: E402
from experiments.shortcut import source_detail  # noqa: E402

ART = BACKEND / "artifacts/experiments"
DRAWS = 2_000


def patient_table(rows: list[dict], classes: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in rows:
        p = out.setdefault(r["patient_id"], {"label": r["disease"], "probs": [], "source": r["source"], "rule": []})
        p["probs"].append(r["probabilities"])
    for p in out.values():
        p["mean"] = np.mean(p["probs"], axis=0)
        p["pred"] = classes[int(np.argmax(p["mean"]))]
    return out


def main() -> None:
    data = json.loads((ART / "served_test_predictions.json").read_text())
    classes, rows = data["classes"], data["recordings"]
    patients = patient_table(rows, classes)
    ids = sorted(patients)
    truth = np.asarray([patients[p]["label"] for p in ids])
    pred = np.asarray([patients[p]["pred"] for p in ids])
    healthy = classes.index("healthy")
    abnormal = np.asarray([int(t != "healthy") for t in truth])
    score = np.asarray([1 - patients[p]["mean"][healthy] for p in ids])
    rng = np.random.default_rng(0)

    def boot_auc():
        values = []
        for _ in range(DRAWS):
            idx = rng.integers(0, len(ids), len(ids))
            if 0 < abnormal[idx].sum() < len(idx):
                values.append(roc_auc_score(abnormal[idx], score[idx]))
        return [float(x) for x in np.percentile(values, [2.5, 97.5])]

    result: dict[str, object] = {
        "source": "served_test_predictions.json (CPU)", "patients": len(ids),
        "check_patient_accuracy": float(accuracy_score(truth, pred)),
        "in_cohort_normal_vs_abnormal": {"auroc": float(roc_auc_score(abnormal, score)), "ci95": boot_auc(),
                                         "normal_patients": int((abnormal == 0).sum()), "abnormal_patients": int(abnormal.sum())},
    }

    # 2. without the Kaggle remainder (patients whose clips have no traced origin)
    remainder = {p for p in ids if source_detail(patients[p]["source"], int(p)) == "kaggle_unknown"}
    keep = np.asarray([p not in remainder for p in ids])
    result["without_kaggle_remainder"] = {
        "patients_removed": len(remainder), "patients_left": int(keep.sum()),
        "patient_accuracy": float(accuracy_score(truth[keep], pred[keep])),
        "patient_balanced_accuracy": float(balanced_accuracy_score(truth[keep], pred[keep])),
        "with_remainder": {"patient_accuracy": float(accuracy_score(truth, pred)),
                           "patient_balanced_accuracy": float(balanced_accuracy_score(truth, pred))},
    }

    # 3. paired model vs no-audio rule (rule refitted exactly as in source_baseline.py)
    baseline = json.loads((ART / "source_baseline.json").read_text())["split_v3_round2b"]["source+device"]["rule"]
    def rule_label(r):
        key = str((source_detail(r["source"], int(r["patient_id"])), recording_device(r["path"])))
        return baseline.get(key)
    fallback = Counter(baseline.values()).most_common(1)[0][0]
    for r in rows:
        patients[r["patient_id"]]["rule"].append(rule_label(r) or fallback)
    rule = np.asarray([Counter(patients[p]["rule"]).most_common(1)[0][0] for p in ids])
    diffs = []
    for _ in range(DRAWS):
        idx = rng.integers(0, len(ids), len(ids))
        if len(set(truth[idx])) == len(set(truth)):
            diffs.append(balanced_accuracy_score(truth[idx], pred[idx]) - balanced_accuracy_score(truth[idx], rule[idx]))
    diffs = np.asarray(diffs)
    result["model_minus_no_audio_rule"] = {
        "model_patient_balanced_accuracy": float(balanced_accuracy_score(truth, pred)),
        "rule_patient_balanced_accuracy": float(balanced_accuracy_score(truth, rule)),
        "difference": float(balanced_accuracy_score(truth, pred) - balanced_accuracy_score(truth, rule)),
        "ci95": [float(x) for x in np.percentile(diffs, [2.5, 97.5])],
        "p_model_better": float(np.mean(diffs > 0)),
    }
    (ART / "test_prediction_analyses.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
