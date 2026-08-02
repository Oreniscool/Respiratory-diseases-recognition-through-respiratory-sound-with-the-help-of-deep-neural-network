import numpy as np

from Augmentation import add_noise, shift


def test_shift_zero_fills_instead_of_wrapping():
    data = np.asarray([1, 2, 3, 4], dtype=np.float32)
    np.testing.assert_array_equal(shift(data, 2), [0, 0, 1, 2])
    np.testing.assert_array_equal(shift(data, -2), [3, 4, 0, 0])


def test_noise_is_deterministic_with_seeded_generator():
    data = np.ones(1_000, dtype=np.float32)
    first = add_noise(data, snr_db=20, rng=np.random.default_rng(7))
    second = add_noise(data, snr_db=20, rng=np.random.default_rng(7))
    np.testing.assert_allclose(first, second)
    assert not np.array_equal(first, data)
