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


def test_spec_augment_masks_frequency_and_time():
    from Augmentation import spec_augment

    features = np.ones((200, 120), dtype=np.float32)
    rng = np.random.default_rng(42)
    augmented = spec_augment(
        features,
        valid_length=150,
        num_freq_masks=2,
        max_freq_mask=15,
        num_time_masks=2,
        max_time_mask=25,
        rng=rng,
    )

    assert augmented.shape == (200, 120)
    # Check that zeros were inserted (masked regions)
    assert np.count_nonzero(augmented == 0.0) > 0
    # Check determinism with seeded RNG
    rng1 = np.random.default_rng(123)
    rng2 = np.random.default_rng(123)
    aug1 = spec_augment(features, rng=rng1)
    aug2 = spec_augment(features, rng=rng2)
    np.testing.assert_array_equal(aug1, aug2)


def test_spec_augment_tf_masks_batch():
    import tensorflow as tf
    from Augmentation import spec_augment_tf

    batch = tf.ones((4, 200, 120), dtype=tf.float32)
    aug_batch = spec_augment_tf(batch, num_freq_masks=2, max_freq_mask=15, num_time_masks=2, max_time_mask=25)

    assert aug_batch.shape == (4, 200, 120)
    assert tf.reduce_any(tf.equal(aug_batch, 0.0)).numpy()

