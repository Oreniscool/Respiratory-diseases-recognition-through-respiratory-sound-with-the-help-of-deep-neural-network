"""KAUH lung-sound dataset: filename parsing, label mapping and the external test manifest.

Dataset: Fraiwan M, Fraiwan L, Khassawneh B, Ibnian A (2021). "A dataset of lung sounds recorded
from the chest wall using an electronic stethoscope." Mendeley Data, V3,
doi:10.17632/jwyy9np4gv.3, CC BY 4.0. 112 patients (P1–P112) recorded at King Abdullah University
Hospital, Jordan, with a Littmann 3200 at 4 kHz. Every recording exists three times, once per
stethoscope filter (B = bell, D = diaphragm, E = extended range).

Part of Kaggle Asthma Detection V2 was cut from KAUH recordings
(`data/kaggle_kauh_overlap.csv`, produced by `cross_dataset_overlap.py`). Those clips get their
real KAUH patient ID, and KAUH patients with no clip in Kaggle form an external test set that is
never used for training or model selection.

Usage (from ``backend/``)::

    python kauh.py --audio dataset/KAUH/audio --evidence data/kaggle_kauh_overlap.csv \\
        --output data/kauh_external_manifest.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

# Outside the ICBHI range (101–226) and the hashed Kaggle pseudo-ID range (100,000–899,999).
KAUH_ID_BASE = 900_000
FILTERS = {"B": "bell", "D": "diaphragm", "E": "extended"}
# Single diagnoses inside the project's 5 labels. Everything else (heart failure, lung fibrosis,
# pleural effusion, combined diagnoses) is out of label for the external set.
LABELS = {"n": "healthy", "asthma": "asthma", "pneumonia": "pneumonia", "copd": "copd", "bron": "bronchial"}
OUT_OF_LABEL = "out_of_label"

_NAME = re.compile(r"^(?P<filter>[BDE])P(?P<patient>\d+)_(?P<diagnosis>[^,]+),")


@dataclass(frozen=True)
class KauhRecording:
    patient: int
    filter: str
    diagnosis: str

    @property
    def patient_id(self) -> int:
        return KAUH_ID_BASE + self.patient

    @property
    def label(self) -> str:
        return LABELS.get(self.diagnosis, OUT_OF_LABEL)

    @property
    def primary_label(self) -> str | None:
        """The first listed diagnosis mapped to a project label ("asthma and lung fibrosis" → asthma)."""
        primary = re.split(r"\s+and\s+|\+", self.diagnosis)[0].strip()
        return LABELS.get(primary)


def parse_name(name: str | Path) -> KauhRecording:
    """Parse e.g. ``BP12_Asthma,E W,P L R,24,M.wav`` (filter, patient, diagnosis)."""
    match = _NAME.match(Path(name).name)
    if not match:
        raise ValueError(f"Not a KAUH recording name: {name}")
    diagnosis = " ".join(match.group("diagnosis").lower().split())
    return KauhRecording(int(match.group("patient")), FILTERS[match.group("filter")], diagnosis)


def matched_patients(evidence_csv: str | Path) -> dict[str, KauhRecording]:
    """Kaggle clip key → the KAUH recording it was cut from (only rows flagged as overlaps)."""
    from cross_dataset_overlap import overlap_key

    matches = {}
    with Path(evidence_csv).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if str(row["is_overlap"]).strip().lower() == "true":
                matches[overlap_key(row["clip"])] = parse_name(row["reference"])
    return matches


def external_manifest(audio_dir: str | Path, evidence_csv: str | Path) -> list[dict[str, object]]:
    """Every recording of the KAUH patients that contributed no clip to Kaggle."""
    used = {recording.patient for recording in matched_patients(evidence_csv).values()}
    rows = []
    for path in sorted(Path(audio_dir).glob("*.wav")):
        recording = parse_name(path)
        if recording.patient in used:
            continue
        rows.append({
            "path": path.as_posix(),
            "patient_id": recording.patient_id,
            "filter": recording.filter,
            "diagnosis": recording.diagnosis,
            "label": recording.label,
        })
    return rows


def split_for_training(
    rows: list[dict[str, object]], fraction: float = 0.5, seed: int = 42
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Move about ``fraction`` of the in-label patients of each class into the training cohort.

    The external KAUH set has healthy and COPD patients but every KAUH-recorded training clip is
    asthma, pneumonia or bronchial, so a model learns "KAUH recording → asthma". Putting some KAUH
    healthy/COPD patients into the cohort breaks that confound; the rest (and every out-of-label
    patient) stays external. Selection is per class, by a seeded shuffle of patient IDs; a class
    with a single patient stays external.
    """
    import random

    by_label: dict[str, list[int]] = {}
    for row in rows:
        if row["label"] != OUT_OF_LABEL:
            by_label.setdefault(str(row["label"]), [])
            if int(row["patient_id"]) not in by_label[str(row["label"])]:
                by_label[str(row["label"])].append(int(row["patient_id"]))
    rng = random.Random(seed)
    chosen: set[int] = set()
    for label in sorted(by_label):
        patients = sorted(by_label[label])
        rng.shuffle(patients)
        chosen.update(patients[: int(len(patients) * fraction)])
    cohort = [row for row in rows if int(row["patient_id"]) in chosen]
    external = [row for row in rows if int(row["patient_id"]) not in chosen]
    return cohort, external


def _write(path: str | Path, rows: list[dict[str, object]]) -> None:
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _describe(name: str, rows: list[dict[str, object]]) -> None:
    patients = {row["patient_id"]: row["label"] for row in rows}
    print(f"{name}: {len(rows)} recordings, {len(patients)} patients: {dict(Counter(patients.values()))}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--audio", default="dataset/KAUH/audio")
    parser.add_argument("--evidence", default="data/kaggle_kauh_overlap.csv")
    parser.add_argument("--output", default="data/kauh_external_manifest.csv")
    parser.add_argument(
        "--split-for-training",
        action="store_true",
        help="Also write data/kauh_cohort_manifest.csv (about half of the in-label patients per "
        "class, for training) and data/kauh_external_holdout_manifest.csv (the rest)",
    )
    args = parser.parse_args()
    rows = external_manifest(args.audio, args.evidence)
    if args.split_for_training:
        cohort, holdout = split_for_training(rows)
        _write("data/kauh_cohort_manifest.csv", cohort)
        _write("data/kauh_external_holdout_manifest.csv", holdout)
        _describe("cohort", cohort)
        _describe("external holdout", holdout)
    _write(args.output, rows)
    _describe("external (all)", rows)


if __name__ == "__main__":
    main()
