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
