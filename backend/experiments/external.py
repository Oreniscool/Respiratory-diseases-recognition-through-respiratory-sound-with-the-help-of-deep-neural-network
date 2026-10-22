"""External validation on KAUH patients that never appear in the training cohort.

Runs every recording of ``data/kauh_external_manifest.csv`` through the *served* prediction path
(``server.extract_mfcc`` → ``_predict_probabilities`` → ``_aggregate_window_probabilities``, i.e.
including fusion members, temperature and abstention), for the artifact selected by
``RESPINET_MODEL_PATH`` / ``RESPINET_MODEL_METADATA``. Pre-registered use: evaluated once for the
current served model and once for an adopted candidate; never used to choose between candidates.

Reported:
- in-label patients (healthy, COPD, bronchial — KAUH asthma/pneumonia patients are all in Kaggle):
  patient-level accuracy, balanced accuracy over the labels present, per-class sensitivity, and
  recording-level accuracy; a patient's score is the mean over all their recordings and filters;
- out-of-label patients (heart failure, lung fibrosis, pleural effusion, combined diagnoses): the
  share of recordings the service marks "uncertain", and what it predicts otherwise.

Usage (from ``backend/``)::

    RESPINET_MODEL_PATH=artifacts/latest/best_model.keras python -m experiments.external --name current
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.metrics import balanced_accuracy_score

from kauh import OUT_OF_LABEL

OUTPUT_DIR = Path("artifacts/experiments/external")


def summarize(rows: list[dict[str, object]], classes: list[str]) -> dict[str, object]:
    """Patient- and recording-level metrics from per-recording service outputs."""
    in_label = [row for row in rows if row["label"] != OUT_OF_LABEL]
    by_patient: dict[int, list[dict[str, object]]] = defaultdict(list)
    for row in in_label:
        by_patient[int(row["patient_id"])].append(row)
    truth, predicted = [], []
    for recordings in by_patient.values():
        mean = np.mean([row["probabilities"] for row in recordings], axis=0)
        truth.append(recordings[0]["label"])
        predicted.append(classes[int(np.argmax(mean))])
    truth, predicted = np.asarray(truth), np.asarray(predicted)
    present = sorted(set(truth))
    out_of_label = [row for row in rows if row["label"] == OUT_OF_LABEL]
    return {
        "in_label_patients": int(len(truth)),
        "in_label_recordings": len(in_label),
        "patient_counts": dict(Counter(truth.tolist())),
        "patient_accuracy": float(np.mean(truth == predicted)),
        "patient_balanced_accuracy": float(
            balanced_accuracy_score(truth, predicted) if len(present) > 1 else np.mean(truth == predicted)
        ),
        "patient_sensitivity": {
            label: float(np.mean(predicted[truth == label] == label)) for label in present
        },
        "patient_predictions": {
            label: dict(Counter(predicted[truth == label].tolist())) for label in present
        },
        "recording_accuracy": float(np.mean([row["model_prediction"] == row["label"] for row in in_label])),
        "recording_abstention_in_label": float(np.mean([row["uncertain"] for row in in_label])),
        "out_of_label_recordings": len(out_of_label),
        "out_of_label_abstention": float(np.mean([row["uncertain"] for row in out_of_label]))
        if out_of_label else None,
        "out_of_label_predictions": dict(Counter(row["model_prediction"] for row in out_of_label)),
    }


def assert_not_in_training(manifest: list[dict[str, str]], split_manifest: Path) -> None:
    """Refuse to call a patient "external" if the artifact's own split contains them."""
    if not split_manifest.is_file():
        return
    with split_manifest.open(newline="", encoding="utf-8") as handle:
        cohort = {int(row["patient_id"]) for row in csv.DictReader(handle)}
    shared = cohort & {int(row["patient_id"]) for row in manifest}
    if shared:
        raise SystemExit(f"{len(shared)} 'external' patients are in this model's cohort: {sorted(shared)[:5]}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--name", required=True, help="label for the output file, e.g. current")
    parser.add_argument(
        "--manifest",
        default="data/kauh_external_holdout_manifest.csv",
        help="KAUH patients to evaluate (the holdout half since round 2b; the full 72-patient "
        "manifest was used before the split)",
    )
    args = parser.parse_args()

    import server

    model = server.load_model_once()
    if server.CONTRACT is None:
        raise SystemExit(f"Model contract not verified: {server.MODEL_CONTRACT_ERROR}")
    with Path(args.manifest).open(newline="", encoding="utf-8") as handle:
        manifest = list(csv.DictReader(handle))
    assert_not_in_training(manifest, server.CONTRACT.metadata_path.parent / "split_manifest.csv")
    rows = []
    for index, entry in enumerate(manifest):
        path = Path(entry["path"])
        windows, audio, rate, lengths, _, yamnet_audio = server.extract_mfcc(
            path.read_bytes(), filename=path.name
        )
        payload, probabilities, _ = server._prediction_payload(
            model, windows, audio, rate, lengths, denoise=False, yamnet_audio=yamnet_audio
        )
        rows.append({
            "path": entry["path"], "patient_id": int(entry["patient_id"]), "label": entry["label"],
            "model_prediction": payload["model_prediction"], "uncertain": payload["uncertain"],
            "probabilities": [float(p) for p in probabilities],
        })
        if index % 50 == 0:
            print(f"[external] {index}/{len(manifest)}", flush=True)
    result = {
        "artifact": str(server.MODEL_PATH),
        "model_sha256": server.CONTRACT.metadata["model_sha256"],
        "source_revision": server.CONTRACT.metadata.get("source_revision"),
        **summarize(rows, server.CLASSES),
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / f"{args.name}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (OUTPUT_DIR / f"{args.name}_recordings.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "patient_predictions"}, indent=2))


if __name__ == "__main__":
    main()
