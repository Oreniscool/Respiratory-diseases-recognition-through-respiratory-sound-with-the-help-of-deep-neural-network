"""SPRSound second-external-set analysis, exactly the outcomes pre-registered in D-32.

Input: ``backend/artifacts/experiments/external/sprsound_<name>_recordings.json`` (one row per recording,
from ``experiments/external_sprsound.py``) and the matching ``sprsound_<name>.json`` (classes). Recordings
listed in ``backend/data/sprsound_overlap.csv`` (fingerprint matches with training data) are excluded.
Output: ``backend/artifacts/experiments/sprsound_analysis.json``.

Patient score = mean over the patient's recordings of the calibrated probabilities. In-label classes:
healthy, asthma, pneumonia, bronchial (no COPD exists in this paediatric cohort). All intervals are 2,000-draw
patient-cluster bootstrap percentiles (seed 0).

    python research/tools/sprsound_analysis.py round2b round2split2
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr
from sklearn.metrics import balanced_accuracy_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[2]
EXT = ROOT / "backend/artifacts/experiments/external"
IN_LABEL = ("asthma", "bronchial", "healthy", "pneumonia")
DRAWS = 2_000


def load(name: str) -> tuple[list[dict], list[str]]:
    rows = json.loads((EXT / f"sprsound_{name}_recordings.json").read_text())
    classes = json.loads((EXT / f"sprsound_{name}.json").read_text())["classes"]
    overlap = ROOT / "backend/data/sprsound_overlap.csv"
    if overlap.is_file():
        with overlap.open(newline="", encoding="utf-8") as handle:
            drop = {r["sprsound"] for r in csv.DictReader(handle)}
        rows = [r for r in rows if r["path"] not in drop]
    return rows, classes


def patients(rows: list[dict], classes: list[str]) -> dict[str, dict]:
    """Per patient: label, age, mean probabilities over scored recordings, recording counts."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        groups[str(r["patient_id"])].append(r)
    out = {}
    for pid, recs in groups.items():
        scored = [r for r in recs if r["probabilities"] is not None]
        if not scored:
            continue
        mean = np.mean([r["probabilities"] for r in scored], axis=0)
        out[pid] = {"label": recs[0]["label"], "age": float(np.median([r["age"] for r in recs])),
                    "mean": mean, "pred": classes[int(np.argmax(mean))], "recordings": len(recs), "scored": len(scored)}
    return out


def ci(values: list[float]) -> list[float]:
    return [float(x) for x in np.percentile(values, [2.5, 97.5])]


