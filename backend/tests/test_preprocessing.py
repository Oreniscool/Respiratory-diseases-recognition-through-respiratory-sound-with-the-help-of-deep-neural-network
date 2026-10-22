import numpy as np
import pytest

from preprocessing import PreprocessingConfig, pad_or_truncate


def test_preprocessing_feature_dimension():
    assert PreprocessingConfig(n_mfcc=40, use_deltas=True).feature_dim == 120
    assert PreprocessingConfig(n_mfcc=40, use_deltas=False).feature_dim == 40


def test_pad_or_truncate_has_fixed_length():
    short = np.ones((3, 2), dtype=np.float32)
    padded = pad_or_truncate(short, 4)
    assert padded.shape == (3, 4)
    np.testing.assert_array_equal(padded[:, 2:], 0)

    long = np.arange(18).reshape(3, 6)
    np.testing.assert_array_equal(pad_or_truncate(long, 4), long[:, :4])


def test_pad_or_truncate_rejects_invalid_rank():
    with pytest.raises(ValueError, match="2D"):
        pad_or_truncate(np.ones(3), 4)


def _tone(seconds=3.0, sample_rate=22_050):
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    rng = np.random.default_rng(0)
    return (0.3 * np.sin(2 * np.pi * 440 * t) + 0.01 * rng.standard_normal(t.size)).astype(np.float32)


def test_logmel_front_end_has_its_own_dimension_and_is_finite():
    from preprocessing import extract_feature_sequence

    config = PreprocessingConfig(feature_type="logmel", n_mels=64)
    assert config.feature_dim == 192
    features = extract_feature_sequence(_tone(), 22_050, config=config)
    assert features.shape[1] == 192
    assert np.isfinite(features).all()


def test_configs_saved_before_logmel_existed_still_mean_mfcc():
    from preprocessing import DEFAULT_PREPROCESSING, extract_feature_sequence

    saved = DEFAULT_PREPROCESSING.to_dict()
    saved.pop("feature_type")
    saved.pop("n_mels")
    restored = PreprocessingConfig.from_dict(saved)
    assert restored.feature_type == "mfcc" and restored.feature_dim == 120
    np.testing.assert_array_equal(
        extract_feature_sequence(_tone(), 22_050, config=restored),
        extract_feature_sequence(_tone(), 22_050),
    )


def test_unknown_feature_type_is_rejected():
    with pytest.raises(ValueError, match="feature_type"):
        PreprocessingConfig(feature_type="wavelet")
