import csv

import pytest

from featureExtraction import AudioRecord
from kauh import KAUH_ID_BASE, OUT_OF_LABEL, external_manifest, parse_name
from main import assign_kauh_patient_ids

FIELDS = ["clip", "clip_class", "best_ncc", "reference", "is_overlap"]


def _evidence(path, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return path


def test_names_parse_into_patient_filter_and_label():
    recording = parse_name("BP12_Asthma,E W,P L R,24,M.wav")
    assert (recording.patient, recording.filter, recording.label) == (12, "bell", "asthma")
    assert recording.patient_id == KAUH_ID_BASE + 12
    assert parse_name("EP99_N,N,P R M,50,M.wav").label == "healthy"
    assert parse_name("DP3_BRON,Crep,P R L ,20,M.wav").label == "bronchial"
    combined = parse_name("BP7_Asthma and lung fibrosis,C,P L R,60,F.wav")
    assert combined.label == OUT_OF_LABEL and combined.primary_label == "asthma"
    assert parse_name("BP9_Heart Failure + COPD,C,P L R,60,F.wav").label == OUT_OF_LABEL
    with pytest.raises(ValueError):
        parse_name("P54WheezingIE_269.wav")


def test_kaggle_clips_cut_from_kauh_take_the_real_patient_id(tmp_path):
    records = [
        AudioRecord(tmp_path / "asthma" / "P1AsthmaIE_1.wav", 111, "asthma", "kaggle_asthma_v2"),
        AudioRecord(tmp_path / "asthma" / "P2AsthmaIE_2.wav", 222, "asthma", "kaggle_asthma_v2"),
        AudioRecord(tmp_path / "healthy" / "P3Healthy1S.wav", 333, "healthy", "kaggle_asthma_v2"),
        AudioRecord(tmp_path / "copd" / "104_1b1_Al_sc_Meditron.wav", 104, "copd", "icbhi"),
    ]
    evidence = _evidence(tmp_path / "e.csv", [
        {"clip": "asthma/P1AsthmaIE_1.wav", "clip_class": "asthma", "best_ncc": 0.99,
         "reference": "BP5_Asthma,E W,P L R,24,M.wav", "is_overlap": True},
        {"clip": "asthma/P2AsthmaIE_2.wav", "clip_class": "asthma", "best_ncc": 0.98,
         "reference": "EP5_Asthma,E W,P L R,24,M.wav", "is_overlap": True},
        {"clip": "healthy/P3Healthy1S.wav", "clip_class": "healthy", "best_ncc": 0.2,
         "reference": "BP9_N,N,P R M,50,M.wav", "is_overlap": False},
    ])
    updated, report = assign_kauh_patient_ids(records, evidence)
    assert [r.patient_id for r in updated] == [KAUH_ID_BASE + 5, KAUH_ID_BASE + 5, 333, 104]
    assert report["reassigned_recordings"] == 2
    assert report["kauh_patients"] == 1 and report["previous_pseudo_patients"] == 2


def test_label_conflict_and_missing_coverage_fail_closed(tmp_path):
    clip = AudioRecord(tmp_path / "pneumonia" / "P1Pneumonia1.wav", 1, "pneumonia", "kaggle_asthma_v2")
    conflict = _evidence(tmp_path / "c.csv", [
        {"clip": "pneumonia/P1Pneumonia1.wav", "clip_class": "pneumonia", "best_ncc": 0.99,
         "reference": "BP5_Asthma,E W,P L R,24,M.wav", "is_overlap": True},
    ])
    with pytest.raises(ValueError, match="diagnosed"):
        assign_kauh_patient_ids([clip], conflict)
    empty = _evidence(tmp_path / "empty.csv", [])
    with pytest.raises(ValueError, match="does not cover"):
        assign_kauh_patient_ids([clip], empty)
    with pytest.raises(FileNotFoundError):
        assign_kauh_patient_ids([clip], tmp_path / "missing.csv")


def test_external_manifest_excludes_patients_used_by_kaggle(tmp_path):
    audio = tmp_path / "audio"
    audio.mkdir()
    for name in ("BP5_Asthma,E W,P L R,24,M.wav", "BP9_N,N,P R M,50,M.wav", "DP9_N,N,P R M,50,M.wav",
                 "BP11_heart failure,C,P R M,70,M.wav"):
        (audio / name).write_bytes(b"RIFF")
    evidence = _evidence(tmp_path / "e.csv", [
        {"clip": "asthma/P1AsthmaIE_1.wav", "clip_class": "asthma", "best_ncc": 0.99,
         "reference": "BP5_Asthma,E W,P L R,24,M.wav", "is_overlap": True},
    ])
    rows = external_manifest(audio, evidence)
    assert sorted((r["patient_id"] - KAUH_ID_BASE, r["label"]) for r in rows) == [
        (9, "healthy"), (9, "healthy"), (11, OUT_OF_LABEL)
    ]


def test_training_split_takes_half_of_each_class_and_keeps_out_of_label_external():
    from kauh import split_for_training

    rows = [{"patient_id": KAUH_ID_BASE + i, "label": label}
            for i, label in enumerate(["healthy"] * 6 + ["copd"] * 4 + ["bronchial"] + [OUT_OF_LABEL] * 3)]
    cohort, external = split_for_training(rows)
    cohort_labels = sorted(r["label"] for r in cohort)
    assert cohort_labels == ["copd", "copd", "healthy", "healthy", "healthy"]
    assert {r["patient_id"] for r in cohort}.isdisjoint({r["patient_id"] for r in external})
    assert sum(r["label"] == OUT_OF_LABEL for r in external) == 3
    assert split_for_training(rows) == (cohort, external)  # deterministic
