"""Shared audio preprocessing used by training and inference.

Keeping these settings in one module prevents silent train/serve drift.  Model
artifacts also persist ``PreprocessingConfig.to_dict()`` so the server can
verify that it is using the same contract as training.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

import librosa
import numpy as np


from scipy.signal import butter, sosfiltfilt


@dataclass(frozen=True)
class PreprocessingConfig:
    sample_rate: int = 22_050
    n_mfcc: int = 40
    max_len: int = 200
    window_hop: int = 100
    use_deltas: bool = True
    hop_length: int = 512
    n_fft: int = 2_048
    res_type: str = "kaiser_fast"
    use_bandpass: bool = True
    lowcut: float = 100.0
    highcut: float = 2000.0
    use_cmvn: bool = True

    @property
    def feature_dim(self) -> int:
        return self.n_mfcc * (3 if self.use_deltas else 1)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)

    @classmethod
    def from_dict(cls, values: dict[str, object]) -> "PreprocessingConfig":
        allowed = set(cls.__dataclass_fields__)
        return cls(**{key: value for key, value in values.items() if key in allowed})


DEFAULT_PREPROCESSING = PreprocessingConfig()


def apply_bandpass_filter(
    data: np.ndarray,
    sample_rate: int,
    lowcut: float = 100.0,
    highcut: float = 2000.0,
    order: int = 4,
) -> np.ndarray:
    nyquist = 0.5 * sample_rate
    low = max(lowcut / nyquist, 1e-4)
    high = min(highcut / nyquist, 0.9999)
    if low >= high or data.size < 16:
        return data
    sos = butter(order, [low, high], btype="bandpass", output="sos")
    filtered = sosfiltfilt(sos, data)
    return filtered.astype(np.float32, copy=False)


def apply_cmvn(features: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    """Apply Cepstral Mean and Variance Normalization across time steps."""
    mean = np.mean(features, axis=0, keepdims=True)
    std = np.std(features, axis=0, keepdims=True)
    return ((features - mean) / (std + eps)).astype(np.float32, copy=False)


def load_audio(
    path: str | Path,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> tuple[np.ndarray, int]:
    """Load mono audio at the model's explicit target sample rate."""
    data, sample_rate = librosa.load(
        str(path),
        sr=config.sample_rate,
        mono=True,
        res_type=config.res_type,
    )
    if data.size == 0:
        raise ValueError("Audio contains no samples")
    if not np.isfinite(data).all():
        raise ValueError("Audio contains non-finite samples")
    return data.astype(np.float32, copy=False), int(sample_rate)


def pad_or_truncate(features: np.ndarray, max_len: int) -> np.ndarray:
    if features.ndim != 2:
        raise ValueError(f"Expected a 2D feature array, got shape {features.shape}")
    if features.shape[1] < max_len:
        pad_width = max_len - features.shape[1]
        return np.pad(features, ((0, 0), (0, pad_width)), mode="constant")
    return features[:, :max_len]


def extract_feature_sequence(
    data: np.ndarray,
    sample_rate: int,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> np.ndarray:
    """Return the complete, unpadded ``(time_steps, feature_dim)`` MFCC sequence."""
    if data.size == 0:
        raise ValueError("Cannot extract features from empty audio")

    if config.use_bandpass:
        data = apply_bandpass_filter(
            data, sample_rate, lowcut=config.lowcut, highcut=config.highcut
        )

    mfcc = librosa.feature.mfcc(
        y=data,
        sr=sample_rate,
        n_mfcc=config.n_mfcc,
        n_fft=config.n_fft,
        hop_length=config.hop_length,
    )
    feature_blocks = [mfcc]
    if config.use_deltas:
        feature_blocks.extend(
            [librosa.feature.delta(mfcc), librosa.feature.delta(mfcc, order=2)]
        )

    features = np.vstack(feature_blocks).T
    if config.use_cmvn:
        features = apply_cmvn(features)

    if not np.isfinite(features).all():
        raise ValueError("Feature extraction produced non-finite values")
    return features.astype(np.float32, copy=False)


def window_feature_sequence(
    features: np.ndarray,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Cover a complete feature sequence with padded, overlapping model windows.

    The final window is anchored at the end of a long recording, so no audio is
    silently discarded. ``valid_lengths`` lets models and aggregation code
    distinguish real frames from the zero padding in short windows.
    """
    if features.ndim != 2:
        raise ValueError(f"Expected a 2D feature array, got shape {features.shape}")
    if features.shape[0] == 0:
        raise ValueError("Cannot window an empty feature sequence")
    if config.window_hop <= 0 or config.window_hop > config.max_len:
        raise ValueError("window_hop must be positive and no greater than max_len")

    total_frames = features.shape[0]
    if total_frames <= config.max_len:
        starts = np.asarray([0], dtype=np.int32)
    else:
        starts = np.arange(0, total_frames - config.max_len + 1, config.window_hop)
        final_start = total_frames - config.max_len
        if starts[-1] != final_start:
            starts = np.append(starts, final_start)

    windows = []
    valid_lengths = []
    for start in starts:
        window = features[int(start) : int(start) + config.max_len]
        valid_lengths.append(window.shape[0])
        if window.shape[0] < config.max_len:
            window = np.pad(
                window,
                ((0, config.max_len - window.shape[0]), (0, 0)),
                mode="constant",
            )
        windows.append(window)
    return (
        np.asarray(windows, dtype=np.float32),
        np.asarray(valid_lengths, dtype=np.int32),
        starts.astype(np.int32),
    )


def extract_features(
    data: np.ndarray,
    sample_rate: int,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> np.ndarray:
    """Return the first padded window for backward-compatible callers.

    New training and serving code should call ``extract_feature_sequence`` and
    ``window_feature_sequence`` so that all of a recording is evaluated.
    """
    sequence = extract_feature_sequence(data, sample_rate, config=config)
    windows, _, _ = window_feature_sequence(sequence, config=config)
    return windows[0]
