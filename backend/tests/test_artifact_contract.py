import hashlib
import json

import pytest

from artifact_contract import load_verified_contract
from preprocessing import PreprocessingConfig


def _write_contract(tmp_path):
    model = tmp_path / "best_model.keras"
    model.write_bytes(b"model-bytes")
    (tmp_path / "test_metrics.json").write_text("{}", encoding="utf-8")
    (tmp_path / "calibration.json").write_text('{"temperature": 1.0}', encoding="utf-8")
    (tmp_path / "dataset_audit.json").write_text("{}", encoding="utf-8")
    metadata = {
        "schema_version": 2,
        "source_revision": "test",
        "model_filename": model.name,
        "model_sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
        "classes": ["first", "second"],
        "preprocessing": PreprocessingConfig().to_dict(),
        "evaluation_file": "test_metrics.json",
        "calibration_file": "calibration.json",
        "data_provenance": {
            "dataset_audit_file": "dataset_audit.json",
            "diagnosis_sha256": "a",
            "audio_inventory_sha256": "b",
        },
    }
    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
    return model, metadata_path


def test_contract_preserves_metadata_class_order(tmp_path):
    model, metadata = _write_contract(tmp_path)
    contract = load_verified_contract(model, metadata)
    assert contract.classes == ["first", "second"]
    assert contract.preprocessing.window_hop == 100


def test_contract_rejects_tampered_model(tmp_path):
    model, metadata = _write_contract(tmp_path)
    model.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="hash"):
        load_verified_contract(model, metadata)
