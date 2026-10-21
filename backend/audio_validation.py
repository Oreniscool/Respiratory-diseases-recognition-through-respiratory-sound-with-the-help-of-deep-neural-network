"""Bounded, content-aware audio upload validation."""

from __future__ import annotations

import os


ALLOWED_AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3", ".webm", ".m4a"}

_EBML_MAGIC = b"\x1a\x45\xdf\xa3"  # WebM / Matroska


def validate_audio_upload(filename: str, payload: bytes) -> str:
    """Validate an allowlisted filename and matching container signature."""
    safe_name = os.path.basename(filename or "")
    if not safe_name:
        raise ValueError("Empty filename")
    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise ValueError(f"Unsupported audio extension '{extension or '<none>'}'")
    if not payload:
        raise ValueError("Empty file")
    if not _looks_like_audio(payload, extension):
        raise ValueError("File content does not match the declared audio type")
    return safe_name


def _is_mp3(payload: bytes) -> bool:
    if payload.startswith(b"ID3"):
        return True
    # MPEG audio frame sync: 11 set bits at the start of the first frame header.
    return payload[0] == 0xFF and (payload[1] & 0xE0) == 0xE0


def _looks_like_audio(payload: bytes, extension: str) -> bool:
    """Require the container signature that matches the declared extension."""
    if len(payload) < 12:
        return False
    if extension == ".wav":
        return payload[:4] == b"RIFF" and payload[8:12] == b"WAVE"
    if extension == ".flac":
        return payload[:4] == b"fLaC"
    if extension == ".ogg":
        return payload[:4] == b"OggS"
    if extension == ".webm":
        return payload[:4] == _EBML_MAGIC
    if extension == ".mp3":
        return _is_mp3(payload)
    if extension == ".m4a":
        return payload[4:8] == b"ftyp"
    return False
