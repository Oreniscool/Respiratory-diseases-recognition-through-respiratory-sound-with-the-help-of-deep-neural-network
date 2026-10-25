import csv

import soundfile as sf
import numpy as np

from sprsound import OUT_OF_LABEL, build_manifest, parse_name, patient_label, summarize


def test_parse_name_handles_a_missing_patient_number():
    assert parse_name("65044484_6.1_1_p2_17113.wav")["patient"] == "65044484"
    parsed = parse_name("_3.9_0_p1_14465.wav")
    assert parsed["patient"] == "" and parsed["age"] == 3.9 and parsed["gender"] == "0"
    assert parse_name("not-a-recording.wav") is None


def test_patient_label_rules():
    assert patient_label({"2022": "pneumonia (severe)"})[0] == "pneumonia"
    assert patient_label({"2022": "control group"})[0] == "healthy"
    # a generic entry is refined by a specific one in another table
    assert patient_label({"2022": "other respiratory diseases", "2024": "bronchiolitis"}) == ("bronchial", "bronchiolitis")
    assert patient_label({"2022": "other respiratory diseases", "2024": "hemoptysis"})[0] == OUT_OF_LABEL
    assert patient_label({"2023": "-"})[0] == OUT_OF_LABEL
    # two specific diagnoses in different classes cannot be resolved
    assert patient_label({"2022": "bronchitis", "2024": "pneumonia (non-severe)"})[0] == "patient_label_conflict"


def _write(path, seed):
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, np.random.default_rng(seed).standard_normal(800).astype("float32") * 0.1, 8000)


def test_manifest_flags_unusable_recordings_and_duplicates(tmp_path):
    root = tmp_path / "SPR"
    for year in ("2022", "2023", "2024"):
        (root / "Patient Summary").mkdir(parents=True, exist_ok=True)
    rows = {"2022": [("11111111", "Control Group"), ("22222222", "Pneumonia (non-severe)"), ("33333333", "Bronchitis")],
            "2023": [], "2024": [("33333333", "Pneumonia (non-severe)")]}
    names = {"2022": "SPRSound_patient_summary.csv", "2023": "Grand_Challenge'23_patient_summary.csv",
             "2024": "Grand_Challenge'24_patient_summary.csv"}
    for year, entries in rows.items():
        with (root / "Patient Summary" / names[year]).open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["patient_num", "disease", "age", "gender"])
            writer.writerows([[p, d, "5", "F"] for p, d in entries])
    _write(root / "BioCAS2022" / "train2022_wav" / "11111111_5_1_p1_1.wav", 1)
    _write(root / "BioCAS2022" / "train2022_wav" / "22222222_5_1_p1_2.wav", 2)
    _write(root / "BioCAS2022" / "train2022_wav" / "33333333_5_1_p1_3.wav", 3)  # conflicting label
    _write(root / "BioCAS2023" / "test2023_wav" / "_5_1_p1_4.wav", 4)  # no patient number
    _write(root / "BioCAS2025" / "test2025_wav" / "99999999_5_1_p1_5.wav", 5)  # not in any summary
    (root / "BioCAS2024" / "test2024_wav").mkdir(parents=True)
    (root / "BioCAS2024" / "test2024_wav" / "22222222_5_1_p2_6.wav").write_bytes(
        (root / "BioCAS2022" / "train2022_wav" / "22222222_5_1_p1_2.wav").read_bytes())  # identical audio
    manifest = {r["path"].split("/")[-1]: r for r in build_manifest(root)}
    assert manifest["11111111_5_1_p1_1.wav"]["status"] == "ok" and manifest["11111111_5_1_p1_1.wav"]["label"] == "healthy"
    assert manifest["22222222_5_1_p1_2.wav"]["status"] == "ok"
    assert manifest["22222222_5_1_p2_6.wav"]["status"] == "byte_duplicate"
    assert manifest["33333333_5_1_p1_3.wav"]["status"] == "patient_label_conflict"
    assert manifest["_5_1_p1_4.wav"]["status"] == "no_patient_number"
    assert manifest["99999999_5_1_p1_5.wav"]["status"] == "not_in_summary"
    summary = summarize(list(manifest.values()), root)
    assert summary["evaluated_patients"] == 2 and summary["evaluated_recordings"] == 2
