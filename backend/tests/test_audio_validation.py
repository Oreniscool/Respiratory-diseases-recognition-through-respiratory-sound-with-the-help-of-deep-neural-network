import io
import random

import pytest

from audio_validation import validate_audio_upload

PADDING = b"\x00" * 256
VALID_HEADERS = {
    "recording.wav": b"RIFF\x24\x08\x00\x00WAVEfmt ",
    "recording.flac": b"fLaC\x00\x00\x00\x22",
    "recording.ogg": b"OggS\x00\x02\x00\x00",
    "recording.webm": b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81",
    "recording.mp3": b"ID3\x04\x00\x00\x00\x00",
    "bare-frame.mp3": b"\xff\xfb\x50\xc4\x00\x00",
    "recording.m4a": b"\x00\x00\x00\x1cftypM4A ",
}


def test_audio_validation_accepts_matching_wav_signature():
    assert validate_audio_upload("recording.wav", b"RIFF1234WAVEdata") == "recording.wav"


def test_audio_validation_rejects_mismatched_content():
    with pytest.raises(ValueError, match="does not match"):
        validate_audio_upload("recording.wav", b"not audio")


@pytest.mark.parametrize("filename,header", VALID_HEADERS.items())
def test_each_supported_container_signature_is_accepted(filename, header):
    assert validate_audio_upload(filename, header + PADDING) == filename


@pytest.mark.parametrize("filename", VALID_HEADERS)
def test_large_random_payload_is_rejected_for_every_extension(filename):
    # Regression: payloads >= 128 bytes used to pass regardless of content.
    payload = bytes(random.Random(0).randrange(1, 255) for _ in range(4096))
    payload = b"\x01" + payload[1:]  # never a valid magic number
    with pytest.raises(ValueError, match="does not match"):
        validate_audio_upload(filename, payload)


def test_container_must_match_declared_extension():
    with pytest.raises(ValueError, match="does not match"):
        validate_audio_upload("recording.wav", VALID_HEADERS["recording.ogg"] + PADDING)


def test_unsupported_extension_is_rejected_even_when_large():
    with pytest.raises(ValueError, match="Unsupported audio extension"):
        validate_audio_upload("payload.exe", VALID_HEADERS["recording.wav"] + PADDING)


def test_filename_path_components_are_stripped():
    assert validate_audio_upload("../../etc/clip.wav", VALID_HEADERS["recording.wav"] + PADDING) == "clip.wav"


def test_predict_rejects_invalid_uploads_before_inference(monkeypatch):
    import server

    def fail_if_called():
        raise AssertionError("invalid uploads must not reach the model")

    monkeypatch.setattr(server, "load_model_once", fail_if_called)
    client = server.app.test_client()
    for filename, payload in (
        ("random.wav", b"\x01" * 4096),
        ("payload.exe", VALID_HEADERS["recording.wav"] + PADDING),
    ):
        response = client.post("/predict", data={"file": (io.BytesIO(payload), filename)})
        assert response.status_code == 400, filename
