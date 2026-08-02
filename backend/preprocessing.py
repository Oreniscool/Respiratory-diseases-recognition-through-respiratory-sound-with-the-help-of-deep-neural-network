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


@dataclass(frozen=True)
class PreprocessingConfig:
    sample_rate: int = 22_050
    n_mfcc: int = 40
    max_len: int = 200
    use_deltas: bool = True
    hop_length: int = 512
    n_fft: int = 2_048
    res_type: str = "kaiser_fast"

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


def extract_features(
    data: np.ndarray,
    sample_rate: int,
    config: PreprocessingConfig = DEFAULT_PREPROCESSING,
) -> np.ndarray:
    """Return a ``(time_steps, feature_dim)`` MFCC sequence."""
    if data.size == 0:
        raise ValueError("Cannot extract features from empty audio")

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

    features = pad_or_truncate(np.vstack(feature_blocks), config.max_len).T
    if not np.isfinite(features).all():
        raise ValueError("Feature extraction produced non-finite values")
    return features.astype(np.float32, copy=False)
