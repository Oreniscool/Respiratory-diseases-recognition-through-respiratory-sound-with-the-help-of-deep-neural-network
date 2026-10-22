import hashlib
import json

import numpy as np
import pytest

from artifact_contract import load_verified_contract
from calibration import apply_temperature
from pretrained import (
    FUSION_TYPE,
    directory_sha256,
    export_logistic_head,
    fit_logistic_head,
    fuse_probabilities,
)

CLASSES = ["asthma", "copd", "healthy"]


def _separable(n=90, dim=8, seed=0):
    rng = np.random.default_rng(seed)
    labels = np.asarray([CLASSES[i % 3] for i in range(n)])
    x = rng.standard_normal((n, dim)) * 3 + 5
    for index, label in enumerate(labels):
        x[index, CLASSES.index(label)] += 4
    return x, labels


def test_exported_keras_head_reproduces_the_fitted_regression(tmp_path):
    x, y = _separable()
    pipeline, chosen = fit_logistic_head(x[:60], y[:60], x[60:], y[60:])
    assert chosen["C"] in (0.001, 0.01, 0.1, 1.0)
    # Export in a different class order than sklearn's to check the column mapping.
    order = ["healthy", "asthma", "copd"]
    head = export_logistic_head(pipeline, order, tmp_path / "head.keras")
    expected = pipeline.predict_proba(x)[:, [list(pipeline.classes_).index(c) for c in order]]
    np.testing.assert_allclose(head.predict(x, verbose=0), expected, atol=1e-5)

    from tensorflow.keras.models import load_model

    reloaded = load_model(tmp_path / "head.keras")
    np.testing.assert_allclose(reloaded.predict(x, verbose=0), expected, atol=1e-5)


def test_fusion_averages_member_calibrated_probabilities():
    respinet = np.asarray([[0.7, 0.2, 0.1]])
    yamnet = np.asarray([[0.2, 0.6, 0.2]])
    fusion = {"weights": [0.5, 0.5], "respinet_temperature": 0.8, "yamnet_temperature": 1.3}
    expected = 0.5 * apply_temperature(respinet, 0.8) + 0.5 * apply_temperature(yamnet, 1.3)
    np.testing.assert_allclose(fuse_probabilities(respinet, yamnet, fusion), expected)
    only_respinet = {**fusion, "weights": [1.0, 0.0]}
    np.testing.assert_allclose(
        fuse_probabilities(respinet, yamnet, only_respinet), apply_temperature(respinet, 0.8)
    )


def test_directory_hash_changes_with_any_file(tmp_path):
    (tmp_path / "variables").mkdir()
    (tmp_path / "saved_model.pb").write_bytes(b"graph")
    (tmp_path / "variables" / "v.data").write_bytes(b"weights")
    before = directory_sha256(tmp_path)
    (tmp_path / "variables" / "v.data").write_bytes(b"weights2")
    assert directory_sha256(tmp_path) != before


def _fusion_artifact(tmp_path):
    model = tmp_path / "best_model.keras"
    model.write_bytes(b"model")
    head = tmp_path / "yamnet_head.keras"
    head.write_bytes(b"head")
    yamnet = tmp_path / "yamnet"
    yamnet.mkdir()
    (yamnet / "saved_model.pb").write_bytes(b"graph")
    for name in ("test_metrics.json", "calibration.json", "dataset_audit.json"):
        (tmp_path / name).write_text('{"temperature": 1.25}', encoding="utf-8")
    metadata = {
        "schema_version": 2,
        "model_filename": model.name,
        "model_sha256": hashlib.sha256(b"model").hexdigest(),
        "classes": CLASSES,
        "preprocessing": {},
        "evaluation_file": "test_metrics.json",
        "calibration_file": "calibration.json",
        "data_provenance": {"dataset_audit_file": "dataset_audit.json"},
        "source_revision": "rev",
        "fusion": {
            "type": FUSION_TYPE,
            "weights": [0.5, 0.5],
            "respinet_temperature": 0.9,
            "yamnet_temperature": 1.1,
            "head_filename": head.name,
            "head_sha256": hashlib.sha256(b"head").hexdigest(),
            "yamnet_dir": yamnet.name,
            "yamnet_sha256": directory_sha256(yamnet),
        },
    }
    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
    return model, metadata_path


