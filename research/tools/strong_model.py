"""Frozen AST next to the other embedding members: CV metrics, probes and leave-one-source-out.

Reads the out-of-fold files of ``experiments/cv.py embed`` (``oof_E_<name>.csv``), the probe results
(``shortcut_probes.json``) and ``loso.json``, and writes ``backend/artifacts/experiments/ast_summary.json``.
Patient-level metrics come from the mean of each patient's calibrated OOF probabilities. The paired
patient bootstrap (2,000 draws) compares AST with HeAR.

    python research/tools/strong_model.py
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.metrics import balanced_accuracy_score, f1_score

ART = Path(__file__).resolve().parents[2] / "backend/artifacts/experiments"
CLASSES = ["asthma", "bronchial", "copd", "healthy", "pneumonia"]
MEMBERS = ["yamnet", "opera_ce", "hear", "ast"]


def patient_predictions(name: str) -> dict[str, tuple[str, str]]:
    groups: dict[str, list] = defaultdict(list)
    with (ART / f"oof_E_{name}.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            groups[row["patient_id"]].append((row["label"], [float(row[f"p_{c}"]) for c in CLASSES]))
    return {p: (rows[0][0], CLASSES[int(np.argmax(np.mean([r[1] for r in rows], axis=0)))]) for p, rows in groups.items()}


def main() -> None:
    preds = {m: patient_predictions(m) for m in MEMBERS}
    ids = sorted(preds["ast"])
    out: dict[str, object] = {"cv_patient_level": {}}
    for m in MEMBERS:
        truth = [preds[m][p][0] for p in ids]
        guess = [preds[m][p][1] for p in ids]
        out["cv_patient_level"][m] = {"balanced_accuracy": float(balanced_accuracy_score(truth, guess)),
                                      "macro_f1": float(f1_score(truth, guess, average="macro"))}
    truth = np.asarray([preds["ast"][p][0] for p in ids])
    ast, hear = np.asarray([preds["ast"][p][1] for p in ids]), np.asarray([preds["hear"][p][1] for p in ids])
    rng = np.random.default_rng(0)
    diffs = []
    for _ in range(2_000):
        idx = rng.integers(0, len(ids), len(ids))
        if len(set(truth[idx])) == len(CLASSES):
            diffs.append(balanced_accuracy_score(truth[idx], ast[idx]) - balanced_accuracy_score(truth[idx], hear[idx]))
    out["ast_minus_hear_balanced_accuracy"] = {
        "difference": float(balanced_accuracy_score(truth, ast) - balanced_accuracy_score(truth, hear)),
        "ci95": [float(x) for x in np.percentile(diffs, [2.5, 97.5])], "p_ast_better": float(np.mean(np.asarray(diffs) > 0))}
    probes = json.loads((ART / "shortcut_probes.json").read_text())
    out["probes"] = {m: {k: probes[m][k] for k in ("dataset_of_origin", "icbhi_device", "disease")} for m in MEMBERS}
    loso = json.loads((ART / "loso.json").read_text())
    out["loso_held_out_auroc"] = {m: {s: loso[m]["held_out_source"][s]["auroc"] for s in loso[m]["held_out_source"]}
                                  for m in MEMBERS if m in loso}
    (ART / "ast_summary.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
