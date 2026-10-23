"""Byte-identical recordings inside the KAUH dataset, and their effect on the KAUH-holdout result (X3).

Found by the independent audit (AUDIT_REPORT.md): some KAUH files are byte-identical although they
belong to different patients with different diagnoses. This script

1. hashes every KAUH recording and writes ``backend/data/kauh_internal_duplicates.csv`` (tracked
   evidence): one row per file in a duplicate group, with patient, filter, diagnosis and where the
   patient sits (holdout, in-cohort split of the served model, or a Kaggle-clip source);
2. re-scores X3 and EXP-017 as a **sensitivity analysis**: holdout recordings whose audio is identical
   to a recording of a non-holdout patient are dropped, then patients are re-aggregated (mean of
   recording probabilities, as in ``experiments/external.py``). The pre-registered holdout stays
   the primary result.

    python research/tools/kauh_duplicates.py
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
from kauh import parse_name  # noqa: E402

CLASSES = ["asthma", "bronchial", "copd", "healthy", "pneumonia"]


def sides() -> dict[int, str]:
    side: dict[int, set[str]] = defaultdict(set)
    with (BACKEND / "data/kauh_external_holdout_manifest.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            side[int(row["patient_id"])].add("holdout")
    with (BACKEND / "artifacts/latest/split_manifest.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if int(row["patient_id"]) >= 900_000:
                side[int(row["patient_id"])].add(f"served-{row['split']}")
    return {p: "+".join(sorted(v)) for p, v in side.items()}


def rescore(recordings: list[dict], drop: set[str]) -> dict[str, object]:
    kept = [r for r in recordings if r["label"] != "out_of_label" and Path(r["path"]).name not in drop]
    patients: dict[int, list[dict]] = defaultdict(list)
    for r in kept:
        patients[r["patient_id"]].append(r)
    correct, per_class = 0, defaultdict(lambda: [0, 0])
    for rows in patients.values():
        label = rows[0]["label"]
        predicted = CLASSES[int(np.argmax(np.mean([r["probabilities"] for r in rows], axis=0)))]
        correct += predicted == label
        per_class[label][0] += predicted == label
        per_class[label][1] += 1
    return {"patients": len(patients), "correct": correct,
            "per_class": {k: f"{v[0]}/{v[1]}" for k, v in sorted(per_class.items())},
            "dropped_recordings": sorted(drop & {Path(r["path"]).name for r in recordings})}


def main() -> None:
    files = sorted((BACKEND / "dataset/KAUH/audio").glob("*.wav"))
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in files:
        groups[hashlib.sha256(path.read_bytes()).hexdigest()].append(path)
    side = sides()
    rows = []
    for digest, paths in sorted(groups.items()):
        if len(paths) < 2:
            continue
        labels = {parse_name(p).diagnosis for p in paths}
        for path in paths:
            rec = parse_name(path)
            rows.append({"sha256": digest, "file": path.name, "patient_id": rec.patient_id, "filter": rec.filter,
                         "diagnosis": rec.diagnosis, "label": rec.label, "side": side.get(rec.patient_id, "none"),
                         "group_size": len(paths), "conflicting_diagnoses": len(labels) > 1})
    out = BACKEND / "data/kauh_internal_duplicates.csv"
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    # Holdout recordings identical to a recording of a patient outside the holdout.
    drop = set()
    for paths in groups.values():
        ids = {parse_name(p).patient_id: p for p in paths}
        if len(ids) > 1:
            for pid, path in ids.items():
                if "holdout" in side.get(pid, "") and any("holdout" not in side.get(o, "") for o in ids if o != pid):
                    drop |= {p.name for p in paths if parse_name(p).patient_id == pid}
    summary = {
        "kauh_files": len(files), "duplicate_groups": sum(len(v) > 1 for v in groups.values()),
        "groups_with_conflicting_diagnoses": len({r["sha256"] for r in rows if r["conflicting_diagnoses"]}),
        "holdout_recordings_identical_to_non_holdout_audio": sorted(drop),
        "sensitivity": {},
    }
    for name, path in (("X3 round-2b", "experiments/external/served_round2b_final_recordings.json"),
                       ("EXP-017 round-2", "experiments/external/previous_round2_on_holdout_recordings.json")):
        recordings = json.loads((BACKEND / "artifacts" / path).read_text())
        summary["sensitivity"][name] = {"as_registered": rescore(recordings, set()), "duplicates_removed": rescore(recordings, drop)}
    (BACKEND / "data/kauh_internal_duplicates.summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