def test_contract_verifies_fusion_members(tmp_path):
    model, metadata_path = _fusion_artifact(tmp_path)
    assert load_verified_contract(model, metadata_path).fusion["type"] == FUSION_TYPE

    (tmp_path / "yamnet" / "saved_model.pb").write_bytes(b"other graph")
    with pytest.raises(ValueError, match="YAMNet"):
        load_verified_contract(model, metadata_path)


def test_contract_rejects_a_tampered_head(tmp_path):
    model, metadata_path = _fusion_artifact(tmp_path)
    (tmp_path / "yamnet_head.keras").write_bytes(b"swapped")
    with pytest.raises(ValueError, match="head"):
        load_verified_contract(model, metadata_path)


def test_contract_without_fusion_is_unchanged(tmp_path):
    model, metadata_path = _fusion_artifact(tmp_path)
    metadata = json.loads(metadata_path.read_text())
    metadata.pop("fusion")
    metadata_path.write_text(json.dumps(metadata))
    assert load_verified_contract(model, metadata_path).fusion is None


def test_server_fuses_yamnet_before_the_final_temperature(tmp_path, monkeypatch):
    import server

    model, metadata_path = _fusion_artifact(tmp_path)
    contract = load_verified_contract(model, metadata_path)

    class Head:
        def predict(self, embedding, verbose=0):
            assert embedding.shape == (1, 4)
            return np.asarray([[0.1, 0.1, 0.8]])

    monkeypatch.setattr(server, "CONTRACT", contract)
    monkeypatch.setattr(server, "FUSION_HEAD", Head())
    monkeypatch.setattr(server, "YAMNET", object())
    monkeypatch.setattr(server, "yamnet_embedding", lambda model, audio: np.zeros(4))
    windows = np.asarray([[0.6, 0.3, 0.1], [0.8, 0.1, 0.1]])
    fused = server._aggregate_window_probabilities(windows, yamnet_audio=np.zeros(16_000))
    expected = apply_temperature(
        fuse_probabilities(windows.mean(0), np.asarray([[0.1, 0.1, 0.8]]), contract.fusion), 1.25
    )[0]
    np.testing.assert_allclose(fused, expected)

    with pytest.raises(RuntimeError, match="YAMNet audio"):
        server._aggregate_window_probabilities(windows, yamnet_audio=None)


def test_lung_sound_gate_rejects_tone_noise_and_silence_but_passes_real_recordings():
    import glob

    from pretrained import gate_reason, load_yamnet, load_yamnet_audio, lung_sound_gate

    yamnet_dir = "artifacts/pretrained/yamnet"
    import os

    if not os.path.isdir(yamnet_dir):
        pytest.skip("YAMNet SavedModel not downloaded")
    model = load_yamnet(yamnet_dir)
    t = np.arange(16_000 * 3) / 16_000
    tone = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    noise = np.random.default_rng(0).standard_normal(16_000 * 3).astype(np.float32) * 0.3
    silence = np.zeros(16_000 * 3, dtype=np.float32)
    for audio, reason in ((tone, "tone"), (noise, "noise"), (silence, "silent")):
        passes, scores = lung_sound_gate(model, audio)
        assert not passes and reason in gate_reason(scores)
    recordings = sorted(glob.glob("dataset/ICBHI_final_dataset/*.wav"))[:3]
    for path in recordings:
        assert lung_sound_gate(model, load_yamnet_audio(path))[0]


