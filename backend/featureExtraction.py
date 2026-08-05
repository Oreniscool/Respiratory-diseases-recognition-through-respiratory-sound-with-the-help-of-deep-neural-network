"""Dataset manifest creation and feature extraction.

The manifest is split by patient before this module is asked to augment any
audio.  This prevents recordings or augmented copies from leaking into
validation/test partitions.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import pandas as pd

from Augmentation import add_noise, shift, stretch
from preprocessing import (
    DEFAULT_PREPROCESSING,
    PreprocessingConfig,
    extract_feature_sequence,
    load_audio,
    window_feature_sequence,
)


@dataclass(frozen=True)
class AudioRecord:
    path: Path
    patient_id: int
    disease: str


@dataclass
class ExtractedDataset:
    X: np.ndarray
    y: np.ndarray
    patient_ids: np.ndarray
    source_paths: np.ndarray
    variants: np.ndarray
    window_starts: np.ndarray
    valid_lengths: np.ndarray


def _validate_diagnoses(diagnoses: pd.DataFrame) -> dict[int, str]:
    required = {"patient_id", "disease"}
    missing = required.difference(diagnoses.columns)
    if missing:
        raise ValueError(f"Diagnosis CSV is missing columns: {sorted(missing)}")

    clean = diagnoses.loc[:, ["patient_id", "disease"]].dropna().copy()
    clean["patient_id"] = clean["patient_id"].astype(int)
    clean["disease"] = clean["disease"].astype(str).str.strip()
    clean = clean[clean["disease"] != ""]

    conflicts = clean.groupby("patient_id")["disease"].nunique()
    conflicting_ids = conflicts[conflicts > 1].index.tolist()
    if conflicting_ids:
        raise ValueError(f"Patients have conflicting diagnoses: {conflicting_ids}")
    return clean.drop_duplicates("patient_id").set_index("patient_id")["disease"].to_dict()


def build_manifest(
    directory: str | Path,
    diagnoses: pd.DataFrame,
    excluded_patient_ids: Iterable[int] = (),
) -> list[AudioRecord]:
    directory = Path(directory)
    if not directory.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {directory}")

    diagnosis_by_patient = _validate_diagnoses(diagnoses)
    excluded = {int(patient_id) for patient_id in excluded_patient_ids}
    records: list[AudioRecord] = []
    missing_labels: set[int] = set()

    for path in sorted(directory.glob("*.wav")):
        try:
            patient_id = int(path.name.split("_", 1)[0])
        except (TypeError, ValueError):
            raise ValueError(f"Cannot parse patient ID from audio filename: {path.name}")
        if patient_id in excluded:
            continue
        disease = diagnosis_by_patient.get(patient_id)
        if disease is None:
            missing_labels.add(patient_id)
            continue
        records.append(AudioRecord(path=path, patient_id=patient_id, disease=disease))

    if missing_labels:
        raise ValueError(
            "Audio files have no diagnosis entry for patient IDs: "
            f"{sorted(missing_labels)}"
        )
    if not records:
        raise ValueError(f"No labelled .wav recordings found in {directory}")
    return records


AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".ogg", ".aac"}


def build_manifest_from_folders(
    directory: str | Path,
    excluded_patient_ids: Iterable[int] = (),
) -> list[AudioRecord]:
    """Build a manifest from subdirectories where each class folder contains audio files."""
    directory = Path(directory)
    if not directory.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {directory}")

    excluded = {int(patient_id) for patient_id in excluded_patient_ids}

    # Find all audio files recursively inside directory
    all_audio_paths = [
        p for p in directory.rglob("*")
        if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS
    ]

    if not all_audio_paths:
        raise ValueError(
            f"No audio files ({', '.join(sorted(AUDIO_EXTENSIONS))}) found in {directory}"
        )

    records: list[AudioRecord] = []

    for path in sorted(all_audio_paths):
        rel = path.relative_to(directory)
        parts = rel.parts
        if len(parts) > 1:
            disease = parts[-2]
        else:
            disease = "Unknown"

        # Generate a unique deterministic patient_id based on relative file path
        # to prevent cross-class ID collisions (e.g. Asthma/1.wav vs Healthy/1.wav)
        patient_id = 100000 + (abs(hash(path.as_posix())) % 800000)

        if patient_id in excluded:
            continue

        records.append(AudioRecord(path=path, patient_id=patient_id, disease=disease))

    if not records:
        raise ValueError(f"No valid audio records found after exclusions in {directory}")

    return records


def _variants(
    data: np.ndarray,
    augment: bool,
    rng: np.random.Generator,
) -> Sequence[tuple[str, np.ndarray]]:
    variants: list[tuple[str, np.ndarray]] = [("original", data)]
    if augment:
        variants.extend(
            [
                ("noise_20db", add_noise(data, snr_db=20.0, rng=rng)),
                ("shift_right_1600", shift(data, 1_600)),
                ("stretch_1.2", stretch(data, 1.2)),
                ("stretch_0.8", stretch(data, 0.8)),
            ]
        )
    return variants


def extract_manifest(
    records: Sequence[AudioRecord],
    *,
    augment: bool = False,
    seed: int = 42,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> ExtractedDataset:
    rng = np.random.default_rng(seed)
    features: list[np.ndarray] = []
    labels: list[str] = []
    patients: list[int] = []
    sources: list[str] = []
    variant_names: list[str] = []
    window_starts: list[int] = []
    valid_lengths: list[int] = []

    for record in records:
        data, sample_rate = load_audio(record.path, config=config)
        for variant_name, variant_audio in _variants(data, augment, rng):
            sequence = extract_feature_sequence(variant_audio, sample_rate, config=config)
            windows, lengths, starts = window_feature_sequence(sequence, config=config)
            for window, length, start in zip(windows, lengths, starts):
                features.append(window)
                labels.append(record.disease)
                patients.append(record.patient_id)
                sources.append(str(record.path))
                variant_names.append(variant_name)
                valid_lengths.append(int(length))
                window_starts.append(int(start))

    return ExtractedDataset(
        X=np.asarray(features, dtype=np.float32),
        y=np.asarray(labels),
        patient_ids=np.asarray(patients, dtype=np.int64),
        source_paths=np.asarray(sources),
        variants=np.asarray(variant_names),
        window_starts=np.asarray(window_starts, dtype=np.int32),
        valid_lengths=np.asarray(valid_lengths, dtype=np.int32),
    )
