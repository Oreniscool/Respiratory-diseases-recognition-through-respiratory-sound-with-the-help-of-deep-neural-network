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


def spec_augment(
    features: np.ndarray,
    valid_length: int | None = None,
    num_freq_masks: int = 2,
    max_freq_mask: int = 15,
    num_time_masks: int = 2,
    max_time_mask: int = 25,
    fill_value: float = 0.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Apply SpecAugment (frequency and time masking) to a 2D feature matrix (T, F).

    Parameters
    ----------
    features : np.ndarray
        Array of shape (time_steps, feature_dim), e.g. (200, 120).
    valid_length : int, optional
        The number of valid non-padded frames. If None, uses features.shape[0].
    num_freq_masks : int
        Number of frequency mask strips to apply (default: 2).
    max_freq_mask : int
        Maximum width of each frequency mask strip (default: 15).
    num_time_masks : int
        Number of time mask strips to apply (default: 2).
    max_time_mask : int
        Maximum width of each time mask strip (default: 25).
    fill_value : float
        Value to fill in masked regions (default: 0.0).
    rng : np.random.Generator, optional
        Random number generator.

    Returns
    -------
    np.ndarray
        Augmented feature matrix of the same shape.
    """
    if features.ndim != 2:
        raise ValueError(f"Expected a 2D feature matrix, got shape {features.shape}")

    generator = rng or np.random.default_rng()
    augmented = features.copy()
    num_steps, num_freqs = augmented.shape
    valid_t = valid_length if valid_length is not None else num_steps
    valid_t = max(1, min(num_steps, int(valid_t)))

    # 1. Frequency masking: mask contiguous frequency channels across all time steps
    for _ in range(num_freq_masks):
        f_len = int(generator.integers(0, max_freq_mask + 1))
        if f_len >= num_freqs or f_len <= 0:
            continue
        f_start = int(generator.integers(0, num_freqs - f_len + 1))
        augmented[:, f_start : f_start + f_len] = fill_value

    # 2. Time masking: mask contiguous time steps across all frequency channels
    # (applied only within non-padded valid frame region)
    for _ in range(num_time_masks):
        t_len = int(generator.integers(0, max_time_mask + 1))
        if t_len >= valid_t or t_len <= 0:
            continue
        t_start = int(generator.integers(0, valid_t - t_len + 1))
        augmented[t_start : t_start + t_len, :] = fill_value

    return augmented