def _members_artifact(tmp_path):
    from pretrained import MEMBERS_FUSION_TYPE

    model, metadata_path = _fusion_artifact(tmp_path)
    (tmp_path / "respinet_seed43.keras").write_bytes(b"model2")
    opera = tmp_path / "opera_ce"
    opera.mkdir()
    (opera / "encoder-operaCE.ckpt").write_bytes(b"weights")
    (tmp_path / "opera_ce_head.keras").write_bytes(b"head2")
    metadata = json.loads(metadata_path.read_text())
    metadata["fusion"] = {
        "type": MEMBERS_FUSION_TYPE,
        "weights": [1.0, 1.0, 1.0],
        "members": [
            {"kind": "respinet", "files": [model.name, "respinet_seed43.keras"],
             "sha256": [hashlib.sha256(b"model").hexdigest(), hashlib.sha256(b"model2").hexdigest()],
             "temperature": 0.9},
            {"kind": "embedding_head", "extractor": "yamnet", "model_dir": "yamnet",
             "model_sha256": directory_sha256(tmp_path / "yamnet"), "head_file": "yamnet_head.keras",
             "head_sha256": hashlib.sha256(b"head").hexdigest(), "temperature": 1.1},
            {"kind": "embedding_head", "extractor": "opera_ce", "model_dir": "opera_ce",
             "model_sha256": directory_sha256(opera), "head_file": "opera_ce_head.keras",
             "head_sha256": hashlib.sha256(b"head2").hexdigest(), "temperature": 1.3},
        ],
    }
    metadata_path.write_text(json.dumps(metadata))
    return model, metadata_path


def test_members_fusion_math_and_contract(tmp_path):
    from pretrained import fuse_members

    model, metadata_path = _members_artifact(tmp_path)
    contract = load_verified_contract(model, metadata_path)
    probabilities = [np.asarray([[0.6, 0.3, 0.1]]), np.asarray([[0.1, 0.8, 0.1]]), np.asarray([[0.2, 0.2, 0.6]])]
    expected = sum(
        apply_temperature(p, m["temperature"]) for p, m in zip(probabilities, contract.fusion["members"])
    ) / 3
    np.testing.assert_allclose(fuse_members(probabilities, contract.fusion), expected)

    (tmp_path / "respinet_seed43.keras").write_bytes(b"tampered")
    with pytest.raises(ValueError, match="respinet_seed43"):
        load_verified_contract(model, metadata_path)


def test_members_contract_rejects_unknown_extractors_and_bad_weights(tmp_path):
    model, metadata_path = _members_artifact(tmp_path)
    metadata = json.loads(metadata_path.read_text())
    metadata["fusion"]["members"][2]["extractor"] = "mystery"
    metadata_path.write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="Unknown embedding extractor"):
        load_verified_contract(model, metadata_path)
    metadata["fusion"]["members"][2]["extractor"] = "opera_ce"
    metadata["fusion"]["weights"] = [1.0, 1.0]
    metadata_path.write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="one non-negative weight per member"):
        load_verified_contract(model, metadata_path)


def test_server_fuses_every_member_in_order(tmp_path, monkeypatch):
    import server
    from pretrained import fuse_members

    model, metadata_path = _members_artifact(tmp_path)
    contract = load_verified_contract(model, metadata_path)

    class Extractor:
        def __init__(self, vector):
            self.vector = vector

        def embed_waveform(self, waveform):
            return self.vector

    class Head:
        def __init__(self, output):
            self.output = output

        def predict(self, embedding, verbose=0):
            return np.asarray([self.output])

    members = contract.fusion["members"]
    monkeypatch.setattr(server, "CONTRACT", contract)
    monkeypatch.setattr(server, "EMBEDDING_MEMBERS", [
        (members[1], Extractor(np.zeros(4)), Head([0.1, 0.8, 0.1])),
        (members[2], Extractor(np.ones(4)), Head([0.2, 0.2, 0.6])),
    ])
    windows = np.asarray([[0.6, 0.3, 0.1], [0.8, 0.1, 0.1]])
    fused = server._aggregate_window_probabilities(windows, yamnet_audio=np.zeros(16_000))
    expected = apply_temperature(fuse_members(
        [windows.mean(0, keepdims=True), np.asarray([[0.1, 0.8, 0.1]]), np.asarray([[0.2, 0.2, 0.6]])],
        contract.fusion,
    ), 1.25)[0]
    np.testing.assert_allclose(fused, expected)
