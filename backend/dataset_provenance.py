"""Dataset provenance and class-support checks for reproducible experiments."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd


ICBHI_2017_PATIENT_COUNTS = {
    "Asthma": 1,
    "Bronchiectasis": 7,
    "Bronchiolitis": 6,
    "COPD": 64,
    "Healthy": 26,
    "LRTI": 2,
    "Pneumonia": 6,
    "URTI": 14,
}


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_and_validate_provenance(
    diagnosis_path: str | Path,
    provenance_path: str | Path,
) -> dict[str, object]:
    """Validate a declared ICBHI label source before model training starts.

    The repository intentionally ships no provenance file for its historical
    labels, so callers must supply an authorized record with the exact checksum.
    """
    provenance_path = Path(provenance_path)
    if not provenance_path.is_file():
        raise FileNotFoundError(
            "Dataset provenance is required. Provide --dataset-provenance with an "
            "authorized ICBHI label record."
        )
    with provenance_path.open(encoding="utf-8") as handle:
        provenance = json.load(handle)
    required = {
        "dataset_name",
        "source_url",
        "download_date",
        "license",
        "diagnosis_sha256",
        "label_counts",
    }
    missing = sorted(required.difference(provenance))
    if missing:
        raise ValueError(f"Dataset provenance is missing fields: {missing}")
    if provenance["dataset_name"] != "ICBHI 2017 Respiratory Sound Database":
        raise ValueError("Dataset provenance does not identify the supported ICBHI dataset")
    try:
        date.fromisoformat(str(provenance["download_date"]))
    except ValueError as error:
        raise ValueError("download_date must use ISO format YYYY-MM-DD") from error

    actual_hash = sha256_file(diagnosis_path)
    if provenance["diagnosis_sha256"] != actual_hash:
        raise ValueError("Diagnosis CSV checksum does not match dataset provenance")
    if provenance["label_counts"] != ICBHI_2017_PATIENT_COUNTS:
        raise ValueError(
            "Provenance label_counts do not match the published ICBHI 2017 patient distribution"
        )

    diagnoses = pd.read_csv(diagnosis_path)
    observed = dict(Counter(diagnoses["disease"].dropna().astype(str).str.strip()))
    if observed != ICBHI_2017_PATIENT_COUNTS:
        raise ValueError(
            "Diagnosis CSV label counts do not match the authentic ICBHI 2017 distribution"
        )
    return provenance


def build_dataset_audit(
    records: list[object], diagnosis_path: str | Path, provenance: dict[str, object]
) -> dict[str, object]:
    """Capture non-sensitive source, label, and audio inventory evidence for a run."""
    patients = {int(record.patient_id) for record in records}
    label_counts = Counter(str(record.disease) for record in records)
    audio_inventory = []
    for record in records:
        path = Path(record.path)
        audio_inventory.append(
            {
                "path": path.name,
                "sha256": sha256_file(path),
                "patient_id": int(record.patient_id),
                "disease": str(record.disease),
            }
        )
    inventory_json = json.dumps(sorted(audio_inventory, key=lambda row: row["path"]), sort_keys=True)
    return {
        "dataset": provenance["dataset_name"],
        "source_url": provenance["source_url"],
        "download_date": provenance["download_date"],
        "license": provenance["license"],
        "diagnosis_sha256": sha256_file(diagnosis_path),
        "recordings": len(records),
        "patients": len(patients),
        "recording_label_counts": dict(sorted(label_counts.items())),
        "audio_inventory_sha256": hashlib.sha256(inventory_json.encode("utf-8")).hexdigest(),
    }


def assert_three_way_class_support(patient_labels: dict[int, str]) -> None:
    """Reject label sets that cannot occupy train, validation, and test patients."""
    counts = Counter(patient_labels.values())
    unsupported = {label: count for label, count in counts.items() if count < 3}
    if unsupported:
        details = ", ".join(f"{label}={count}" for label, count in sorted(unsupported.items()))
        raise ValueError(
            "A patient-disjoint three-way disease split is infeasible because these "
            f"classes have fewer than three patients: {details}. Redesign the task "
            "or merge labels before training."
        )