def analyse(rows: list[dict], classes: list[str], seed: int = 0) -> dict[str, object]:
    pats = patients(rows, classes)
    in_label = {p: v for p, v in pats.items() if v["label"] in IN_LABEL}
    ids = sorted(in_label)
    truth = np.asarray([in_label[p]["label"] for p in ids])
    pred = np.asarray([in_label[p]["pred"] for p in ids])
    healthy = classes.index("healthy")
    abnormal = np.asarray([int(t != "healthy") for t in truth])
    score = np.asarray([1 - in_label[p]["mean"][healthy] for p in ids])
    age = np.asarray([in_label[p]["age"] for p in ids])
    p_healthy = np.asarray([in_label[p]["mean"][healthy] for p in ids])
    rng = np.random.default_rng(seed)
    bal, auc = [], []
    for _ in range(DRAWS):
        idx = rng.integers(0, len(ids), len(ids))
        if len(set(truth[idx])) == len(IN_LABEL):
            bal.append(balanced_accuracy_score(truth[idx], pred[idx]))
        if 0 < abnormal[idx].sum() < len(idx):
            auc.append(roc_auc_score(abnormal[idx], score[idx]))
    non_control = truth != "healthy"
    share_healthy = float(np.mean(pred[non_control] == "healthy"))
    h8 = "supported" if share_healthy >= 0.5 else "refuted" if share_healthy < 0.2 else "inconclusive"
    rho = spearmanr(age, p_healthy)
    n_pneumonia = int(np.sum(truth == "pneumonia"))
    # out-of-label and abstention (recording level, patient-cluster bootstrap)
    ool = [r for r in rows if r["label"] == "out_of_label" and r["uncertain"] is not None]
    inl = [r for r in rows if r["label"] in IN_LABEL and r["uncertain"] is not None]
    def rate(recs):
        g = defaultdict(list)
        for r in recs:
            g[str(r["patient_id"])].append(float(r["uncertain"]))
        return [np.asarray(v) for v in g.values()]
    a, b = rate(ool), rate(inl)
    def boot(groups):
        s, n = np.asarray([g.sum() for g in groups]), np.asarray([g.size for g in groups])
        d = rng.integers(0, len(groups), size=(DRAWS, len(groups)))
        return s[d].sum(1) / n[d].sum(1)
    diff = boot(a) - boot(b)
    labels_present = list(IN_LABEL)
    return {
        "recordings": len(rows), "gate_rejected": sum(r["model_prediction"] == "gate_rejected" for r in rows),
        "gate_rejected_by_label": dict(Counter(r["label"] for r in rows if r["model_prediction"] == "gate_rejected")),
        "patients_in_label": len(ids), "patient_counts": dict(Counter(truth.tolist())),
        "P1_patient_balanced_accuracy": {"value": float(balanced_accuracy_score(truth, pred)), "ci95": ci(bal), "chance": 0.25},
        "patient_accuracy": float(np.mean(truth == pred)),
        "constant_pneumonia_accuracy": n_pneumonia / len(ids),
        "per_class_recall": {c: float(np.mean(pred[truth == c] == c)) for c in labels_present},
        "confusion": {c: dict(Counter(pred[truth == c].tolist())) for c in labels_present},
        "P2_healthy_vs_diseased_auroc": {"value": float(roc_auc_score(abnormal, score)), "ci95": ci(auc),
                                         "healthy_patients": int((abnormal == 0).sum()), "diseased_patients": int(abnormal.sum())},
        "H7": "supported (no transfer)" if roc_auc_score(abnormal, score) < 0.70 else "rejected (transfers)",
        "H8_share_of_non_control_predicted_healthy": share_healthy, "H8": h8,
        "spearman_age_vs_p_healthy": {"rho": float(rho.statistic), "p": float(rho.pvalue)},
        "age_only_auroc_older_is_diseased": float(roc_auc_score(abnormal, age)),
        "share_all_in_label_predicted_healthy": float(np.mean(pred == "healthy")),
        "predicted_label_distribution": dict(Counter(pred.tolist())),
        "abstention": {"in_label": float(np.mean([r["uncertain"] for r in inl])) if inl else None,
                       "out_of_label": float(np.mean([r["uncertain"] for r in ool])) if ool else None,
                       "difference_ci95": ci(diff) if len(a) and len(b) else None, "out_of_label_patients": len(a)},
    }


def paired(rows_a, rows_b, classes_a, classes_b, seed: int = 0) -> dict[str, object]:
    pa, pb = patients(rows_a, classes_a), patients(rows_b, classes_b)
    ids = sorted(p for p in pa if p in pb and pa[p]["label"] in IN_LABEL)
    truth = np.asarray([pa[p]["label"] for p in ids])
    a = np.asarray([pa[p]["pred"] for p in ids])
    b = np.asarray([pb[p]["pred"] for p in ids])
    rng = np.random.default_rng(seed)
    diffs = []
    for _ in range(DRAWS):
        idx = rng.integers(0, len(ids), len(ids))
        if len(set(truth[idx])) == len(IN_LABEL):
            diffs.append(balanced_accuracy_score(truth[idx], a[idx]) - balanced_accuracy_score(truth[idx], b[idx]))
    return {"patients": len(ids), "balanced_accuracy_a_minus_b": float(balanced_accuracy_score(truth, a) - balanced_accuracy_score(truth, b)),
            "ci95": ci(diffs)}


def main() -> None:
    names = sys.argv[1:] or ["round2b", "round2split2"]
    loaded = {n: load(n) for n in names}
    result = {n: analyse(*loaded[n]) for n in names}
    if len(names) == 2:
        (rows_a, classes_a), (rows_b, classes_b) = loaded[names[0]], loaded[names[1]]
        result["paired_first_minus_second"] = paired(rows_a, rows_b, classes_a, classes_b)
    (ROOT / "backend/artifacts/experiments/sprsound_analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    for n in names:
        r = result[n]
        print(f"{n}: P1 bal.acc {r['P1_patient_balanced_accuracy']['value']:.3f} {r['P1_patient_balanced_accuracy']['ci95']}, "
              f"P2 AUROC {r['P2_healthy_vs_diseased_auroc']['value']:.3f} {r['P2_healthy_vs_diseased_auroc']['ci95']}, "
              f"H7 {r['H7']}, H8 {r['H8']} ({r['H8_share_of_non_control_predicted_healthy']:.2f} of non-control predicted healthy)")


if __name__ == "__main__":
    main()
