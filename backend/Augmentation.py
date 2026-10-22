"""Audio augmentations used only for the training partition."""

from __future__ import annotations

from typing import TYPE_CHECKING

import librosa
import numpy as np

if TYPE_CHECKING:
    import tensorflow as tf


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


def spec_augment_tf(
    features: "tf.Tensor",
    num_freq_masks: int = 2,
    max_freq_mask: int = 15,
    num_time_masks: int = 2,
    max_time_mask: int = 25,
    fill_value: float = 0.0,
) -> "tf.Tensor":
    """Vectorized on-the-fly SpecAugment for 3D tensor batches (batch, time, freq)."""
    import tensorflow as tf

    shape = tf.shape(features)
    T, F = shape[1], shape[2]

    # 1. Frequency masking
    for _ in range(num_freq_masks):
        f = tf.random.uniform([], 0, max_freq_mask + 1, dtype=tf.int32)
        f0 = tf.random.uniform([], 0, tf.maximum(1, F - f + 1), dtype=tf.int32)
        f_indices = tf.range(F)
        f_mask = tf.logical_or(f_indices < f0, f_indices >= f0 + f)
        f_mask = tf.reshape(tf.cast(f_mask, features.dtype), [1, 1, F])
        features = features * f_mask + (1.0 - f_mask) * fill_value

    # 2. Time masking
    for _ in range(num_time_masks):
        t = tf.random.uniform([], 0, max_time_mask + 1, dtype=tf.int32)
        t0 = tf.random.uniform([], 0, tf.maximum(1, T - t + 1), dtype=tf.int32)
        t_indices = tf.range(T)
        t_mask = tf.logical_or(t_indices < t0, t_indices >= t0 + t)
        t_mask = tf.reshape(tf.cast(t_mask, features.dtype), [1, T, 1])
        features = features * t_mask + (1.0 - t_mask) * fill_value

    return features




def _biquad(b, a, data: np.ndarray) -> np.ndarray:
    from scipy.signal import lfilter

    return lfilter(np.asarray(b) / a[0], np.asarray(a) / a[0], data)


def device_response(data: np.ndarray, sample_rate: int, rng: np.random.Generator) -> np.ndarray:
    """Simulate a different stethoscope: random peaking EQ, spectral tilt and optional low-pass.

    Two peaking filters (150–1,800 Hz, ±6 dB, Q 0.7–2) and a 500 Hz low-shelf (±6 dB) reshape
    the in-band response (RBJ audio-EQ cookbook biquads); half of the time a 1.2–2 kHz low-pass
    mimics a band-limited device. Loudness is restored to the input RMS, so only the colour of the
    recording changes, not its content.
    """
    out = np.asarray(data, dtype=np.float64)
    for _ in range(2):
        f0, gain, q = rng.uniform(150, 1800), rng.uniform(-6, 6), rng.uniform(0.7, 2.0)
        amp, w0 = 10 ** (gain / 40), 2 * np.pi * f0 / sample_rate
        alpha = np.sin(w0) / (2 * q)
        out = _biquad(
            [1 + alpha * amp, -2 * np.cos(w0), 1 - alpha * amp],
            [1 + alpha / amp, -2 * np.cos(w0), 1 - alpha / amp],
            out,
        )
    gain = rng.uniform(-6, 6)
    amp, w0 = 10 ** (gain / 40), 2 * np.pi * 500 / sample_rate
    alpha = np.sin(w0) / 2 * np.sqrt(2)
    cos, root = np.cos(w0), 2 * np.sqrt(amp) * alpha
    out = _biquad(
        [amp * ((amp + 1) - (amp - 1) * cos + root), 2 * amp * ((amp - 1) - (amp + 1) * cos),
         amp * ((amp + 1) - (amp - 1) * cos - root)],
        [(amp + 1) + (amp - 1) * cos + root, -2 * ((amp - 1) + (amp + 1) * cos),
         (amp + 1) + (amp - 1) * cos - root],
        out,
    )
    if rng.random() < 0.5:
        from scipy.signal import butter, sosfilt

        cutoff = rng.uniform(1200, 2000)
        out = sosfilt(butter(4, cutoff, btype="lowpass", fs=sample_rate, output="sos"), out)
    original_rms = np.sqrt(np.mean(np.square(data))) + 1e-12
    out *= original_rms / (np.sqrt(np.mean(np.square(out))) + 1e-12)
    return out.astype(np.float32)
