import numpy as np

from preprocessing import PreprocessingConfig, window_feature_sequence


def test_windowing_covers_the_tail_of_a_long_recording():
    features = np.arange(10 * 2, dtype=np.float32).reshape(10, 2)
    config = PreprocessingConfig(max_len=4, window_hop=3)

    windows, valid_lengths, starts = window_feature_sequence(features, config)

    np.testing.assert_array_equal(starts, [0, 3, 6])
    np.testing.assert_array_equal(valid_lengths, [4, 4, 4])
    np.testing.assert_array_equal(windows[-1], features[6:10])


def test_windowing_pads_short_recording_and_preserves_valid_length():
    features = np.ones((2, 3), dtype=np.float32)
    windows, valid_lengths, starts = window_feature_sequence(
        features, PreprocessingConfig(max_len=4, window_hop=2)
    )

    assert windows.shape == (1, 4, 3)
    np.testing.assert_array_equal(valid_lengths, [2])
    np.testing.assert_array_equal(starts, [0])
    np.testing.assert_array_equal(windows[0, 2:], 0)
