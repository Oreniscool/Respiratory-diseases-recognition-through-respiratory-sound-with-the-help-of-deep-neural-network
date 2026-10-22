"""YAMNet embeddings and the RespiNet + YAMNet late fusion, shared by training, experiments and serving.

YAMNet (Google, trained on AudioSet) turns 16 kHz mono audio into one 1,024-d embedding per
0.96 s frame. A recording is summarised by the mean and standard deviation of its frame
embeddings (2,048 values), and a standardized, class-balanced logistic regression maps that to
class probabilities. The fitted regression is exported as a one-layer Keras model with the
standardization folded into its weights, so no pickled estimator is ever loaded.

Fusion averages the two temperature-calibrated probability vectors with fixed weights; the
deployed artifact then applies one more validation-fitted temperature to the fused vector.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from calibration import apply_temperature

YAMNET_SAMPLE_RATE = 16_000
EMBEDDING_DIM = 2 * 1024
FUSION_TYPE = "respinet+yamnet_logistic"


def load_yamnet(directory: str | Path):
    import tensorflow as tf

    return tf.saved_model.load(str(directory))


def load_yamnet_audio(path: str | Path) -> np.ndarray:
    """Decode straight to 16 kHz mono, without the RespiNet band-pass (YAMNet expects natural audio)."""
    import librosa

    waveform, _ = librosa.load(str(path), sr=YAMNET_SAMPLE_RATE, mono=True)
    return waveform.astype(np.float32, copy=False)


def yamnet_embedding(model, waveform: np.ndarray) -> np.ndarray:
    import tensorflow as tf

    _, frames, _ = model(tf.constant(waveform, dtype=tf.float32))
    frames = frames.numpy()
    return np.concatenate([frames.mean(axis=0), frames.std(axis=0)]).astype(np.float32)


def fit_logistic_head(x_fit, y_fit, x_validation, y_validation):
    """Standardized, class-balanced logistic regression; C chosen by validation log loss."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    best = None
    for c in (0.001, 0.01, 0.1, 1.0):
        model = make_pipeline(
            StandardScaler(), LogisticRegression(C=c, class_weight="balanced", max_iter=5000)
        ).fit(x_fit, y_fit)
        loss = log_loss(y_validation, model.predict_proba(x_validation), labels=model.classes_)
        if best is None or loss < best[0]:
            best = (loss, c, model)
    return best[2], {"C": best[1]}


def export_logistic_head(pipeline, class_names: list[str], path: str | Path):
    """Save a fitted scaler + logistic-regression pipeline as an equivalent Dense-softmax model."""
    from tensorflow.keras import Input, Model
    from tensorflow.keras.layers import Dense

    scaler, regression = pipeline[0], pipeline[-1]
    order = [list(regression.classes_).index(name) for name in class_names]
    coef = regression.coef_[order] / scaler.scale_  # (classes, features)
    intercept = regression.intercept_[order] - coef @ scaler.mean_
    inputs = Input(shape=(coef.shape[1],), name="yamnet_embedding")
    outputs = Dense(len(class_names), activation="softmax", name="yamnet_logistic")(inputs)
    head = Model(inputs, outputs)
    head.get_layer("yamnet_logistic").set_weights([coef.T.astype(np.float32), intercept.astype(np.float32)])
    head.save(path)
    return head


def fuse_probabilities(
    respinet: np.ndarray, yamnet: np.ndarray, fusion: dict[str, object]
) -> np.ndarray:
    """Weighted mean of the two calibrated members (before the final fused temperature)."""
    weights = fusion["weights"]
    combined = (
        float(weights[0]) * apply_temperature(np.atleast_2d(respinet), float(fusion["respinet_temperature"]))
        + float(weights[1]) * apply_temperature(np.atleast_2d(yamnet), float(fusion["yamnet_temperature"]))
    )
    return combined / combined.sum(axis=1, keepdims=True)


def directory_sha256(directory: str | Path) -> str:
    """One hash over every file's relative path and content, so any change to a SavedModel shows."""
    directory = Path(directory)
    digest = hashlib.sha256()
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        digest.update(path.relative_to(directory).as_posix().encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).hexdigest().encode("ascii") + b"\n")
    return digest.hexdigest()
