"""Markdown tables for research/DATASET_AUDIT.md from a frozen split manifest (default: v3).

    python research/tools/dataset_tables.py [v3]
"""

from __future__ import annotations

import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEVICES = ("AKGC417L", "LittC2SE", "Litt3200", "Meditron")


def device(path: str, source: str, patient_id: str) -> str:
    tail = Path(path).stem.rsplit("_", 1)[-1]
    if tail in DEVICES:
        return f"ICBHI {tail}"
    if source == "kaggle_asthma_v2" and int(patient_id) >= 900_000:  # cut from a KAUH recording
        return "Kaggle clip cut from KAUH (Littmann 3200)"
    return {"kauh": "KAUH Littmann 3200", "kaggle_asthma_v2": "Kaggle, source unknown"}.get(source, source)


def table(title: str, rows: dict, columns: list[str]) -> str:
    lines = [f"**{title}**", "", "| | " + " | ".join(columns) + " | Total |", "|---|" + "---:|" * (len(columns) + 1)]
    for name in sorted(rows):
        counts = rows[name]
        lines.append(f"| {name} | " + " | ".join(str(counts.get(c, 0)) for c in columns) + f" | {sum(counts.values())} |")
    return "\n".join(lines) + "\n"


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else "v3"
    rows = list(csv.DictReader((ROOT / "research" / "splits" / version / "split_manifest.csv").open()))
    classes = sorted({r["disease"] for r in rows})
    recordings = defaultdict(Counter)
    patients = defaultdict(lambda: defaultdict(set))
    for r in rows:
        key = device(r["path"], r["source"], r["patient_id"])
        recordings[key][r["disease"]] += 1
        patients[r["source"]][r["disease"]].add(r["patient_id"])
    print(f"Split {version}: {len(rows)} recordings, {len({r['patient_id'] for r in rows})} patients\n")
    print(table("Recordings by recording source/device × class", recordings, classes))
    print(table("Patients by dataset × class", {s: {c: len(v) for c, v in d.items()} for s, d in patients.items()}, classes))
    split_counts = defaultdict(Counter)
    for r in rows:
        split_counts[r["split"]][r["source"]] += 1
    print(table("Recordings by split × dataset", split_counts, sorted({r["source"] for r in rows})))


if __name__ == "__main__":
    main()
