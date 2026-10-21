import io

import server

WAV_BYTES = b"RIFF" + (200).to_bytes(4, "little") + b"WAVEfmt " + b"\x00" * 200


def test_denoise_is_rejected_before_inference_when_disabled(monkeypatch):
    monkeypatch.setattr(server, "ALLOW_INFERENCE_DENOISING", False)

    def fail_if_called():
        raise AssertionError("a disabled denoise request must not reach the model")

    monkeypatch.setattr(server, "load_model_once", fail_if_called)
    client = server.app.test_client()

    predict = client.post(
        "/predict",
        data={"file": (io.BytesIO(WAV_BYTES), "recording.wav"), "denoise": "1"},
    )
    sample = client.get("/predict-sample/copd?denoise=1")

    for response in (predict, sample):
        assert response.status_code == 400
        assert "training preprocessing contract" in response.get_json()["error"]


def test_health_reports_whether_denoise_is_allowed(monkeypatch):
    client = server.app.test_client()
    monkeypatch.setattr(server, "ALLOW_INFERENCE_DENOISING", False)
    assert client.get("/health").get_json()["denoise_allowed"] is False
    monkeypatch.setattr(server, "ALLOW_INFERENCE_DENOISING", True)
    assert client.get("/health").get_json()["denoise_allowed"] is True
