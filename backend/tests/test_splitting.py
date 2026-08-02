from pathlib import Path

import pytest

from featureExtraction import AudioRecord
from main import split_by_patient


def _records():
    records = []
    for class_index in range(8):
        for patient_offset in range(15):
            patient_id = class_index * 100 + patient_offset
            for recording in range(2):
                records.append(
                    AudioRecord(
                        path=Path(f"{patient_id}_{recording}.wav"),
                        patient_id=patient_id,
                        disease=f"class-{class_index}",
                    )
                )
    return records


def test_patient_split_has_no_overlap_and_keeps_recordings_together():
    splits = split_by_patient(
        _records(), test_size=0.2, validation_size=0.2, seed=42
    )
    patient_sets = {
        split: {record.patient_id for record in records}
        for split, records in splits.items()
    }
    assert not patient_sets["train"] & patient_sets["validation"]
    assert not patient_sets["train"] & patient_sets["test"]
    assert not patient_sets["validation"] & patient_sets["test"]

    for split_records in splits.values():
        counts = {}
        for record in split_records:
            counts[record.patient_id] = counts.get(record.patient_id, 0) + 1
        assert set(counts.values()) == {2}


def test_patient_split_rejects_classes_that_cannot_fill_three_partitions():
    records = [
        AudioRecord(path=Path("1_0.wav"), patient_id=1, disease="rare"),
        AudioRecord(path=Path("2_0.wav"), patient_id=2, disease="rare"),
        AudioRecord(path=Path("3_0.wav"), patient_id=3, disease="common"),
        AudioRecord(path=Path("4_0.wav"), patient_id=4, disease="common"),
        AudioRecord(path=Path("5_0.wav"), patient_id=5, disease="common"),
    ]
    with pytest.raises(ValueError, match="fewer than three"):
        split_by_patient(records, test_size=0.2, validation_size=0.2, seed=42)
