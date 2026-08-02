import pytest

from audio_validation import validate_audio_upload


def test_audio_validation_accepts_matching_wav_signature():
    assert validate_audio_upload("recording.wav", b"RIFF1234WAVEdata") == "recording.wav"


def test_audio_validation_rejects_mismatched_content():
    with pytest.raises(ValueError, match="does not match"):
        validate_audio_upload("recording.wav", b"not audio")
