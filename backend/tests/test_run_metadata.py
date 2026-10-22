import json
import re
import subprocess
import sys

import main
from artifact_contract import load_verified_contract


def _args(monkeypatch, *argv):
    monkeypatch.setattr(sys, "argv", ["main.py", *argv])
    return main.parse_args()


def test_cli_exposes_learning_rate_and_can_disable_focal_loss(monkeypatch):
    defaults = _args(monkeypatch)
    assert defaults.learning_rate == 3e-4
    assert defaults.use_focal_loss is True
    changed = _args(monkeypatch, "--learning-rate", "1e-3", "--no-use-focal-loss")
    assert changed.learning_rate == 1e-3
    assert changed.use_focal_loss is False


def test_source_revision_prefers_explicit_value_and_falls_back_safely(monkeypatch):
    assert main.resolve_source_revision("abc123") == "abc123"

    def broken_git(*_args, **_kwargs):
        raise OSError("git not installed")

    monkeypatch.setattr(main.subprocess, "run", broken_git)
    assert main.resolve_source_revision("unknown") == "unknown"


def test_source_revision_reads_git_when_available():
    try:
        subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, check=True)
    except (OSError, subprocess.SubprocessError):
        return  # not a git checkout; covered by the fallback test
    assert re.fullmatch(r"[0-9a-f]{40}(-dirty)?", main.resolve_source_revision("unknown"))


def test_metadata_records_hyperparameters_and_passes_contract(tmp_path, monkeypatch):
    args = _args(monkeypatch, "--batch-size", "64", "--epochs", "80", "--source-revision", "rev1")
    model_path = tmp_path / "best_model.keras"
    model_path.write_bytes(b"model-bytes")
    for name in ("test_metrics.json", "calibration.json", "dataset_audit.json"):
        (tmp_path / name).write_text("{}", encoding="utf-8")

    metadata = main.build_model_metadata(
        args,
        model_path=model_path,
        class_names=["asthma", "copd"],
        class_weights={0: 1.0, 1: 1.0},
        manifest_hash="f" * 64,
        dataset_audit={"diagnosis_sha256": "x", "audio_inventory_sha256": "y"},
        calibration={"abstention": {"min_confidence": 0.5}},
        use_online_spec_augment=True,
    )
    hyper = metadata["training"]["hyperparameters"]
    assert hyper["batch_size"] == 64 and hyper["max_epochs"] == 80
    assert hyper["learning_rate"] == 3e-4
    assert hyper["label_smoothing"] == 0.1
    assert hyper["loss"] == "categorical_focal" and hyper["focal_gamma"] == 2.0
    assert hyper["spec_augment"]["mode"] == "online"
    assert hyper["early_stopping"]["monitor"] == "val_accuracy"
    assert metadata["source_revision"] == "rev1"
    assert "tensorflow" in metadata["runtime"]

    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
    contract = load_verified_contract(model_path, metadata_path)
    assert contract.classes == ["asthma", "copd"]


def test_source_revision_is_captured_when_the_run_starts(monkeypatch):
    """A commit made while a long run trains must not be credited to that run."""
    args = _args(monkeypatch, "--dataset-format", "folder")
    monkeypatch.setattr(main, "resolve_source_revision", lambda explicit: "rev-at-start")

    class StopAfterResolve(Exception):
        pass

    def stop(*_args, **_kwargs):
        raise StopAfterResolve

    monkeypatch.setattr(main, "build_manifest_from_folders", stop)
    try:
        main.run_training(args)
    except StopAfterResolve:
        pass
    assert args.source_revision == "rev-at-start"


def test_feature_type_flag_reaches_the_persisted_contract(tmp_path, monkeypatch):
    args = _args(monkeypatch, "--feature-type", "logmel", "--n-mels", "48")
    assert main.preprocessing_config(args).feature_dim == 144
    model_path = tmp_path / "best_model.keras"
    model_path.write_bytes(b"m")
    metadata = main.build_model_metadata(
        args, model_path=model_path, class_names=["a", "b"], class_weights={0: 1.0, 1: 1.0},
        manifest_hash="f" * 64, dataset_audit={"diagnosis_sha256": "x", "audio_inventory_sha256": "y"},
        calibration={"abstention": {}},
        use_online_spec_augment=True,
    )
    assert metadata["preprocessing"]["feature_type"] == "logmel"
    assert metadata["preprocessing"]["n_mels"] == 48


def test_round2_training_options_are_recorded(tmp_path, monkeypatch):
    args = _args(monkeypatch, "--cudnn-gru", "--spec-augment-mode", "sample", "--mixup-alpha", "0.4",
                 "--device-augment", "--multitask")
    model_path = tmp_path / "best_model.keras"
    model_path.write_bytes(b"m")
    hyper = main.build_model_metadata(
        args, model_path=model_path, class_names=["a", "b"], class_weights={0: 1.0, 1: 1.0},
        manifest_hash="f" * 64, dataset_audit={"diagnosis_sha256": "x", "audio_inventory_sha256": "y"},
        calibration={"abstention": {}}, use_online_spec_augment=True,
    )["training"]["hyperparameters"]
    assert hyper["cudnn_gru"] is True and hyper["mixup_alpha"] == 0.4 and hyper["device_augment"] is True
    assert hyper["multitask"]["targets"] == ["crackles", "wheezes"]
    assert hyper["spec_augment"]["masks"] == "per sample"
    defaults = main.build_model_metadata(
        _args(monkeypatch), model_path=model_path, class_names=["a", "b"], class_weights={0: 1.0, 1: 1.0},
        manifest_hash="f" * 64, dataset_audit={"diagnosis_sha256": "x", "audio_inventory_sha256": "y"},
        calibration={"abstention": {}}, use_online_spec_augment=True,
    )["training"]["hyperparameters"]
    assert defaults["cudnn_gru"] is False and defaults["multitask"] is None
