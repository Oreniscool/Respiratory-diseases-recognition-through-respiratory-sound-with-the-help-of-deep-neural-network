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
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from calibration import apply_temperature, fit_abstention_policy, fit_temperature
from dataset_provenance import (
    assert_three_way_class_support,
    build_dataset_audit,
    load_and_validate_provenance,
    map_disease_labels,
)
from evaluate import (
    aggregate_probabilities_by_group,
    bootstrap_patient_confidence_intervals,
    evaluate_model,
    evaluate_patient_level,
)
from featureExtraction import (
    AudioRecord,
    build_manifest,
    build_manifest_from_folders,
    extract_manifest,
)
from preprocessing import DEFAULT_PREPROCESSING


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train RespiNet without patient leakage")
    parser.add_argument("--dataset-dir", default="dataset/ICBHI_final_dataset")
    parser.add_argument("--diagnosis-csv", default="patient_diagnosis.csv")
    parser.add_argument(
        "--dataset-provenance",
        default="dataset_provenance.json",
        help="Authorized dataset provenance JSON containing the diagnosis checksum",
    )
    parser.add_argument("--output-dir", default="artifacts/latest")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--test-size", type=float, default=0.20)
    parser.add_argument("--validation-size", type=float, default=0.20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--healthy-class-multiplier", type=float, default=1.0)
    parser.add_argument("--bootstrap-samples", type=int, default=1_000)
    parser.add_argument("--abstention-coverage", type=float, default=0.80)
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
        "--no-spec-augment",
        action="store_true",
        help="Disable SpecAugment feature masking during training",
    )
    parser.add_argument(
        "--num-freq-masks",
        type=int,
        default=2,
        help="Number of SpecAugment frequency mask strips (default: 2)",
    )
    parser.add_argument(
        "--max-freq-mask",
        type=int,
        default=15,
        help="Maximum width of SpecAugment frequency mask strip (default: 15)",
    )
    parser.add_argument(
        "--num-time-masks",
        type=int,
        default=2,
        help="Number of SpecAugment time mask strips (default: 2)",
    )
    parser.add_argument(
        "--max-time-mask",
        type=int,
        default=25,
        help="Maximum width of SpecAugment time mask strip (default: 25)",
    )
    parser.add_argument(
        "--offline-spec-augment",
        action="store_true",
        help="Pre-generate static SpecAugment windows during extraction (higher RAM usage; default is dynamic on-the-fly)",
    )
    parser.add_argument(
        "--max-waveform-variants",
        type=int,
        default=None,
        help="Limit number of audio waveform augmentation variants per file (default: all 4 variants)",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Write and validate patient splits without feature extraction or training",
    )
    parser.add_argument(
        "--dataset-format",
        choices=["icbhi", "folder"],
        default="icbhi",
        help="Dataset format: 'icbhi' (ICBHI filename + CSV) or 'folder' (subdirectories as class labels)",
    )
    parser.add_argument(
        "--group-classes",
        choices=["4-class", "none"],
        default="4-class",
        help="Map rare ICBHI classes into balanced categories (4-class or none)",
    )
    parser.add_argument(
        "--use-focal-loss",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Categorical focal loss (default) or --no-use-focal-loss for cross entropy",
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=3e-4,
        help="Initial Adamax learning rate for the cosine-decay schedule (default: 3e-4)",
    )
    parser.add_argument(
        "--label-smoothing",
        type=float,
        default=0.1,
        help="Label smoothing factor (default: 0.1)",
    )
    parser.add_argument(
        "--extra-dataset-dir",
        action="append",
        default=[],
        metavar="DIR",
        help=(
            "Additional folder-format dataset directory to merge with the primary "
            "dataset before splitting.  Each directory must contain audio files "
            "organised in class subfolders (same format as --dataset-format folder). "
            "Repeat this flag for each extra directory.  Use reorganize_icbhi.py to "
            "convert the ICBHI flat layout into the required folder structure."
        ),
    )
    parser.add_argument(
        "--merge-icbhi",
        action="store_true",
        help="Automatically merge the ICBHI dataset (backend/dataset/ICBHI_as_folders) into the training cohort",
    )
    return parser.parse_args()


