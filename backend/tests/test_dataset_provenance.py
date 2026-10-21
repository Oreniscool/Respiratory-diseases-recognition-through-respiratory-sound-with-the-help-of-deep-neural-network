import hashlib
import json

import pandas as pd
import pytest

from dataset_provenance import ICBHI_2017_PATIENT_COUNTS, load_and_validate_provenance
from reorganize_icbhi import reorganize

# A scrambled per-patient label distribution (as declared in the repo's stale provenance file).
SCRAMBLED_COUNTS = {
    "Asthma": 13, "Bronchiectasis": 14, "Bronchiolitis": 17, "COPD": 13,
    "Healthy": 17, "LRTI": 12, "Pneumonia": 18, "URTI": 17,
}


def _diagnoses(counts: dict[str, int]) -> pd.DataFrame:
    rows, patient_id = [], 101
    for disease, count in sorted(counts.items()):
        for _ in range(count):
            rows.append({"patient_id": patient_id, "disease": disease})
            patient_id += 1
    return pd.DataFrame(rows)


def _write_dataset(tmp_path, counts, declared_counts):
    csv_path = tmp_path / "patient_diagnosis.csv"
    _diagnoses(counts).to_csv(csv_path, index=False)
    provenance = {
        "dataset_name": "ICBHI 2017 Respiratory Sound Database",
        "source_url": "https://example.invalid/icbhi",
        "download_date": "2026-10-21",
        "license": "test",
        "diagnosis_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "label_counts": declared_counts,
    }
    provenance_path = tmp_path / "dataset_provenance.json"
    provenance_path.write_text(json.dumps(provenance), encoding="utf-8")
    return csv_path, provenance_path


def test_authentic_labels_pass(tmp_path):
    csv_path, provenance_path = _write_dataset(
        tmp_path, ICBHI_2017_PATIENT_COUNTS, ICBHI_2017_PATIENT_COUNTS
    )
    assert load_and_validate_provenance(csv_path, provenance_path)["label_counts"]


def test_self_declared_scrambled_counts_are_rejected(tmp_path):
    # Regression: a provenance file that declared the scrambled counts used to vouch for itself.
    csv_path, provenance_path = _write_dataset(tmp_path, SCRAMBLED_COUNTS, SCRAMBLED_COUNTS)
    with pytest.raises(ValueError, match="published ICBHI 2017"):
        load_and_validate_provenance(csv_path, provenance_path)


def test_authentic_declaration_cannot_cover_scrambled_csv(tmp_path):
    csv_path, provenance_path = _write_dataset(
        tmp_path, SCRAMBLED_COUNTS, ICBHI_2017_PATIENT_COUNTS
    )
    with pytest.raises(ValueError, match="authentic ICBHI 2017"):
        load_and_validate_provenance(csv_path, provenance_path)


def _icbhi_tree(tmp_path, counts):
    audio = tmp_path / "flat"
    audio.mkdir()
    diagnoses = _diagnoses(counts)
    for patient_id in diagnoses["patient_id"].head(3):
        (audio / f"{patient_id}_1b1_Al_sc_Meditron.wav").write_bytes(b"RIFF")
    csv_path = tmp_path / "diagnoses.csv"
    diagnoses.to_csv(csv_path, index=False)
    return audio, csv_path, diagnoses


def test_reorganize_refuses_scrambled_labels_before_writing(tmp_path):
    audio, csv_path, _ = _icbhi_tree(tmp_path, SCRAMBLED_COUNTS)
    with pytest.raises(ValueError, match="authentic ICBHI 2017"):
        reorganize(audio, csv_path, tmp_path / "out", copy=True)
    assert not (tmp_path / "out").exists()


def test_reorganize_sorts_files_and_requires_force_to_rebuild(tmp_path):
    audio, csv_path, diagnoses = _icbhi_tree(tmp_path, ICBHI_2017_PATIENT_COUNTS)
    out = tmp_path / "out"
    reorganize(audio, csv_path, out, copy=True)

    first = diagnoses.iloc[0]
    assert first["disease"] == "Asthma"  # alphabetical construction in _diagnoses
    assert (out / "asthma" / f"{first['patient_id']}_1b1_Al_sc_Meditron.wav").is_file()

    stale = out / "copd" / "stale_from_previous_run.wav"
    stale.write_bytes(b"RIFF")
    with pytest.raises(FileExistsError, match="--force"):
        reorganize(audio, csv_path, out, copy=True)

    reorganize(audio, csv_path, out, copy=True, force=True)
    assert not stale.exists()
    assert len(list(out.rglob("*.wav"))) == 3
