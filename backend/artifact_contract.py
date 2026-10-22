"""Strict, testable validation for a deployable RespiNet model artifact."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from preprocessing import PreprocessingConfig


@dataclass(frozen=True)
class ModelContract:
    model_path: Path
    metadata_path: Path
    classes: list[str]
    preprocessing: PreprocessingConfig
    metadata: dict[str, object]
    fusion: dict[str, object] | None = None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_verified_contract(model_path: str | Path, metadata_path: str | Path) -> ModelContract:
    """Load a model only when its complete evidence contract is present and valid."""
    model_path = Path(model_path)
    metadata_path = Path(metadata_path)
    if not model_path.is_file():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    if not metadata_path.is_file():
        raise FileNotFoundError(f"Required model metadata not found: {metadata_path}")

    with metadata_path.open(encoding="utf-8") as handle:
        metadata = json.load(handle)
    required = {
        "schema_version",
        "model_filename",
        "model_sha256",
        "classes",
        "preprocessing",
        "evaluation_file",
        "calibration_file",
        "data_provenance",
        "source_revision",
    }
    missing = sorted(required.difference(metadata))
    if missing:
        raise ValueError(f"Model metadata is missing fields: {missing}")
    if int(metadata["schema_version"]) < 2:
        raise ValueError("Model metadata schema is obsolete; retrain with the current pipeline")
    if metadata["model_filename"] != model_path.name:
        raise ValueError("model_filename does not match the selected model")
    expected_hash = metadata["model_sha256"]
    if not isinstance(expected_hash, str) or len(expected_hash) != 64:
        raise ValueError("Model metadata contains an invalid SHA-256 hash")
    if _sha256(model_path) != expected_hash:
        raise ValueError("Model hash does not match model_metadata.json")

    classes = metadata["classes"]
    if (
        not isinstance(classes, list)
        or not classes
        or not all(isinstance(item, str) and item.strip() for item in classes)
        or len(set(classes)) != len(classes)
    ):
        raise ValueError("Model metadata contains an invalid ordered class list")
    if not isinstance(metadata["preprocessing"], dict):
        raise ValueError("Model metadata is missing preprocessing settings")
    preprocessing = PreprocessingConfig.from_dict(metadata["preprocessing"])

    for key in ("evaluation_file", "calibration_file"):
        referenced = metadata_path.parent / str(metadata[key])
        if not referenced.is_file():
            raise FileNotFoundError(f"Model metadata references a missing file: {referenced}")
        with referenced.open(encoding="utf-8") as handle:
            json.load(handle)
    if not isinstance(metadata["data_provenance"], dict):
        raise ValueError("Model metadata contains invalid data provenance")
    audit_name = metadata["data_provenance"].get("dataset_audit_file")
    if not isinstance(audit_name, str) or not (metadata_path.parent / audit_name).is_file():
        raise FileNotFoundError("Model metadata references a missing dataset audit")
    fusion = _verify_fusion(metadata.get("fusion"), metadata_path.parent)
    return ModelContract(model_path, metadata_path, list(classes), preprocessing, metadata, fusion)


def _verify_fusion(fusion: object, artifact_dir: Path) -> dict[str, object] | None:
    """A fusion artifact must ship a hash-matching YAMNet SavedModel and classifier head."""
    if fusion is None:
        return None
    from pretrained import FUSION_TYPE, directory_sha256

    if not isinstance(fusion, dict) or fusion.get("type") != FUSION_TYPE:
        raise ValueError("Model metadata contains an unsupported fusion definition")
    weights = fusion.get("weights")
    if not (isinstance(weights, list) and len(weights) == 2 and all(float(w) >= 0 for w in weights)):
        raise ValueError("Fusion weights must be two non-negative numbers")
    for key in ("respinet_temperature", "yamnet_temperature"):
        if not float(fusion.get(key, 0)) > 0:
            raise ValueError(f"Fusion {key} must be positive")
    head = artifact_dir / str(fusion.get("head_filename"))
    if not head.is_file() or _sha256(head) != fusion.get("head_sha256"):
        raise ValueError("Fusion head is missing or its hash does not match model_metadata.json")
    yamnet = artifact_dir / str(fusion.get("yamnet_dir"))
    if not yamnet.is_dir() or directory_sha256(yamnet) != fusion.get("yamnet_sha256"):
        raise ValueError("YAMNet model is missing or its hash does not match model_metadata.json")
    return fusion
