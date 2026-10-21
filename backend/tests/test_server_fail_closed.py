import io

import pytest

import server

WAV_BYTES = b"RIFF" + (200).to_bytes(4, "little") + b"WAVEfmt " + b"\x00" * 200


@pytest.fixture
def unverified_server(monkeypatch):
    """Put the module into the state it has when no contract verifies."""
    for name in ("CONTRACT", "MODEL_METADATA", "PREPROCESSING", "MODEL_PATH",
                 "MODEL_CONTRACT_STATUS", "MODEL_CONTRACT_ERROR", "CLASSES", "model"):
        monkeypatch.setattr(server, name, getattr(server, name))
    monkeypatch.setattr(server, "MODEL_METADATA_PATH", "/nonexistent/model_metadata.json")
    server.CLASSES = server.load_model_contract()
    server.model = None
    return server.app.test_client()


def test_contract_failure_disables_inference_without_legacy_fallback(unverified_server):
    assert server.CLASSES == []
    assert server.MODEL_CONTRACT_STATUS == "unverified"
    assert not server.MODEL_PATH.endswith(".h5")
    with pytest.raises(RuntimeError):
        server.load_model_once()


def test_inference_endpoints_return_503_without_verified_contract(unverified_server):
    predict = unverified_server.post(
        "/predict", data={"file": (io.BytesIO(WAV_BYTES), "recording.wav")}
    )
    sample = unverified_server.get("/predict-sample/copd")
    summary = unverified_server.post(
        "/summarize",
        json={"model_result": {"prediction": "copd", "confidence": 50},
              "external_llm_consent": True},
    )
    assert predict.status_code == 503
    assert sample.status_code == 503
    assert summary.status_code == 503


def test_health_reports_status_without_loading_model(unverified_server, monkeypatch):
    def fail_if_called():
        raise AssertionError("/health must not load the model")

    monkeypatch.setattr(server, "load_model_once", fail_if_called)
    response = unverified_server.get("/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["ready"] is False
    assert body["model"] is False
    assert body["model_contract"] == "unverified"