def resolve_dataset_paths(args: argparse.Namespace) -> None:
    """Automatically resolve dataset paths without requiring long paths with spaces."""
    backend_dir = Path(__file__).resolve().parent
    kaggle_candidate = (
        backend_dir
        / "dataset"
        / "Asthma_Detection_V2"
        / "Asthma Detection Dataset Version 2"
        / "Asthma Detection Dataset Version 2"
    )
    icbhi_candidate = backend_dir / "dataset" / "ICBHI_as_folders"

    if args.dataset_format == "folder":
        if args.dataset_dir in ("dataset/ICBHI_final_dataset", "auto", "kaggle", "default"):
            if kaggle_candidate.is_dir():
                args.dataset_dir = str(kaggle_candidate)

    if args.merge_icbhi:
        if icbhi_candidate.is_dir() and str(icbhi_candidate) not in args.extra_dataset_dir:
            args.extra_dataset_dir.append(str(icbhi_candidate))



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

    assert_three_way_class_support(patient_labels)

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
    resolve_dataset_paths(args)
    random.seed(args.seed)
    np.random.seed(args.seed)

    if args.dataset_format == "folder":
        records = build_manifest_from_folders(
            args.dataset_dir, excluded_patient_ids=args.exclude_patient
        )
        dataset_audit = {
            "dataset": "Folder Audio Dataset",
            "source_url": "local_directory",
            "download_date": "2026-08-05",
            "license": "Custom/Kaggle Dataset",
            "diagnosis_sha256": "folder_based",
            "recordings": len(records),
            "patients": len({record.patient_id for record in records}),
            "recording_label_counts": dict(Counter(record.disease for record in records)),
            "audio_inventory_sha256": "folder_based",
        }
    else:
        diagnosis_path = Path(args.diagnosis_csv)
        if not diagnosis_path.is_file():
            raise FileNotFoundError(
                f"Diagnosis CSV not found: {diagnosis_path}. Refusing to create synthetic labels."
            )
        provenance = load_and_validate_provenance(diagnosis_path, args.dataset_provenance)
        diagnoses = pd.read_csv(diagnosis_path)
        if args.group_classes != "none":
            diagnoses["disease"] = diagnoses["disease"].apply(
                lambda d: map_disease_labels(d, group_mode=args.group_classes)
            )
        records = build_manifest(
            args.dataset_dir, diagnoses, excluded_patient_ids=args.exclude_patient
        )
        dataset_audit = build_dataset_audit(records, diagnosis_path, provenance)

    # Merge any additional folder-format datasets before splitting.
    # Each extra directory is treated identically to --dataset-format folder.
    for extra_dir in args.extra_dataset_dir:
        extra_records = build_manifest_from_folders(
            extra_dir, excluded_patient_ids=args.exclude_patient
        )
        records.extend(extra_records)
        print(
            f"[extra-dataset] Merged {len(extra_records)} recordings "
            f"from {extra_dir}"
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
    with (output_dir / "dataset_audit.json").open("w", encoding="utf-8") as handle:
        json.dump(dataset_audit, handle, indent=2)

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

    import tensorflow as tf
    from tensorflow.keras.utils import set_random_seed

    gpus = tf.config.list_physical_devices("GPU")
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            print(f"Enabled dynamic memory growth for {len(gpus)} GPU(s).")
        except RuntimeError as e:
            print(f"Error setting memory growth: {e}")

    from train import train_model

    set_random_seed(args.seed)

    offline_spec = args.offline_spec_augment and (not args.no_spec_augment)
    train_data = extract_manifest(
        splits["train"],
        augment=not args.no_augmentation,
        use_spec_augment=offline_spec,
        num_freq_masks=args.num_freq_masks,
        max_freq_mask=args.max_freq_mask,
        num_time_masks=args.num_time_masks,
        max_time_mask=args.max_time_mask,
        max_waveform_variants=args.max_waveform_variants,
        seed=args.seed,
    )
    validation_data = extract_manifest(splits["validation"], augment=False, use_spec_augment=False, seed=args.seed)
    test_data = extract_manifest(splits["test"], augment=False, use_spec_augment=False, seed=args.seed)


    encoder = LabelEncoder()
    encoder.fit(sorted({record.disease for record in records}))
    class_names = list(encoder.classes_)
    identity = np.eye(len(class_names), dtype=np.float32)
    y_train = identity[encoder.transform(train_data.y)]
    y_validation = identity[encoder.transform(validation_data.y)]
    y_test = identity[encoder.transform(test_data.y)]

    use_online_spec = (not args.no_spec_augment) and (not args.offline_spec_augment) and (not args.no_augmentation)
    # Folder datasets use lowercase labels ("healthy"), ICBHI uses "Healthy".
    healthy_index = next(
        (index for index, name in enumerate(class_names) if name.lower() == "healthy"), None
    )
    model, _, model_path, class_weights = train_model(
        train_data.X,
        y_train,
        validation_data.X,
        y_validation,
        output_dir=output_dir,
        batch_size=args.batch_size,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        healthy_class_index=healthy_index,
        healthy_class_multiplier=args.healthy_class_multiplier,
        use_focal_loss=args.use_focal_loss,
        label_smoothing=args.label_smoothing,
        use_spec_augment=use_online_spec,
        num_freq_masks=args.num_freq_masks,
        max_freq_mask=args.max_freq_mask,
        num_time_masks=args.num_time_masks,
        max_time_mask=args.max_time_mask,
        seed=args.seed,
    )

    validation_raw_probabilities = np.asarray(model.predict(validation_data.X, verbose=0))
    validation_targets, validation_probabilities, _ = aggregate_probabilities_by_group(
        y_validation, validation_raw_probabilities, validation_data.source_paths
    )
    calibration = fit_temperature(validation_targets, validation_probabilities)
    calibration["abstention"] = fit_abstention_policy(
        apply_temperature(validation_probabilities, calibration["temperature"]),
        target_coverage=args.abstention_coverage,
    )
    with (output_dir / "calibration.json").open("w", encoding="utf-8") as handle:
        json.dump(calibration, handle, indent=2)

    test_window_probabilities = np.asarray(model.predict(test_data.X, verbose=0))
    test_targets, test_probabilities, test_sources = aggregate_probabilities_by_group(
        y_test, test_window_probabilities, test_data.source_paths
    )
    test_probabilities = apply_temperature(test_probabilities, calibration["temperature"])
    source_patient_ids = np.asarray(
        [
            test_data.patient_ids[np.flatnonzero(test_data.source_paths == source)[0]]
            for source in test_sources
        ],
        dtype=np.int64,
    )
    metrics = {
        "recording_level": evaluate_model(test_targets, test_probabilities, class_names),
        "patient_level": evaluate_patient_level(
            test_targets, test_probabilities, source_patient_ids, class_names
        ),
        "patient_bootstrap_confidence_intervals": bootstrap_patient_confidence_intervals(
            test_targets,
            test_probabilities,
            source_patient_ids,
            class_names,
            samples=args.bootstrap_samples,
            seed=args.seed,
        ),
    }
    with (output_dir / "test_metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    metadata = build_model_metadata(
        args,
        model_path=model_path,
        class_names=class_names,
        class_weights=class_weights,
        manifest_hash=manifest_hash,
        dataset_audit=dataset_audit,
        calibration=calibration,
        use_online_spec_augment=use_online_spec,
    )
    with (output_dir / "model_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
    print(f"Saved model and evaluation artifacts to {output_dir}")


def resolve_source_revision(explicit: str) -> str:
    """Use the given revision, else the current git commit (suffixed -dirty if modified)."""
    if explicit and explicit != "unknown":
        return explicit
    backend_dir = Path(__file__).resolve().parent
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=backend_dir, capture_output=True,
            text=True, check=True, timeout=10,
        ).stdout.strip()
        status = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=no"], cwd=backend_dir,
            capture_output=True, text=True, check=True, timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    return f"{commit}-dirty" if status else commit


def _library_versions() -> dict[str, str]:
    versions = {"python": sys.version, "numpy": np.__version__, "pandas": pd.__version__}
    for module_name in ("tensorflow", "keras", "librosa", "sklearn", "scipy"):
        try:
            versions[module_name] = __import__(module_name).__version__
        except Exception:  # an optional library is missing or broken
            versions[module_name] = "unavailable"
    return versions


def build_model_metadata(
    args: argparse.Namespace,
    *,
    model_path: Path,
    class_names: list[str],
    class_weights: dict[int, float],
    manifest_hash: str,
    dataset_audit: dict[str, object],
    calibration: dict[str, object],
    use_online_spec_augment: bool,
) -> dict[str, object]:
    """Assemble the schema-2 artifact contract, recording every setting the run depended on."""
    from train import (
        COSINE_DECAY_ALPHA,
        EARLY_STOPPING_MIN_DELTA,
        EARLY_STOPPING_MONITOR,
        EARLY_STOPPING_PATIENCE,
        FOCAL_ALPHA,
        FOCAL_GAMMA,
    )

    if args.no_augmentation or args.no_spec_augment:
        spec_augment_mode = "off"
    else:
        spec_augment_mode = "online" if use_online_spec_augment else "offline"
    return {
        "schema_version": 2,
        "source_revision": resolve_source_revision(args.source_revision),
        "model_filename": model_path.name,
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "classes": class_names,
        "preprocessing": DEFAULT_PREPROCESSING.to_dict(),
        "training": {
            "seed": args.seed,
            "test_size": args.test_size,
            "validation_size": args.validation_size,
            "augmentation": not args.no_augmentation,
            "windowing": {
                "window_frames": DEFAULT_PREPROCESSING.max_len,
                "hop_frames": DEFAULT_PREPROCESSING.window_hop,
                # Window probabilities are averaged first; temperature is applied to the mean.
                "aggregation": "temperature-calibrated mean of window probabilities",
            },
            "hyperparameters": {
                "batch_size": args.batch_size,
                "max_epochs": args.epochs,
                "optimizer": "Adamax",
                "learning_rate": args.learning_rate,
                "lr_schedule": {"name": "CosineDecay", "alpha": COSINE_DECAY_ALPHA},
                "loss": "categorical_focal" if args.use_focal_loss else "categorical_crossentropy",
                "focal_gamma": FOCAL_GAMMA if args.use_focal_loss else None,
                "focal_alpha": FOCAL_ALPHA if args.use_focal_loss else None,
                "label_smoothing": args.label_smoothing,
                "early_stopping": {
                    "monitor": EARLY_STOPPING_MONITOR,
                    "patience": EARLY_STOPPING_PATIENCE,
                    "min_delta": EARLY_STOPPING_MIN_DELTA,
                },
                "waveform_variants": (
                    "off" if args.no_augmentation else (args.max_waveform_variants or "all")
                ),
                "spec_augment": {
                    "mode": spec_augment_mode,
                    "num_freq_masks": args.num_freq_masks,
                    "max_freq_mask": args.max_freq_mask,
                    "num_time_masks": args.num_time_masks,
                    "max_time_mask": args.max_time_mask,
                },
            },
            "dataset_format": args.dataset_format,
            "dataset_dirs": [str(args.dataset_dir), *map(str, args.extra_dataset_dir)],
            "healthy_class_multiplier": args.healthy_class_multiplier,
            "class_weights": class_weights,
            "split_manifest_sha256": manifest_hash,
            "excluded_patient_ids": args.exclude_patient,
        },
        "evaluation_file": "test_metrics.json",
        "calibration_file": "calibration.json",
        "data_provenance": {
            "dataset_audit_file": "dataset_audit.json",
            "diagnosis_sha256": dataset_audit["diagnosis_sha256"],
            "audio_inventory_sha256": dataset_audit["audio_inventory_sha256"],
        },
        "uncertainty": calibration["abstention"],
        "runtime": {**_library_versions(), "platform": sys.platform},
        "limitations": [
            "Research use only; not clinically validated.",
            "Evaluated on one patient-disjoint test split of the training cohort "
            "(see dataset_audit.json and split_summary.json); no external validation.",
        ],
    }


def main() -> None:
    run_training(parse_args())


if __name__ == "__main__":
    main()
