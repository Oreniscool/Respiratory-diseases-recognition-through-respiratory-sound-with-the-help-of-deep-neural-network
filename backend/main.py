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
    build_folder_dataset_audit,
    load_and_validate_provenance,
    map_disease_labels,
)
from evaluate import (
    aggregate_probabilities_by_group,
    bootstrap_patient_confidence_intervals,
    evaluate_by_group,
    evaluate_model,
    evaluate_patient_level,
)
from cross_dataset_overlap import load_overlap_evidence, overlap_key
from featureExtraction import (
    AudioRecord,
    build_manifest,
    build_manifest_from_folders,
    deduplicate_records,
    extract_manifest,
)
from preprocessing import FEATURE_TYPES, PreprocessingConfig


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
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
        "--overlap-csv",
        default="data/kaggle_icbhi_overlap.csv",
        help=(
            "Evidence file from cross_dataset_overlap.py listing Kaggle V2 clips that are cut "
            "from ICBHI recordings. Required whenever both datasets are merged."
        ),
    )
    parser.add_argument(
        "--kauh-overlap-csv",
        default="data/kaggle_kauh_overlap.csv",
        help="Evidence file listing Kaggle V2 clips cut from KAUH recordings (real patient IDs)",
    )
    parser.add_argument(
        "--no-kauh-ids",
        action="store_true",
        help="Keep Kaggle filename pseudo-patient IDs (known to merge and split real patients)",
    )
    parser.add_argument(
        "--no-overlap-exclusion",
        action="store_true",
        help="Keep Kaggle clips that are copies of ICBHI audio (reintroduces split leakage)",
    )
    parser.add_argument(
        "--feature-type",
        choices=FEATURE_TYPES,
        default="mfcc",
        help="Front-end features: MFCC (default) or log-mel bands within the band-pass range",
    )
    parser.add_argument(
        "--n-mels", type=int, default=64, help="Mel bands for --feature-type logmel (default: 64)"
    )
    parser.add_argument(
        "--cudnn-gru",
        action="store_true",
        help="tanh GRUs (cuDNN-compatible) instead of the original linear-candidate GRUs",
    )
    parser.add_argument(
        "--spec-augment-mode",
        choices=["batch", "sample"],
        default="batch",
        help="Online SpecAugment: one mask per batch (original) or per sample within valid frames",
    )
    parser.add_argument("--mixup-alpha", type=float, default=0.0, help="Mixup Beta(α, α); 0 = off")
    parser.add_argument(
        "--device-augment",
        action="store_true",
        help="Add two simulated-stethoscope variants per training recording",
    )
    parser.add_argument(
        "--multitask",
        action="store_true",
        help="Auxiliary crackle/wheeze head trained on ICBHI cycle annotations",
    )
    parser.add_argument("--multitask-weight", type=float, default=0.5)
    parser.add_argument("--icbhi-annotations", default="dataset/ICBHI_final_dataset")
    parser.add_argument(
        "--fusion",
        choices=["none", "yamnet", "members"],
        default="none",
        help=(
            "Late fusion: 'yamnet' (RespiNet + YAMNet head, the 2026-10-22 format) or 'members' "
            "(RespiNet ensemble + one head per --fusion-members extractor)"
        ),
    )
    parser.add_argument(
        "--fusion-members",
        default="yamnet",
        help="Comma-separated pretrained.EXTRACTORS names for --fusion members (e.g. yamnet,opera_ce)",
    )
    parser.add_argument(
        "--ensemble-seeds", type=int, default=1, help="Train N RespiNets (seed, seed+1, …) and average them"
    )
    parser.add_argument(
        "--yamnet-dir",
        default="artifacts/pretrained/yamnet",
        help="YAMNet TF2 SavedModel directory (Kaggle Models google/yamnet/tensorFlow2/yamnet/1)",
    )
    parser.add_argument(
        "--merge-icbhi",
        action="store_true",
        help="Automatically merge the ICBHI dataset (backend/dataset/ICBHI_as_folders) into the training cohort",
    )
    return parser.parse_args(argv)


def preprocessing_config(args: argparse.Namespace) -> PreprocessingConfig:
    """The feature contract for this run; persisted in metadata and re-read by the server."""
    return PreprocessingConfig(feature_type=args.feature_type, n_mels=args.n_mels)


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


