"""Dataset manifest creation and feature extraction.

The manifest is split by patient before this module is asked to augment any
audio.  This prevents recordings or augmented copies from leaking into
validation/test partitions.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import pandas as pd

from Augmentation import add_noise, shift, spec_augment, stretch
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
            # Normalise to lowercase so Kaggle's mixed-case folder names
            # (Bronchial, asthma, copd, healthy, pneumonia) and any ICBHI
            # reorganised folders all share a consistent label space.
            disease = parts[-2].lower()
        else:
            disease = "unknown"

        # Generate a unique deterministic patient_id based on disease class and patient prefix/relative path
        # to prevent cross-class ID collisions (e.g. Asthma/P1.wav vs Healthy/P1.wav) and hash seed variance
        match = re.match(r"^[pP]?(\d+)", path.name)
        if match:
            patient_key = f"{disease}_P{match.group(1)}"
        else:
            patient_key = f"{disease}_{path.relative_to(directory).as_posix()}"

        h = int(hashlib.sha256(patient_key.encode("utf-8")).hexdigest()[:12], 16)
        patient_id = 100000 + (h % 800000)

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
    max_variants: int | None = None,
) -> Sequence[tuple[str, np.ndarray]]:
    variants: list[tuple[str, np.ndarray]] = [("original", data)]
    if augment:
        augmented = [
            ("noise_20db", add_noise(data, snr_db=20.0, rng=rng)),
            ("shift_right_1600", shift(data, 1_600)),
            ("stretch_1.2", stretch(data, 1.2)),
            ("stretch_0.8", stretch(data, 0.8)),
        ]
        if max_variants is not None and 0 < max_variants < len(augmented):
            chosen_indices = rng.choice(len(augmented), size=max_variants, replace=False)
            augmented = [augmented[i] for i in sorted(chosen_indices)]
        variants.extend(augmented)
    return variants


def extract_manifest(
    records: Sequence[AudioRecord],
    *,
    augment: bool = False,
    use_spec_augment: bool = False,
    num_freq_masks: int = 2,
    max_freq_mask: int = 15,
    num_time_masks: int = 2,
    max_time_mask: int = 25,
    max_waveform_variants: int | None = None,
    seed: int = 42,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> ExtractedDataset:
    import gc

    rng = np.random.default_rng(seed)
    feature_chunks: list[np.ndarray] = []
    labels: list[str] = []
    patients: list[int] = []
    sources: list[str] = []
    variant_names: list[str] = []
    window_starts: list[int] = []
    valid_lengths: list[int] = []

    for idx, record in enumerate(records):
        data, sample_rate = load_audio(record.path, config=config)
        record_windows: list[np.ndarray] = []

        for variant_name, variant_audio in _variants(
            data, augment, rng, max_variants=max_waveform_variants
        ):
            sequence = extract_feature_sequence(variant_audio, sample_rate, config=config)
            windows, lengths, starts = window_feature_sequence(sequence, config=config)
            for window, length, start in zip(windows, lengths, starts):
                record_windows.append(window)
                labels.append(record.disease)
                patients.append(record.patient_id)
                sources.append(str(record.path))
                variant_names.append(variant_name)
                valid_lengths.append(int(length))
                window_starts.append(int(start))

                if augment and use_spec_augment:
                    spec_window = spec_augment(
                        window,
                        valid_length=int(length),
                        num_freq_masks=num_freq_masks,
                        max_freq_mask=max_freq_mask,
                        num_time_masks=num_time_masks,
                        max_time_mask=max_time_mask,
                        rng=rng,
                    )
                    record_windows.append(spec_window)
                    labels.append(record.disease)
                    patients.append(record.patient_id)
                    sources.append(str(record.path))
                    variant_names.append(f"{variant_name}_spec_aug")
                    valid_lengths.append(int(length))
                    window_starts.append(int(start))

        if record_windows:
            feature_chunks.append(np.asarray(record_windows, dtype=np.float32))

        # Periodic garbage collection every 100 recordings to free librosa/FFT caches
        if (idx + 1) % 100 == 0:
            gc.collect()

    if feature_chunks:
        X_all = np.concatenate(feature_chunks, axis=0)
    else:
        X_all = np.empty((0, config.max_len, config.feature_dim), dtype=np.float32)

    del feature_chunks
    gc.collect()

    return ExtractedDataset(
        X=X_all,
        y=np.asarray(labels),
        patient_ids=np.asarray(patients, dtype=np.int64),
        source_paths=np.asarray(sources),
        variants=np.asarray(variant_names),
        window_starts=np.asarray(window_starts, dtype=np.int32),
        valid_lengths=np.asarray(valid_lengths, dtype=np.int32),
    )

