"""Control C4 — how much does Kaggle V2's ICBHI content inflate an "ICBHI as external test" evaluation?

Published work (e.g. Saky et al., Life 2026) trains on the Kaggle Asthma Detection Dataset V2 and
tests on ICBHI as an external set. 631 Kaggle clips are cuts of ICBHI recordings
(``data/kaggle_icbhi_overlap.csv``), so such a test partly re-uses training audio.

For a model trained on Kaggle V2 only (``main.py --dataset-format folder``, optionally with
``--exclude-icbhi-copies``), this scores **every** ICBHI recording through the served prediction
path and splits the result by whether that recording (or its patient) was copied into Kaggle:

- ``copied_recording``: the ICBHI recording is the source of at least one Kaggle clip;
- ``copied_patient``: another recording of the same ICBHI patient was copied;
- ``clean``: the patient contributed nothing to Kaggle.

Within one model, accuracy on copied vs clean recordings of the same class measures the
contamination directly. Comparing with a model trained without the copies shows what an honest
"external" ICBHI score would be (that model has no COPD class: every Kaggle COPD clip is ICBHI).

Usage (from ``backend/``; model from RESPINET_MODEL_PATH / RESPINET_MODEL_METADATA)::

    python -m experiments.contamination --name kaggle_all
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

import numpy as np

OUTPUT_DIR = Path("artifacts/experiments/contamination")
ICBHI_FOLDERS = Path("dataset/ICBHI_as_folders")
OVERLAP_CSV = Path("data/kaggle_icbhi_overlap.csv")


def copy_status() -> tuple[set[str], set[str]]:
    """(ICBHI recordings copied into Kaggle, ICBHI patients with any copied recording)."""
    with OVERLAP_CSV.open(newline="", encoding="utf-8") as handle:
        recordings = {row["reference"] for row in csv.DictReader(handle) if row["is_overlap"] == "True"}
    return recordings, {name.split("_", 1)[0] for name in recordings}


def status_of(name: str, copied_recordings: set[str], copied_patients: set[str]) -> str:
    if name in copied_recordings:
        return "copied_recording"
    return "copied_patient" if name.split("_", 1)[0] in copied_patients else "clean"


def summarize(rows: list[dict[str, object]]) -> dict[str, object]:
    out: dict[str, object] = {}
    for status in ("copied_recording", "copied_patient", "clean"):
        for label in sorted({r["label"] for r in rows}):
            subset = [r for r in rows if r["status"] == status and r["label"] == label]
            if subset:
                out[f"{status}/{label}"] = {
                    "recordings": len(subset),
                    "patients": len({r["patient_id"] for r in subset}),
                    "accuracy": float(np.mean([r["prediction"] == label for r in subset])),
                    "predictions": dict(Counter(r["prediction"] for r in subset)),
                }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    import server

    model = server.load_model_once()
    if server.CONTRACT is None:
        raise SystemExit(f"Model contract not verified: {server.MODEL_CONTRACT_ERROR}")
    copied_recordings, copied_patients = copy_status()
    rows = []
    paths = sorted(ICBHI_FOLDERS.glob("*/*.wav"))
    for index, path in enumerate(paths):
        windows, data, rate, lengths, _, yamnet_audio = server.extract_mfcc(path.read_bytes(), filename=path.name)
        payload, _, _ = server._prediction_payload(
            model, windows, data, rate, lengths, denoise=False, yamnet_audio=yamnet_audio
        )
        rows.append({"recording": path.name, "patient_id": path.name.split("_", 1)[0], "label": path.parent.name,
                     "status": status_of(path.name, copied_recordings, copied_patients),
                     "prediction": payload["model_prediction"]})
        if index % 100 == 0:
            print(f"[c4] {index}/{len(paths)}", flush=True)
    result = {"artifact": str(server.MODEL_PATH), "classes": server.CLASSES,
              "source_revision": server.CONTRACT.metadata.get("source_revision"), "summary": summarize(rows)}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / f"{args.name}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (OUTPUT_DIR / f"{args.name}_recordings.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()
