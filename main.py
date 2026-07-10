"""Patient-safe training entry point.

This module has no import-time side effects. It creates patient-level
train/validation/test splits before extracting or augmenting audio.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from evaluate import evaluate_model, evaluate_patient_level
from featureExtraction import AudioRecord, build_manifest, extract_manifest
from preprocessing import DEFAULT_PREPROCESSING


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train RespiNet without patient leakage")
    parser.add_argument("--dataset-dir", default="dataset/ICBHI_final_dataset")
    parser.add_argument("--diagnosis-csv", default="patient_diagnosis.csv")
    parser.add_argument("--output-dir", default="artifacts/latest")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--test-size", type=float, default=0.20)
    parser.add_argument("--validation-size", type=float, default=0.20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--healthy-class-multiplier", type=float, default=1.0)
    parser.add_argument(
        "--source-revision",
        default=os.getenv("RESPINET_SOURCE_REVISION", "unknown"),
        help="Git commit or immutable source revision recorded in model metadata",
    )
    parser.add_argument(
        "--exclude-patient",
        type=int,
        action="append",
        default=[],
        help="Explicit patient exclusion; repeat for multiple IDs and document why",
    )
    parser.add_argument(
        "--no-augmentation", action="store_true", help="Disable training augmentation"
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Write and validate patient splits without feature extraction or training",
    )
    return parser.parse_args()


def split_by_patient(
    records: list[AudioRecord],
    *,
    test_size: float,
    validation_size: float,
    seed: int,
) -> dict[str, list[AudioRecord]]:
    if test_size <= 0 or validation_size <= 0 or test_size + validation_size >= 1:
        raise ValueError("test_size and validation_size must be positive and sum to < 1")

    patient_labels: dict[int, str] = {}
    for record in records:
        previous = patient_labels.setdefault(record.patient_id, record.disease)
        if previous != record.disease:
            raise ValueError(f"Patient {record.patient_id} has multiple labels")

    patient_ids = np.asarray(sorted(patient_labels))
    labels = np.asarray([patient_labels[int(patient_id)] for patient_id in patient_ids])
    development_ids, test_ids = train_test_split(
        patient_ids,
        test_size=test_size,
        random_state=seed,
        stratify=labels,
    )
    development_labels = np.asarray(
        [patient_labels[int(patient_id)] for patient_id in development_ids]
    )
    relative_validation_size = validation_size / (1.0 - test_size)
    train_ids, validation_ids = train_test_split(
        development_ids,
        test_size=relative_validation_size,
        random_state=seed,
        stratify=development_labels,
    )

    patient_sets = {
        "train": set(map(int, train_ids)),
        "validation": set(map(int, validation_ids)),
        "test": set(map(int, test_ids)),
    }
    split_pairs = (
        ("train", "validation"),
        ("train", "test"),
        ("validation", "test"),
    )
    if any(patient_sets[left] & patient_sets[right] for left, right in split_pairs):
        raise RuntimeError("Patient leakage detected while building splits")

    return {
        split: [record for record in records if record.patient_id in patient_set]
        for split, patient_set in patient_sets.items()
    }


def _write_split_manifest(
    splits: dict[str, list[AudioRecord]], output_dir: Path
) -> str:
    rows = [
        {
            "split": split,
            "patient_id": record.patient_id,
            "disease": record.disease,
            "path": str(record.path),
        }
        for split, records in splits.items()
        for record in records
    ]
    frame = pd.DataFrame(rows).sort_values(["split", "patient_id", "path"])
    frame.to_csv(output_dir / "split_manifest.csv", index=False)
    return hashlib.sha256(frame.to_csv(index=False).encode("utf-8")).hexdigest()


def run_training(args: argparse.Namespace) -> None:
    random.seed(args.seed)
    np.random.seed(args.seed)

    diagnosis_path = Path(args.diagnosis_csv)
    if not diagnosis_path.is_file():
        raise FileNotFoundError(
            f"Diagnosis CSV not found: {diagnosis_path}. Refusing to create synthetic labels."
        )
    diagnoses = pd.read_csv(diagnosis_path)
    records = build_manifest(
        args.dataset_dir, diagnoses, excluded_patient_ids=args.exclude_patient
    )
    splits = split_by_patient(
        records,
        test_size=args.test_size,
        validation_size=args.validation_size,
        seed=args.seed,
    )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_hash = _write_split_manifest(splits, output_dir)

    print("Patient-level split summary:")
    split_summary = {}
    for split, split_records in splits.items():
        patients = {record.patient_id for record in split_records}
        class_counts = dict(Counter(record.disease for record in split_records))
        split_summary[split] = {
            "recordings": len(split_records),
            "patients": len(patients),
            "class_counts": class_counts,
        }
        print(
            f"  {split}: {len(split_records)} recordings, {len(patients)} patients, "
            f"classes={class_counts}"
        )
    with (output_dir / "split_summary.json").open("w", encoding="utf-8") as handle:
        json.dump(
            {"split_manifest_sha256": manifest_hash, "splits": split_summary},
            handle,
            indent=2,
        )
    if args.prepare_only:
        print("Prepare-only mode complete; feature extraction and training were skipped.")
        return

    from tensorflow.keras.utils import set_random_seed

    from train import train_model

    set_random_seed(args.seed)

    train_data = extract_manifest(
        splits["train"], augment=not args.no_augmentation, seed=args.seed
    )
    validation_data = extract_manifest(splits["validation"], augment=False, seed=args.seed)
    test_data = extract_manifest(splits["test"], augment=False, seed=args.seed)

    encoder = LabelEncoder()
    encoder.fit(sorted({record.disease for record in records}))
    class_names = list(encoder.classes_)
    identity = np.eye(len(class_names), dtype=np.float32)
    y_train = identity[encoder.transform(train_data.y)]
    y_validation = identity[encoder.transform(validation_data.y)]
    y_test = identity[encoder.transform(test_data.y)]

    healthy_index = class_names.index("Healthy") if "Healthy" in class_names else None
    model, _, model_path, class_weights = train_model(
        train_data.X,
        y_train,
        validation_data.X,
        y_validation,
        output_dir=output_dir,
        batch_size=args.batch_size,
        epochs=args.epochs,
        healthy_class_index=healthy_index,
        healthy_class_multiplier=args.healthy_class_multiplier,
    )

    test_probabilities = np.asarray(model.predict(test_data.X, verbose=0))
    metrics = {
        "recording_level": evaluate_model(y_test, test_probabilities, class_names),
        "patient_level": evaluate_patient_level(
            y_test, test_probabilities, test_data.patient_ids, class_names
        ),
    }
    with (output_dir / "test_metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    metadata = {
        "schema_version": 1,
        "source_revision": args.source_revision,
        "model_filename": model_path.name,
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "classes": class_names,
        "preprocessing": DEFAULT_PREPROCESSING.to_dict(),
        "training": {
            "seed": args.seed,
            "test_size": args.test_size,
            "validation_size": args.validation_size,
            "augmentation": not args.no_augmentation,
            "healthy_class_multiplier": args.healthy_class_multiplier,
            "class_weights": class_weights,
            "split_manifest_sha256": manifest_hash,
            "excluded_patient_ids": args.exclude_patient,
        },
        "evaluation_file": "test_metrics.json",
        "limitations": [
            "Research use only; not clinically validated.",
            "Evaluation is limited to the configured ICBHI patient split.",
        ],
    }
    with (output_dir / "model_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
    print(f"Saved model and evaluation artifacts to {output_dir}")


def main() -> None:
    run_training(parse_args())


if __name__ == "__main__":
    main()
