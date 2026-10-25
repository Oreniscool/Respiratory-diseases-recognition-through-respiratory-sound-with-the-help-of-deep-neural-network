"""SPRSound (SJTU Paediatric Respiratory Sound Database) as a second external test set.

Source: Zhang et al., IEEE TBioCAS 2022; https://github.com/SJTU-YONGFU-RESEARCH-GRP/SPRSound
(CC-BY-4.0; Shanghai Children's Medical Center, Yunting II electronic stethoscope; ages 1 month to
18 years). The four challenge releases (BioCAS2022-2025) are merged here; none of it is ever used for
training or model selection.

File names are ``<patient>_<age>_<gender>_<site>_<recording>.wav`` (gender: 0 male, 1 female; ``p1``-``p8``
are chest sites). Diagnoses are patient-level and live in ``Patient Summary/*.csv`` (2022, 2023 and 2024
tables; the 2025 release has none). This module turns them into ``data/sprsound_manifest.csv``.

Fixed rules (research/DECISION_LOG.md D-32, written before any model saw the data):

- **Label map** (to the project's five classes): control group → healthy; asthma → asthma; pneumonia
  (severe or non-severe) → pneumonia; bronchitis, protracted bacterial bronchitis, bronchiolitis,
  bronchiectasia and acute upper respiratory infection → bronchial (the grouping ``reorganize_icbhi.py``
  uses for URTI / bronchiectasis / bronchiolitis); everything else (other respiratory diseases, chronic
  cough, hemoptysis, airway foreign body, pulmonary hemosiderosis, Kawasaki disease, "-") →
  ``out_of_label``. There is no COPD in this paediatric cohort.
- **Patient label**: the summaries are merged. A generic entry ("other respiratory (diseases)", "-") is
  replaced by any specific diagnosis the same patient has in another table (28 of 29 cross-table
  differences are such refinements). Specific diagnoses that map to different classes make the patient
  ``patient_label_conflict`` (1 patient: bronchitis vs pneumonia) and exclude them.
- **Recording status**: ``ok`` rows are evaluated. ``no_patient_number`` (390 file names start with an
  underscore), ``not_in_summary`` (most of the 2025 release), ``patient_label_conflict`` and
  ``byte_duplicate`` (later copy of an identical file) are kept in the manifest but never evaluated.

Usage (from ``backend/``)::

    python sprsound.py --root dataset/SPRSound
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

OUT_OF_LABEL = "out_of_label"
RELEASES = ("BioCAS2022", "BioCAS2023", "BioCAS2024", "BioCAS2025")
SUMMARIES = {
    "2022": "SPRSound_patient_summary.csv",
    "2023": "Grand_Challenge'23_patient_summary.csv",
    "2024": "Grand_Challenge'24_patient_summary.csv",
}
NAME = re.compile(r"^(?P<patient>\d*)_(?P<age>[\d.]+)_(?P<gender>[01])_(?P<site>p\d)_(?P<recording>\d+)$")
LABELS = {
    "control group": "healthy",
    "asthma": "asthma",
    "pneumonia (non-severe)": "pneumonia",
    "pneumonia (severe)": "pneumonia",
    "bronchitis": "bronchial",
    "protracted bacterial bronchitis": "bronchial",
    "bronchiolitis": "bronchial",
    "bronchiectasia": "bronchial",
    "acute upper respiratory infection": "bronchial",
}
GENERIC = {"other respiratory", "other respiratory diseases", "-"}


def parse_name(path: str | Path) -> dict[str, object] | None:
    """Patient number (``""`` if missing), age in years, gender, chest site and recording number."""
    match = NAME.match(Path(path).stem)
    if not match:
        return None
    return {"patient": match["patient"], "age": float(match["age"]), "gender": match["gender"],
            "site": match["site"], "recording": match["recording"]}


def read_summaries(root: str | Path) -> dict[str, dict[str, str]]:
    """Patient number → {table year: lower-cased raw diagnosis}."""
    out: dict[str, dict[str, str]] = defaultdict(dict)
    for year, name in SUMMARIES.items():
        with (Path(root) / "Patient Summary" / name).open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                out[row["patient_num"].strip()][year] = " ".join(row["disease"].strip().lower().split())
    return out


def patient_label(diagnoses: dict[str, str]) -> tuple[str, str]:
    """(project label or ``patient_label_conflict``, the raw diagnosis it came from)."""
    specific = sorted({d for d in diagnoses.values() if d not in GENERIC})
    if not specific:
        return OUT_OF_LABEL, sorted(set(diagnoses.values()))[0]
    classes = {LABELS.get(d, OUT_OF_LABEL) for d in specific}
    if len(classes) > 1:
        return "patient_label_conflict", " | ".join(specific)
    return classes.pop(), specific[0]


def build_manifest(root: str | Path) -> list[dict[str, object]]:
    root = Path(root)
    summaries = read_summaries(root)
    wavs = [w for release in RELEASES for w in sorted((root / release).rglob("*.wav"))]
    seen: dict[str, Path] = {}
    rows = []
    for wav in wavs:
        parsed = parse_name(wav)
        digest = hashlib.sha256(wav.read_bytes()).hexdigest()
        patient = str(parsed["patient"]) if parsed else ""
        diagnoses = summaries.get(patient, {})
        label, raw = patient_label(diagnoses) if diagnoses else ("", "")
        if parsed is None or not patient:
            status = "no_patient_number"
        elif not diagnoses:
            status = "not_in_summary"
        elif label == "patient_label_conflict":
            status = "patient_label_conflict"
        elif digest in seen:
            status = "byte_duplicate"
        else:
            status = "ok"
        seen.setdefault(digest, wav)
        rows.append({
            "path": wav.as_posix(), "release": wav.relative_to(root).parts[0], "patient_id": patient,
            "age": parsed["age"] if parsed else "", "gender": parsed["gender"] if parsed else "",
            "site": parsed["site"] if parsed else "", "diagnosis_raw": raw,
            "label": "" if label == "patient_label_conflict" else label, "status": status, "sha256": digest,
            "duplicate_of": seen[digest].as_posix() if status == "byte_duplicate" else "",
        })
    return rows


def summarize(rows: list[dict[str, object]], root: str | Path) -> dict[str, object]:
    ok = [r for r in rows if r["status"] == "ok"]
    patients: dict[str, dict[str, object]] = {}
    for r in ok:
        patients.setdefault(str(r["patient_id"]), {"label": r["label"], "ages": []})["ages"].append(float(r["age"]))
    by_label: dict[str, dict[str, object]] = {}
    for label in sorted({str(p["label"]) for p in patients.values()}):
        members = [p for p in patients.values() if p["label"] == label]
        ages = [statistics.median(p["ages"]) for p in members]
        by_label[label] = {"patients": len(members), "recordings": sum(len(p["ages"]) for p in members),
                           "age_median": round(statistics.median(ages), 2), "age_min": min(ages), "age_max": max(ages)}
    try:
        commit = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True, timeout=20).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        commit = ""
    return {"source": "https://github.com/SJTU-YONGFU-RESEARCH-GRP/SPRSound (CC-BY-4.0)", "source_commit": commit,
            "files": len(rows), "status": dict(Counter(str(r["status"]) for r in rows)),
            "evaluated_patients": len(patients), "evaluated_recordings": len(ok), "by_label": by_label,
            "by_release_ok": dict(Counter(str(r["release"]) for r in ok))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", default="dataset/SPRSound")
    parser.add_argument("--output", default="data/sprsound_manifest.csv")
    args = parser.parse_args()
    rows = build_manifest(args.root)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = summarize(rows, args.root)
    out.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
