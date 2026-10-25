"""Source-only baselines: predict the disease from where a recording came from, with no audio.

A rule learns the majority training label for each recording source and applies it to the test
split. If it comes close to a trained model, that model's score largely reflects the source.

- **Merged cohort** (split v3 → served round-2b model; split v2 → round-2 model). Keys are
  - ``source``: icbhi / kaggle_from_kauh / kaggle_unknown / kauh;
  - ``source+device``: the ICBHI stethoscope added.
  Fitted on train + validation recordings, scored on test. Patient prediction = majority vote over
  the patient's recordings.
- **X1 leak-free rung (L3, ICBHI only, the 2020 protocol)**: ``device`` rule, fitted on L3's
  training recordings for each of the 20 seeds and scored on L3's test recordings.

Writes ``backend/artifacts/experiments/source_baseline.json``.

    python research/tools/source_baseline.py
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
from experiments.cv import recording_device  # noqa: E402
from experiments.shortcut import source_detail  # noqa: E402


def rule_scores(rows: list[dict], key) -> dict[str, float]:
    fit = [r for r in rows if r["split"] in ("train", "validation")]
    test = [r for r in rows if r["split"] == "test"]
    overall = Counter(r["disease"] for r in fit).most_common(1)[0][0]
    table = {k: Counter(r["disease"] for r in fit if key(r) == k).most_common(1)[0][0] for k in {key(r) for r in fit}}
    predicted = [table.get(key(r), overall) for r in test]
    truth = [r["disease"] for r in test]
    patients: dict[str, list[int]] = {}
    for index, r in enumerate(test):
        patients.setdefault(r["patient_id"], []).append(index)
    p_truth = [truth[ix[0]] for ix in patients.values()]
    p_pred = [Counter(predicted[i] for i in ix).most_common(1)[0][0] for ix in patients.values()]
    return {"recording_accuracy": accuracy_score(truth, predicted),
            "recording_balanced_accuracy": balanced_accuracy_score(truth, predicted),
            "patient_accuracy": accuracy_score(p_truth, p_pred),
            "patient_balanced_accuracy": balanced_accuracy_score(p_truth, p_pred),
            "rule": table}


def merged(directory: str) -> dict[str, object]:
    with (BACKEND / "artifacts" / directory / "split_manifest.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    source = lambda r: source_detail(r["source"], int(r["patient_id"]))  # noqa: E731
    model = json.loads((BACKEND / "artifacts" / directory / "test_metrics.json").read_text())
    return {
        "source": rule_scores(rows, source),
        "source+device": rule_scores(rows, lambda r: (source(r), recording_device(r["path"])).__str__()),
        "model": {"recording_accuracy": model["recording_level"]["accuracy"],
                  "recording_balanced_accuracy": model["recording_level"]["balanced_accuracy"],
                  "patient_accuracy": model["patient_level"]["accuracy"],
                  "patient_balanced_accuracy": model["patient_level"]["balanced_accuracy"]},
    }


def x1_l3() -> dict[str, object]:
    from experiments.leakage_ladder import OUTPUT_DIR, split_indices

    stored = np.load(BACKEND / OUTPUT_DIR / "features.npz", allow_pickle=False)
    data = {k: stored[k] for k in stored.files if k != "X"}
    device = np.asarray([recording_device(name) for name in data["recording"]])
    scores = []
    for seed in range(20):
        parts = split_indices("L3", data, seed)
        train, test = parts["train"], parts["test"]
        table = {d: Counter(data["label"][train][device[train] == d]).most_common(1)[0][0]
                 for d in np.unique(device[train])}
        overall = Counter(data["label"][train]).most_common(1)[0][0]
        predicted = [table.get(d, overall) for d in device[test]]
        scores.append((accuracy_score(data["label"][test], predicted),
                       balanced_accuracy_score(data["label"][test], predicted)))
    acc, bal = np.asarray(scores).T
    with (BACKEND / OUTPUT_DIR / "results.csv").open(newline="", encoding="utf-8") as handle:
        model = {int(r["seed"]): float(r["balanced_accuracy"]) for r in csv.DictReader(handle) if r["rung"] == "L3"}
    paired = np.asarray([model[seed] - bal[seed] for seed in range(20)])  # same split per seed
    return {"device_rule": {"accuracy_mean": float(acc.mean()), "balanced_accuracy_mean": float(bal.mean()),
                            "balanced_accuracy_sd": float(bal.std(ddof=1)), "seeds": 20},
            "model_L3_balanced_accuracy_mean": float(np.mean(list(model.values()))),
            "model_minus_rule_balanced_accuracy": {"mean": float(paired.mean()), "sd": float(paired.std(ddof=1)),
                                                   "seeds_model_better": int((paired > 0).sum())}}


def main() -> None:
    result = {"split_v3_round2b": merged("latest"), "split_v2_round2": merged("fusion-round2-split2"), "x1_L3": x1_l3()}
    (BACKEND / "artifacts/experiments/source_baseline.json").write_text(json.dumps(result, indent=2, default=str),
                                                                       encoding="utf-8")
    for name in ("split_v3_round2b", "split_v2_round2"):
        for rule in ("source", "source+device", "model"):
            v = result[name][rule]
            print(f"{name:17s} {rule:14s} rec acc {v['recording_accuracy']:.3f} bal {v['recording_balanced_accuracy']:.3f} | "
                  f"patient acc {v['patient_accuracy']:.3f} bal {v['patient_balanced_accuracy']:.3f}")
    print("x1 L3", json.dumps(result["x1_L3"]))


if __name__ == "__main__":
    main()
