import numpy as np
import tensorflow as tf
from tensorflow.keras import Input, Model

from model import instantiate_model
from train import TIME_MASK_FILL, mixup, spec_augment_per_sample, train_model


def _params(**options):
    inputs = Input(shape=(200, 120))
    outputs = instantiate_model(inputs, 5, **options)
    return Model(inputs, outputs).count_params()


def test_model_options_keep_the_default_graph():
    assert _params() == 458_701
    assert _params(cudnn_gru=True) == 458_701  # same weights, different GRU activation
    assert _params(aux_outputs=2) == 458_701 + 256 * 2 + 2


def test_per_sample_spec_augment_never_touches_padding_or_creates_fake_padding():
    tf.random.set_seed(0)
    x = np.random.default_rng(0).standard_normal((8, 200, 120)).astype(np.float32)
    x[:, 150:, :] = 0.0  # 150 valid frames, then padding
    out = spec_augment_per_sample(
        tf.constant(x), num_freq_masks=2, max_freq_mask=15, num_time_masks=2, max_time_mask=25
    ).numpy()
    np.testing.assert_array_equal(out[:, 150:, :], 0.0)
    assert np.all(np.any(out[:, :150, :] != 0.0, axis=-1))  # masked frames stay "valid"
    assert np.any(np.isclose(out[:, :150, :], TIME_MASK_FILL))  # some time masking happened
    assert not np.allclose(out[0], out[1])


def test_mixup_keeps_the_original_label_dominant():
    tf.random.set_seed(1)
    x = tf.random.normal((16, 200, 120))
    y = tf.one_hot(np.arange(16) % 4, 4)
    mixed_x, mixed_y = mixup(x, y, 0.4)
    assert mixed_x.shape == x.shape
    np.testing.assert_allclose(mixed_y.numpy().sum(axis=1), 1.0, rtol=1e-6)
    assert np.all(mixed_y.numpy().max(axis=1) >= 0.5 - 1e-6)
    assert np.all(mixed_y.numpy()[np.arange(16), np.arange(16) % 4] >= 0.5 - 1e-6)


def test_multitask_training_saves_a_class_only_model(tmp_path):
    rng = np.random.default_rng(2)
    x = rng.standard_normal((12, 200, 120)).astype(np.float32)
    y = np.eye(3, dtype=np.float32)[np.arange(12) % 3]
    aux = rng.integers(0, 2, (12, 2)).astype(np.float32)
    aux[::3] = np.nan  # windows without crackle/wheeze annotations
    model, history, path, _ = train_model(
        x, y, x[:6], y[:6], output_dir=tmp_path, batch_size=6, epochs=1,
        aux_train=aux, aux_val=aux[:6], spec_augment_mode="sample", use_spec_augment=True,
        cudnn_gru=True,
    )
    assert "val_accuracy" in history.history
    from server import load_model

    reloaded = load_model(path, custom_objects={
        name: getattr(__import__("model"), name)
        for name in ("FeatureValidityMask", "MaskedGlobalAveragePooling1D", "MaskedDualTemporalPooling1D",
                     "MultiScaleConvBlock", "SqueezeExcitation1D")
    })
    assert reloaded.output_shape == (None, 3)
    np.testing.assert_allclose(reloaded.predict(x[:2], verbose=0), model.predict(x[:2], verbose=0), atol=1e-5)


def test_device_response_changes_colour_but_not_length_or_loudness():
    from Augmentation import device_response

    rng = np.random.default_rng(3)
    t = np.arange(22_050 * 2) / 22_050
    audio = (np.sin(2 * np.pi * 300 * t) + 0.5 * np.sin(2 * np.pi * 1200 * t)).astype(np.float32)
    out = device_response(audio, 22_050, np.random.default_rng(5))
    again = device_response(audio, 22_050, np.random.default_rng(5))
    assert out.shape == audio.shape and np.isfinite(out).all()
    np.testing.assert_allclose(np.sqrt(np.mean(out**2)), np.sqrt(np.mean(audio**2)), rtol=1e-4)
    np.testing.assert_array_equal(out, again)
    assert not np.allclose(out, device_response(audio, 22_050, rng))
    assert not np.allclose(out, audio)


def test_cycle_targets_follow_annotations_and_skip_unannotated_audio(tmp_path):
    from featureExtraction import cycle_annotation_targets
    from preprocessing import DEFAULT_PREPROCESSING

    (tmp_path / "101_1b1_Al_sc_Meditron.txt").write_text("0.0\t2.0\t1\t0\n2.0\t4.0\t0\t1\n")
    frames_per_second = DEFAULT_PREPROCESSING.sample_rate / DEFAULT_PREPROCESSING.hop_length
    one_second = int(round(frames_per_second))
    paths = np.asarray(["x/copd/101_1b1_Al_sc_Meditron.wav"] * 3 + ["x/asthma/P1AsthmaIE_1.wav"])
    variants = np.asarray(["original", "original", "stretch_0.8", "original"])
    starts = np.asarray([0, 2 * one_second + 1, 0, 0])
    lengths = np.asarray([2 * one_second, 2 * one_second, int(1.2 * one_second), 2 * one_second])
    targets = cycle_annotation_targets(paths, variants, starts, lengths, tmp_path)
    np.testing.assert_array_equal(targets[0], [1.0, 0.0])  # first cycle: crackles
    np.testing.assert_array_equal(targets[1], [0.0, 1.0])  # second cycle: wheezes
    assert np.isnan(targets[2]).all()  # stretched ×1.25: 1.2 s covers < 50% of the 2.5 s cycle
    assert np.isnan(targets[3]).all()  # Kaggle clip: no annotation
