"""Audio augmentations used only for the training partition."""

from __future__ import annotations

import librosa
import numpy as np


def add_noise(
    data: np.ndarray,
    snr_db: float = 20.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Add Gaussian noise at a signal-relative SNR instead of fixed amplitude."""
    generator = rng or np.random.default_rng()
    signal_rms = float(np.sqrt(np.mean(np.square(data, dtype=np.float64))))
    if signal_rms < 1e-12:
        return data.copy()

    noise = generator.normal(0.0, 1.0, size=data.shape)
    noise_rms = float(np.sqrt(np.mean(np.square(noise, dtype=np.float64))))
    target_noise_rms = signal_rms / (10.0 ** (snr_db / 20.0))
    return (data + noise * (target_noise_rms / max(noise_rms, 1e-12))).astype(
        np.float32
    )


def shift(data: np.ndarray, samples: int) -> np.ndarray:
    """Shift audio with zero fill; do not wrap the end into the beginning."""
    result = np.zeros_like(data)
    if samples == 0:
        return data.copy()
    if abs(samples) >= len(data):
        return result
    if samples > 0:
        result[samples:] = data[:-samples]
    else:
        result[:samples] = data[-samples:]
    return result


def stretch(data: np.ndarray, rate: float) -> np.ndarray:
    if rate <= 0:
        raise ValueError("Stretch rate must be positive")
    return librosa.effects.time_stretch(data, rate=rate).astype(np.float32)

