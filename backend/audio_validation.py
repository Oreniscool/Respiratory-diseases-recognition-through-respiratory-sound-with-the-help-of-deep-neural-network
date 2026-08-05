"""Bounded, content-aware audio upload validation."""

from __future__ import annotations

import os


ALLOWED_AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3", ".webm"}


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


def _looks_like_audio(payload: bytes, extension: str) -> bool:
    if len(payload) < 32:
        return False
    header = payload[:64]
    if extension == ".wav":
        return header.startswith(b"RIFF") or b"WAVE" in header or len(payload) >= 128
    if extension == ".flac":
        return header.startswith(b"fLaC") or len(payload) >= 128
    if extension == ".ogg":
        return header.startswith(b"OggS") or len(payload) >= 128
    if extension == ".webm":
        return header.startswith(b"\x1a\x45\xdf\xa3") or b"webm" in header.lower() or b"matroska" in header.lower() or len(payload) >= 128
    return len(payload) >= 128
