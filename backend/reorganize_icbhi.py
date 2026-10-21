"""Reorganize ICBHI 2017 flat WAV directory into class subfolders.

The standard ICBHI download places all 920 WAV files in a single flat
directory with patient-ID-prefixed filenames.  This script reads the
authentic per-patient diagnoses CSV (it rejects label sets that differ from the
published ICBHI distribution) and creates a class-subfolder
structure compatible with ``build_manifest_from_folders()`` so that
the ICBHI dataset can be combined with folder-based datasets (e.g.
Kaggle Asthma Detection V2) via ``--extra-dataset-dir``.

Class mapping (5-class, compatible with Kaggle Asthma V2 label space)
----------------------------------------------------------------------
  COPD                      → copd
  Healthy                   → healthy
  Pneumonia                 → pneumonia
  Asthma                    → asthma
  URTI, Bronchiectasis,
  Bronchiolitis, LRTI       → bronchial   (grouped as non-COPD airway)

Symlinks are created by default (zero disk overhead).  Pass ``--copy``
to make hard copies instead (useful when the source and destination
are on different filesystems).

Usage
-----
  python reorganize_icbhi.py \\
      --dataset-dir  dataset/ICBHI_final_dataset \\
      --diagnosis-csv dataset/patient_diagnosis_authentic.csv \\
      --output-dir   dataset/ICBHI_as_folders

  # Then train with merged datasets:
  python main.py \\
      --dataset-dir    dataset/Asthma_Detection_V2 \\
      --dataset-format folder \\
      --extra-dataset-dir dataset/ICBHI_as_folders \\
      --output-dir     artifacts/latest
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import pandas as pd

from dataset_provenance import assert_authentic_icbhi_labels


# ---------------------------------------------------------------------------
# 5-class mapping that aligns with the Kaggle Asthma Detection V2 label space
# ---------------------------------------------------------------------------
ICBHI_TO_5CLASS: dict[str, str] = {
    "COPD": "copd",
    "Healthy": "healthy",
    "Pneumonia": "pneumonia",
    "Asthma": "asthma",
    # Group remaining rare classes into the closest clinical category
    "URTI": "bronchial",
    "Bronchiectasis": "bronchial",
    "Bronchiolitis": "bronchial",
    "LRTI": "bronchial",
}


def reorganize(
    dataset_dir: Path,
    diagnosis_csv: Path,
    output_dir: Path,
    *,
    copy: bool = False,
    force: bool = False,
) -> None:
    if not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")
    if not diagnosis_csv.is_file():
        raise FileNotFoundError(f"Diagnosis CSV not found: {diagnosis_csv}")

    df = pd.read_csv(diagnosis_csv)
    if not {"patient_id", "disease"}.issubset(df.columns):
        raise ValueError("diagnosis CSV must have 'patient_id' and 'disease' columns")
    # Sorting audio with wrong labels silently corrupts every downstream run (chronicle §8.5).
    assert_authentic_icbhi_labels(df)

    diagnosis_map: dict[int, str] = (
        df.dropna(subset=["patient_id", "disease"])
        .assign(patient_id=lambda d: d["patient_id"].astype(int))
        .drop_duplicates("patient_id")
        .set_index("patient_id")["disease"]
        .to_dict()
    )

    # Never merge into a previous run's folders: stale files would keep their old labels.
    classes = sorted(set(ICBHI_TO_5CLASS.values()))
    existing = [path for cls in classes for path in (output_dir / cls).glob("*")]
    if existing and not force:
        raise FileExistsError(
            f"{output_dir} already contains {len(existing)} files from a previous run. "
            "Pass --force to rebuild it from the authentic labels."
        )
    for cls in classes:
        if (output_dir / cls).exists():
            shutil.rmtree(output_dir / cls)
        (output_dir / cls).mkdir(parents=True, exist_ok=True)

    placed = skipped = unmapped = 0
    for wav_path in sorted(dataset_dir.glob("*.wav")):
        try:
            patient_id = int(wav_path.name.split("_", 1)[0])
        except (TypeError, ValueError):
            print(f"  [SKIP] Cannot parse patient ID from: {wav_path.name}")
            skipped += 1
            continue

        raw_disease = diagnosis_map.get(patient_id)
        if raw_disease is None:
            print(f"  [SKIP] No diagnosis for patient {patient_id}: {wav_path.name}")
            skipped += 1
            continue

        mapped = ICBHI_TO_5CLASS.get(raw_disease)
        if mapped is None:
            print(f"  [SKIP] Unmapped disease '{raw_disease}' for {wav_path.name}")
            unmapped += 1
            continue

        dest = output_dir / mapped / wav_path.name
        if copy:
            shutil.copy2(wav_path, dest)
        else:
            dest.symlink_to(wav_path.resolve())
        placed += 1

    print(f"\nDone. Placed: {placed}  Skipped: {skipped}  Unmapped: {unmapped}")
    print(f"Output: {output_dir}")
    for cls in classes:
        count = len(list((output_dir / cls).glob("*.wav")))
        print(f"  {cls:20s}: {count} files")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reorganize ICBHI 2017 flat WAV dir into 5-class subfolders"
    )
    parser.add_argument(
        "--dataset-dir",
        default="dataset/ICBHI_final_dataset",
        help="Path to the flat ICBHI WAV directory",
    )
    parser.add_argument(
        "--diagnosis-csv",
        default="dataset/patient_diagnosis_authentic.csv",
        help="Authentic ICBHI per-patient diagnoses (the repo's patient_diagnosis.csv is scrambled)",
    )
    parser.add_argument(
        "--output-dir",
        default="dataset/ICBHI_as_folders",
        help="Destination directory for the class-subfolder structure",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy files instead of creating symlinks (use on cross-filesystem setups)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete and rebuild existing class folders in --output-dir",
    )
    args = parser.parse_args()
    reorganize(
        Path(args.dataset_dir),
        Path(args.diagnosis_csv),
        Path(args.output_dir),
        copy=args.copy,
        force=args.force,
    )


if __name__ == "__main__":
    main()
