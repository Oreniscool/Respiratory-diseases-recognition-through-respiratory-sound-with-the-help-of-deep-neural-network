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
    # Both the declared and the observed counts must equal the *published* distribution.
    # A provenance file cannot vouch for itself: self-declared counts are not accepted.
    if provenance["label_counts"] != ICBHI_2017_PATIENT_COUNTS:
        raise ValueError(
            "Provenance label_counts do not match the published ICBHI 2017 patient distribution"
        )
    assert_authentic_icbhi_labels(pd.read_csv(diagnosis_path))
    return provenance


def icbhi_patient_label_counts(diagnoses: pd.DataFrame) -> dict[str, int]:
    """Count diagnoses per unique patient (one row per patient in the ICBHI CSV)."""
    if not {"patient_id", "disease"}.issubset(diagnoses.columns):
        raise ValueError("Diagnosis CSV must have 'patient_id' and 'disease' columns")
    clean = diagnoses.loc[:, ["patient_id", "disease"]].dropna()
    clean = clean.assign(disease=clean["disease"].astype(str).str.strip())
    return dict(Counter(clean.drop_duplicates("patient_id")["disease"]))


def assert_authentic_icbhi_labels(diagnoses: pd.DataFrame) -> None:
    """Reject diagnosis tables whose per-patient counts differ from the published ICBHI set."""
    observed = icbhi_patient_label_counts(diagnoses)
    if observed != ICBHI_2017_PATIENT_COUNTS:
        raise ValueError(
            "Diagnosis CSV label counts do not match the authentic ICBHI 2017 distribution "
            f"(observed {dict(sorted(observed.items()))}). The repository's "
            "patient_diagnosis.csv is deliberately scrambled; use the authentic labels."
        )


def build_dataset_audit(
    records: list[object], diagnosis_path: str | Path, provenance: dict[str, object]
) -> dict[str, object]:
    """Capture non-sensitive source, label, and audio inventory evidence for a run."""
    return {
        "dataset": provenance["dataset_name"],
        "source_url": provenance["source_url"],
        "download_date": provenance["download_date"],
        "license": provenance["license"],
        "diagnosis_sha256": sha256_file(diagnosis_path),
        **_cohort_summary(records),
    }


def build_folder_dataset_audit(
    records: list[object], dataset_dirs: list[str | Path]
) -> dict[str, object]:
    """Audit evidence for class-folder datasets, which carry no diagnosis CSV of their own."""
    return {
        "dataset": "Class-folder audio datasets",
        "dataset_dirs": [str(directory) for directory in dataset_dirs],
        "diagnosis_sha256": "not-applicable: labels come from class folder names",
        **_cohort_summary(records),
    }


def _cohort_summary(records: list[object]) -> dict[str, object]:
    """Counts plus a content hash of every audio file, so a cohort can be re-identified exactly."""
    audio_inventory = sorted(
        (
            {
                "source": str(getattr(record, "source", "primary")),
                "path": Path(record.path).name,
                "sha256": sha256_file(record.path),
                "patient_id": int(record.patient_id),
                "disease": str(record.disease),
            }
            for record in records
        ),
        key=lambda row: (row["source"], row["path"]),
    )
    inventory_json = json.dumps(audio_inventory, sort_keys=True)
    per_source: dict[str, dict[str, object]] = {}
    for source in sorted({row["source"] for row in audio_inventory}):
        rows = [row for row in audio_inventory if row["source"] == source]
        per_source[source] = {
            "recordings": len(rows),
            "patients": len({row["patient_id"] for row in rows}),
            "recording_label_counts": dict(sorted(Counter(row["disease"] for row in rows).items())),
        }
    return {
        "recordings": len(audio_inventory),
        "patients": len({row["patient_id"] for row in audio_inventory}),
        "recording_label_counts": dict(
            sorted(Counter(row["disease"] for row in audio_inventory).items())
        ),
        "per_source": per_source,
        "audio_inventory_sha256": hashlib.sha256(inventory_json.encode("utf-8")).hexdigest(),
    }


LABEL_MAPPING_4CLASS = {
    "COPD": "COPD",
    "Healthy": "Healthy",
    "Bronchiectasis": "Non_COPD_Chronic",
    "Asthma": "Non_COPD_Chronic",
    "URTI": "Acute_Infection",
    "Pneumonia": "Acute_Infection",
    "Bronchiolitis": "Acute_Infection",
    "LRTI": "Acute_Infection",
}


def map_disease_labels(disease: str, group_mode: str = "4-class") -> str:
    """Map rare ICBHI disease labels into balanced task categories."""
    if group_mode == "4-class":
        return LABEL_MAPPING_4CLASS.get(disease, disease)
    return disease


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
