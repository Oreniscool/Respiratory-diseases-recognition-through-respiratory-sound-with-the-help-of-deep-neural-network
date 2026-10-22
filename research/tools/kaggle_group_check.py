"""Re-derive how many Kaggle V2 filename "patient" groups mix several real patients.

Reads the tracked overlap evidence (Kaggle vs KAUH, Kaggle vs ICBHI) and counts, for each
(class folder, filename P-number) group whose clips match a reference database, how many distinct
real patients the matches come from.

    python research/tools/kaggle_group_check.py
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def mixed_groups(evidence: Path, patient_of_reference) -> tuple[int, int]:
    groups: dict[tuple[str, str], set[str]] = defaultdict(set)
    with evidence.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if str(row["is_overlap"]).strip().lower() != "true":
                continue
            match = re.match(r"[pP](\d+)", Path(row["clip"]).name)
            if match:
                groups[(row["clip_class"], match.group(1))].add(patient_of_reference(row["reference"]))
    return sum(len(v) > 1 for v in groups.values()), len(groups)


def main() -> None:
    kauh = mixed_groups(ROOT / "backend/data/kaggle_kauh_overlap.csv",
                        lambda ref: re.match(r"[BDE]P(\d+)_", ref).group(1))
    icbhi = mixed_groups(ROOT / "backend/data/kaggle_icbhi_overlap.csv", lambda ref: ref.split("_", 1)[0])
    print(f"KAUH: {kauh[0]} of {kauh[1]} Kaggle groups mix several KAUH patients")
    print(f"ICBHI: {icbhi[0]} of {icbhi[1]} Kaggle groups mix several ICBHI patients")


if __name__ == "__main__":
    main()
