"""Reorganize ICBHI 2017 flat WAV directory into class subfolders.

The standard ICBHI download places all 920 WAV files in a single flat
directory with patient-ID-prefixed filenames.  This script reads the
authorized ``patient_diagnosis.csv`` and creates a class-subfolder
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
      --diagnosis-csv patient_diagnosis.csv \\
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
) -> None:
    if not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")
    if not diagnosis_csv.is_file():
        raise FileNotFoundError(f"Diagnosis CSV not found: {diagnosis_csv}")

    df = pd.read_csv(diagnosis_csv)
    if not {"patient_id", "disease"}.issubset(df.columns):
        raise ValueError("diagnosis CSV must have 'patient_id' and 'disease' columns")

    diagnosis_map: dict[int, str] = (
        df.dropna(subset=["patient_id", "disease"])
        .assign(patient_id=lambda d: d["patient_id"].astype(int))
        .drop_duplicates("patient_id")
        .set_index("patient_id")["disease"]
        .to_dict()
    )

    # Create output class subdirectories
    classes = sorted(set(ICBHI_TO_5CLASS.values()))
    for cls in classes:
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
        if dest.exists():
            placed += 1
            continue

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
        default="patient_diagnosis.csv",
        help="Path to patient_diagnosis.csv",
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
    args = parser.parse_args()
    reorganize(
        Path(args.dataset_dir),
        Path(args.diagnosis_csv),
        Path(args.output_dir),
        copy=args.copy,
    )


if __name__ == "__main__":
    main()