def source_name(directory: str | Path) -> str:
    """Stable short name for a dataset directory, used to tag and report per-source results."""
    text = str(directory).lower()
    if "icbhi" in text:
        return "icbhi"
    if "asthma_detection" in text or "asthma detection" in text:
        return "kaggle_asthma_v2"
    return Path(directory).name.lower() or "primary"


def exclude_cross_dataset_overlap(
    records: list[AudioRecord], overlap_csv: str | Path
) -> tuple[list[AudioRecord], dict[str, object]]:
    """Drop Kaggle V2 clips that are verbatim cuts of ICBHI recordings in the same cohort.

    Such a clip and its source recording would otherwise carry different patient IDs and
    could land in different splits. The evidence file must cover every Kaggle clip, so a
    stale or partial file fails instead of silently letting copies through.
    """
    overlap_csv = Path(overlap_csv)
    if not overlap_csv.is_absolute() and not overlap_csv.is_file():
        overlap_csv = Path(__file__).resolve().parent / overlap_csv
    if not overlap_csv.is_file():
        raise FileNotFoundError(
            f"Merging ICBHI with Kaggle Asthma V2 requires the overlap evidence file {overlap_csv}. "
            "Generate it with cross_dataset_overlap.py, or pass --no-overlap-exclusion knowingly."
        )
    covered, overlapping = load_overlap_evidence(overlap_csv)
    kaggle = [record for record in records if record.source == "kaggle_asthma_v2"]
    uncovered = [str(record.path) for record in kaggle if overlap_key(record.path) not in covered]
    if uncovered:
        raise ValueError(
            f"Overlap evidence {overlap_csv} does not cover {len(uncovered)} Kaggle clips "
            f"(e.g. {uncovered[0]}); regenerate it with cross_dataset_overlap.py"
        )
    removed = [
        record for record in kaggle if overlap_key(record.path) in overlapping
    ]
    removed_ids = {id(record) for record in removed}
    from dataset_provenance import sha256_file

    report = {
        "evidence_file": portable_path(overlap_csv),
        "evidence_sha256": sha256_file(overlap_csv),
        "removed_recordings": len(removed),
        "removed_by_class": dict(sorted(Counter(record.disease for record in removed).items())),
    }
    return [record for record in records if id(record) not in removed_ids], report


def assign_kauh_patient_ids(
    records: list[AudioRecord], evidence_csv: str | Path
) -> tuple[list[AudioRecord], dict[str, object]]:
    """Give Kaggle V2 clips that were cut from KAUH recordings their real KAUH patient ID.

    Kaggle filename prefixes ("P54") are not subject IDs: 57 of the 64 prefix groups that match
    KAUH contain clips of several KAUH patients. Without this step one patient's audio can sit
    on both sides of the split. The evidence file must cover every Kaggle clip (fail closed), and
    a clip whose class disagrees with the KAUH diagnosis stops the pipeline.
    """
    from kauh import matched_patients

    evidence_csv = Path(evidence_csv)
    if not evidence_csv.is_absolute() and not evidence_csv.is_file():
        evidence_csv = Path(__file__).resolve().parent / evidence_csv
    if not evidence_csv.is_file():
        raise FileNotFoundError(
            f"Kaggle Asthma V2 requires the KAUH overlap evidence file {evidence_csv}. Generate it "
            "with cross_dataset_overlap.py, or pass --no-kauh-ids knowingly."
        )
    covered, _ = load_overlap_evidence(evidence_csv)
    matches = matched_patients(evidence_csv)
    kaggle = [record for record in records if record.source == "kaggle_asthma_v2"]
    uncovered = [str(record.path) for record in kaggle if overlap_key(record.path) not in covered]
    if uncovered:
        raise ValueError(
            f"KAUH evidence {evidence_csv} does not cover {len(uncovered)} Kaggle clips "
            f"(e.g. {uncovered[0]}); regenerate it with cross_dataset_overlap.py"
        )
    updated, reassigned = [], []
    for record in records:
        match = matches.get(overlap_key(record.path)) if record.source == "kaggle_asthma_v2" else None
        if match is None:
            updated.append(record)
            continue
        if match.primary_label != record.disease:
            raise ValueError(
                f"{record.path} is labeled {record.disease!r} but was cut from KAUH patient "
                f"{match.patient} diagnosed {match.diagnosis!r}"
            )
        updated.append(AudioRecord(record.path, match.patient_id, record.disease, record.source))
        reassigned.append((record, match))
    from dataset_provenance import sha256_file

    report = {
        "evidence_file": portable_path(evidence_csv),
        "evidence_sha256": sha256_file(evidence_csv),
        "reassigned_recordings": len(reassigned),
        "kauh_patients": len({match.patient for _, match in reassigned}),
        "previous_pseudo_patients": len({record.patient_id for record, _ in reassigned}),
        "reassigned_by_class": dict(sorted(Counter(r.disease for r, _ in reassigned).items())),
    }
    return updated, report


def portable_path(path: str | Path) -> str:
    """Path relative to backend/ when possible, so manifest hashes don't depend on the machine."""
    backend_dir = os.path.abspath(Path(__file__).parent)
    absolute = os.path.abspath(path)
    if os.path.commonpath([backend_dir, absolute]) == backend_dir:
        return Path(os.path.relpath(absolute, backend_dir)).as_posix()
    return Path(absolute).as_posix()


def _write_split_manifest(
    splits: dict[str, list[AudioRecord]], output_dir: Path
) -> str:
    rows = [
        {
            "split": split,
            "patient_id": record.patient_id,
            "disease": record.disease,
            "source": record.source,
            "path": portable_path(record.path),
        }
        for split, records in splits.items()
        for record in records
    ]
    frame = pd.DataFrame(rows).sort_values(["split", "patient_id", "path"])
    frame.to_csv(output_dir / "split_manifest.csv", index=False)
    return hashlib.sha256(frame.to_csv(index=False).encode("utf-8")).hexdigest()


def build_cohort(args: argparse.Namespace) -> tuple[list[AudioRecord], dict[str, object]]:
    """Build the deduplicated, overlap-free cohort and the audit describing it."""
    if args.dataset_format == "folder":
        records = build_manifest_from_folders(
            args.dataset_dir,
            excluded_patient_ids=args.exclude_patient,
            source=source_name(args.dataset_dir),
        )
        diagnosis_path = provenance = None
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
            args.dataset_dir, diagnoses, excluded_patient_ids=args.exclude_patient, source="icbhi"
        )

    # Merge any additional folder-format datasets before splitting.
    # Each extra directory is treated identically to --dataset-format folder.
    for extra_dir in args.extra_dataset_dir:
        extra_records = build_manifest_from_folders(
            extra_dir, excluded_patient_ids=args.exclude_patient, source=source_name(extra_dir)
        )
        records.extend(extra_records)
        print(
            f"[extra-dataset] Merged {len(extra_records)} recordings "
            f"from {extra_dir}"
        )

    # 52% of Kaggle V2 (incl. all of its COPD class) is cut from ICBHI recordings. When both are
    # merged, keep the full ICBHI recording (real patient ID) and drop the Kaggle copy.
    cross_dataset_overlap: dict[str, object] = {"applied": False}
    sources = {record.source for record in records}
    if {"icbhi", "kaggle_asthma_v2"} <= sources and not args.no_overlap_exclusion:
        records, cross_dataset_overlap = exclude_cross_dataset_overlap(records, args.overlap_csv)
        cross_dataset_overlap["applied"] = True
        print(
            f"[overlap] Removed {cross_dataset_overlap['removed_recordings']} Kaggle clips "
            f"that are cuts of ICBHI recordings: {cross_dataset_overlap['removed_by_class']}"
        )

    kauh_patient_ids: dict[str, object] = {"applied": False}
    if "kaggle_asthma_v2" in {record.source for record in records} and not args.no_kauh_ids:
        records, kauh_patient_ids = assign_kauh_patient_ids(records, args.kauh_overlap_csv)
        kauh_patient_ids["applied"] = True
        print(
            f"[kauh] {kauh_patient_ids['reassigned_recordings']} Kaggle clips cut from KAUH now carry "
            f"{kauh_patient_ids['kauh_patients']} real KAUH patient IDs "
            f"(were {kauh_patient_ids['previous_pseudo_patients']} filename groups)"
        )

    # Byte-identical files under different names would otherwise be able to land in different
    # splits (12 such groups exist in Kaggle Asthma V2). Remove them before splitting.
    records, duplicates_removed = deduplicate_records(records)
    if duplicates_removed:
        print(f"[dedup] Removed {len(duplicates_removed)} byte-identical duplicate recordings")

    # Audit the cohort that is actually split and trained on (after merging and dedup).
    if provenance is None:
        dataset_audit = build_folder_dataset_audit(
            records, [args.dataset_dir, *args.extra_dataset_dir]
        )
    else:
        dataset_audit = build_dataset_audit(records, diagnosis_path, provenance)
    dataset_audit["cross_dataset_overlap"] = cross_dataset_overlap
    dataset_audit["kauh_patient_ids"] = kauh_patient_ids
    dataset_audit["duplicates_removed"] = [
        {**row, "path": portable_path(row["path"]), "duplicate_of": portable_path(row["duplicate_of"])}
        for row in duplicates_removed
    ]
    return records, dataset_audit


def run_training(args: argparse.Namespace) -> None:
    resolve_dataset_paths(args)
    # Capture the revision now: commits made while a long run trains must not be credited to it.
    args.source_revision = resolve_source_revision(args.source_revision)
    random.seed(args.seed)
    np.random.seed(args.seed)

    records, dataset_audit = build_cohort(args)

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
            "source_counts": dict(Counter(record.source for record in split_records)),
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


    offline_spec = args.offline_spec_augment and (not args.no_spec_augment)
    config = preprocessing_config(args)
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
        config=config,
        device_augment=args.device_augment,
    )
    validation_data = extract_manifest(
        splits["validation"], augment=False, use_spec_augment=False, seed=args.seed, config=config
    )
    test_data = extract_manifest(
        splits["test"], augment=False, use_spec_augment=False, seed=args.seed, config=config
    )


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
    aux_train = aux_validation = None
    if args.multitask:
        from featureExtraction import cycle_annotation_targets

        aux_train, aux_validation = (
            cycle_annotation_targets(
                data.source_paths, data.variants, data.window_starts, data.valid_lengths,
                args.icbhi_annotations, config=config,
            )
            for data in (train_data, validation_data)
        )
    def train_respinet(seed: int, directory: Path):
        set_random_seed(seed)
        return train_model(
            train_data.X,
            y_train,
            validation_data.X,
            y_validation,
            output_dir=directory,
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
            seed=seed,
            cudnn_gru=args.cudnn_gru,
            spec_augment_mode=args.spec_augment_mode,
            mixup_alpha=args.mixup_alpha,
            aux_train=aux_train,
            aux_val=aux_validation,
            aux_weight=args.multitask_weight,
        )

    model, _, model_path, class_weights = train_respinet(args.seed, output_dir)
    # Extra ensemble members are trained with seed+1, seed+2, … and stored next to the main model.
    ensemble = [model]
    ensemble_files = [model_path.name]
    for offset in range(1, args.ensemble_seeds):
        import shutil

        member_seed = args.seed + offset
        member, _, member_path, _ = train_respinet(member_seed, output_dir / "ensemble" / f"seed{member_seed}")
        shutil.copyfile(member_path, output_dir / f"respinet_seed{member_seed}.keras")
        ensemble.append(member)
        ensemble_files.append(f"respinet_seed{member_seed}.keras")

    def respinet_predict(features: np.ndarray) -> np.ndarray:
        return np.mean([np.asarray(m.predict(features, verbose=0)) for m in ensemble], axis=0)

    validation_raw_probabilities = respinet_predict(validation_data.X)
    validation_targets, validation_probabilities, validation_paths = (
        aggregate_probabilities_by_group(
            y_validation, validation_raw_probabilities, validation_data.source_paths
        )
    )
    test_window_probabilities = respinet_predict(test_data.X)
    test_targets, test_probabilities, test_sources = aggregate_probabilities_by_group(
        y_test, test_window_probabilities, test_data.source_paths
    )
    fusion = None
    if args.fusion == "members" or args.ensemble_seeds > 1:
        fusion, validation_probabilities, test_probabilities = fit_members_fusion(
            args,
            splits,
            class_names,
            output_dir,
            respinet_files=ensemble_files,
            validation_targets=validation_targets,
            validation_paths=validation_paths,
            validation_respinet=validation_probabilities,
            test_paths=test_sources,
            test_respinet=test_probabilities,
        )
    elif args.fusion == "yamnet":
        fusion, validation_probabilities, test_probabilities = fit_yamnet_fusion(
            args,
            splits,
            class_names,
            output_dir,
            validation_targets=validation_targets,
            validation_paths=validation_paths,
            validation_respinet=validation_probabilities,
            test_paths=test_sources,
            test_respinet=test_probabilities,
        )

    # For a fusion artifact this final temperature calibrates the fused probabilities.
    calibration = fit_temperature(validation_targets, validation_probabilities)
    calibration["abstention"] = fit_abstention_policy(
        apply_temperature(validation_probabilities, calibration["temperature"]),
        target_coverage=args.abstention_coverage,
    )
    with (output_dir / "calibration.json").open("w", encoding="utf-8") as handle:
        json.dump(calibration, handle, indent=2)
    test_probabilities = apply_temperature(test_probabilities, calibration["temperature"])
    source_patient_ids = np.asarray(
        [
            test_data.patient_ids[np.flatnonzero(test_data.source_paths == source)[0]]
            for source in test_sources
        ],
        dtype=np.int64,
    )
    source_by_path = {str(record.path): record.source for record in records}
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
        "by_source": evaluate_by_group(
            test_targets,
            test_probabilities,
            source_patient_ids,
            np.asarray([source_by_path[str(source)] for source in test_sources]),
            class_names,
        ),
    }
    with (output_dir / "test_metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2, allow_nan=False)

    metadata = build_model_metadata(
        args,
        model_path=model_path,
        class_names=class_names,
        class_weights=class_weights,
        manifest_hash=manifest_hash,
        dataset_audit=dataset_audit,
        calibration=calibration,
        use_online_spec_augment=use_online_spec,
        fusion=fusion,
    )
    with (output_dir / "model_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
    print(f"Saved model and evaluation artifacts to {output_dir}")


def fit_yamnet_fusion(
    args: argparse.Namespace,
    splits: dict[str, list[AudioRecord]],
    class_names: list[str],
    output_dir: Path,
    *,
    validation_targets: np.ndarray,
    validation_paths: np.ndarray,
    validation_respinet: np.ndarray,
    test_paths: np.ndarray,
    test_respinet: np.ndarray,
) -> tuple[dict[str, object], np.ndarray, np.ndarray]:
    """Fit the YAMNet logistic head on the training split and fuse it with RespiNet.

    Each member is temperature-calibrated on the validation split, the calibrated vectors are
    averaged 50/50 (the weight fixed before the cross-validation results were seen), and the
    caller fits one more temperature on the fused validation probabilities.
    """
    import shutil

    from pretrained import (
        FUSION_TYPE,
        YAMNET_SAMPLE_RATE,
        directory_sha256,
        export_logistic_head,
        fit_logistic_head,
        fuse_probabilities,
        load_yamnet,
        load_yamnet_audio,
        yamnet_embedding,
    )

    yamnet = load_yamnet(args.yamnet_dir)
    records = [*splits["train"], *splits["validation"], *splits["test"]]
    print(f"[fusion] Computing YAMNet embeddings for {len(records)} recordings")
    embeddings = {str(r.path): yamnet_embedding(yamnet, load_yamnet_audio(r.path)) for r in records}
    labels = {str(r.path): r.disease for r in records}

    def matrix(paths):
        return np.stack([embeddings[str(path)] for path in paths])

    train_paths = [str(r.path) for r in splits["train"]]
    pipeline, chosen = fit_logistic_head(
        matrix(train_paths),
        [labels[p] for p in train_paths],
        matrix(validation_paths),
        [labels[str(p)] for p in validation_paths],
    )
    head = export_logistic_head(pipeline, class_names, output_dir / "yamnet_head.keras")
    order = [list(pipeline.classes_).index(name) for name in class_names]
    validation_head = np.asarray(head.predict(matrix(validation_paths), verbose=0))
    # GPU matmuls run in TF32 (about 3 decimal digits), so allow 1e-3 but require identical classes.
    reference = pipeline.predict_proba(matrix(validation_paths))[:, order]
    if not (
        np.allclose(validation_head, reference, atol=1e-3)
        and np.array_equal(validation_head.argmax(1), reference.argmax(1))
    ):
        raise RuntimeError("Exported YAMNet head does not reproduce the fitted logistic regression")
    test_head = np.asarray(head.predict(matrix(test_paths), verbose=0))

    yamnet_copy = output_dir / "yamnet"
    shutil.copytree(args.yamnet_dir, yamnet_copy, dirs_exist_ok=True)
    fusion = {
        "type": FUSION_TYPE,
        "weights": [0.5, 0.5],
        "respinet_temperature": fit_temperature(validation_targets, validation_respinet)["temperature"],
        "yamnet_temperature": fit_temperature(validation_targets, validation_head)["temperature"],
        "head_filename": "yamnet_head.keras",
        "head_sha256": hashlib.sha256((output_dir / "yamnet_head.keras").read_bytes()).hexdigest(),
        "head_logistic_C": chosen["C"],
        "yamnet_dir": yamnet_copy.name,
        "yamnet_sha256": directory_sha256(yamnet_copy),
        "yamnet_source": "Kaggle Models google/yamnet/tensorFlow2/yamnet/1",
        "yamnet_sample_rate": YAMNET_SAMPLE_RATE,
        "embedding": "mean and std of YAMNet frame embeddings (2,048 values), no band-pass",
        "aggregation": "weighted mean of member-calibrated probabilities, then the calibration.json temperature",
    }
    return (
        fusion,
        fuse_probabilities(validation_respinet, validation_head, fusion),
        fuse_probabilities(test_respinet, test_head, fusion),
    )


def fit_members_fusion(
    args: argparse.Namespace,
    splits: dict[str, list[AudioRecord]],
    class_names: list[str],
    output_dir: Path,
    *,
    respinet_files: list[str],
    validation_targets: np.ndarray,
    validation_paths: np.ndarray,
    validation_respinet: np.ndarray,
    test_paths: np.ndarray,
    test_respinet: np.ndarray,
) -> tuple[dict[str, object], np.ndarray, np.ndarray]:
    """N-member late fusion: the RespiNet (ensemble) plus one logistic head per frozen extractor.

    Every member is temperature-calibrated on the validation split and the members are averaged
    with equal weights; the caller fits one more temperature on the fused validation probabilities.
    """
    import shutil

    from pretrained import (
        EXTRACTORS,
        MEMBERS_FUSION_TYPE,
        OPERA_MODELS,
        Extractor,
        directory_sha256,
        export_logistic_head,
        fit_logistic_head,
        fuse_members,
    )

    members: list[dict[str, object]] = [{
        "kind": "respinet",
        "files": respinet_files,
        "sha256": [hashlib.sha256((output_dir / name).read_bytes()).hexdigest() for name in respinet_files],
        "temperature": fit_temperature(validation_targets, validation_respinet)["temperature"],
    }]
    validation_members, test_members = [validation_respinet], [test_respinet]
    records = [*splits["train"], *splits["validation"], *splits["test"]]
    labels = {str(r.path): r.disease for r in records}
    train_paths = [str(r.path) for r in splits["train"]]
    names = [name for name in args.fusion_members.split(",") if name] if args.fusion == "members" else []
    for name in names:
        if name not in EXTRACTORS:
            raise ValueError(f"Unknown --fusion-members entry {name!r}; choose from {sorted(EXTRACTORS)}")
        source_dir = Path(EXTRACTORS[name])
        model_dir = output_dir / name
        model_dir.mkdir(parents=True, exist_ok=True)
        if name.startswith("opera"):  # ship only the checkpoint this member uses
            shutil.copyfile(source_dir / OPERA_MODELS[name][0], model_dir / OPERA_MODELS[name][0])
        else:
            shutil.copytree(source_dir, model_dir, dirs_exist_ok=True)
        extractor = Extractor(name, model_dir)
        print(f"[fusion] {name}: embedding {len(records)} recordings", flush=True)
        embeddings = {str(r.path): extractor.embed(r.path) for r in records}

        def matrix(paths):
            return np.stack([embeddings[str(path)] for path in paths])

        pipeline, chosen = fit_logistic_head(
            matrix(train_paths), [labels[p] for p in train_paths],
            matrix(validation_paths), [labels[str(p)] for p in validation_paths],
        )
        head_file = f"{name}_head.keras"
        head = export_logistic_head(pipeline, class_names, output_dir / head_file)
        order = [list(pipeline.classes_).index(c) for c in class_names]
        validation_head = np.asarray(head.predict(matrix(validation_paths), verbose=0))
        reference = pipeline.predict_proba(matrix(validation_paths))[:, order]
        if not (np.allclose(validation_head, reference, atol=1e-3)
                and np.array_equal(validation_head.argmax(1), reference.argmax(1))):
            raise RuntimeError(f"Exported {name} head does not reproduce the fitted logistic regression")
        members.append({
            "kind": "embedding_head",
            "extractor": name,
            "model_dir": name,
            "model_sha256": directory_sha256(model_dir),
            "head_file": head_file,
            "head_sha256": hashlib.sha256((output_dir / head_file).read_bytes()).hexdigest(),
            "head_logistic_C": chosen["C"],
            "temperature": fit_temperature(validation_targets, validation_head)["temperature"],
        })
        validation_members.append(validation_head)
        test_members.append(np.asarray(head.predict(matrix(test_paths), verbose=0)))
    fusion = {
        "type": MEMBERS_FUSION_TYPE,
        "members": members,
        "weights": [1.0] * len(members),
        "aggregation": "weighted mean of member-calibrated probabilities, then the calibration.json temperature",
    }
    return fusion, fuse_members(validation_members, fusion), fuse_members(test_members, fusion)


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
    fusion: dict[str, object] | None = None,
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

    preprocessing = preprocessing_config(args)
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
        "preprocessing": preprocessing.to_dict(),
        "training": {
            "seed": args.seed,
            "test_size": args.test_size,
            "validation_size": args.validation_size,
            "augmentation": not args.no_augmentation,
            "windowing": {
                "window_frames": preprocessing.max_len,
                "hop_frames": preprocessing.window_hop,
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
                "cudnn_gru": args.cudnn_gru,
                "ensemble_seeds": args.ensemble_seeds,
                "mixup_alpha": args.mixup_alpha,
                "device_augment": args.device_augment,
                "multitask": (
                    {"targets": ["crackles", "wheezes"], "weight": args.multitask_weight}
                    if args.multitask else None
                ),
                "spec_augment": {
                    "mode": spec_augment_mode,
                    "masks": "per sample" if args.spec_augment_mode == "sample" else "per batch",
                    "num_freq_masks": args.num_freq_masks,
                    "max_freq_mask": args.max_freq_mask,
                    "num_time_masks": args.num_time_masks,
                    "max_time_mask": args.max_time_mask,
                },
            },
            "dataset_format": args.dataset_format,
            "cross_dataset_overlap_exclusion": not args.no_overlap_exclusion,
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
        **({"fusion": fusion} if fusion is not None else {}),
        "runtime": {**_library_versions(), "platform": sys.platform},
        "limitations": [
            "Research use only; not clinically validated.",
            "Evaluated on one patient-disjoint test split of the training cohort "
            "(see dataset_audit.json and split_summary.json); no external validation.",
            *(
                [
                    "Kaggle Asthma Detection V2 has no subject identifiers: its patient groups are "
                    "inferred from filename prefixes and are unverified, and part of it derives "
                    "from the KAUH database, which was not checked for overlap. Prefer the "
                    "ICBHI subset in test_metrics.json['by_source'] as the leakage-free estimate."
                ]
                if any(
                    source_name(directory) == "kaggle_asthma_v2"
                    for directory in [args.dataset_dir, *args.extra_dataset_dir]
                )
                else []
            ),
        ],
    }


def main() -> None:
    run_training(parse_args())


if __name__ == "__main__":
    main()
