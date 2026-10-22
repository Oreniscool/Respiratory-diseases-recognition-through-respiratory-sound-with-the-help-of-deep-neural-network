"""Model training without module-level data globals."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from tensorflow.keras import backend as K
from tensorflow.keras.callbacks import (
    CSVLogger,
    EarlyStopping,
    ModelCheckpoint,
)
from tensorflow.keras.layers import Input
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adamax
from sklearn.utils import class_weight

from model import instantiate_model


import tensorflow as tf
from tensorflow.keras.losses import CategoricalCrossentropy
from tensorflow.keras.optimizers.schedules import CosineDecay

# Fixed training constants, recorded verbatim in model_metadata.json by main.py.
FOCAL_GAMMA = 2.0
FOCAL_ALPHA = 0.25
COSINE_DECAY_ALPHA = 5e-3
EARLY_STOPPING_MONITOR = "val_accuracy"
EARLY_STOPPING_PATIENCE = 18
EARLY_STOPPING_MIN_DELTA = 0.003
# Per-sample SpecAugment fills masked frames with this instead of 0, so FeatureValidityMask (which
# treats all-zero frames as padding) still sees them as real frames.
TIME_MASK_FILL = 1e-3


def spec_augment_per_sample(x, *, num_freq_masks, max_freq_mask, num_time_masks, max_time_mask):
    """SpecAugment with independent masks per sample; time masks stay inside the valid frames."""
    batch, frames, features = tf.shape(x)[0], tf.shape(x)[1], tf.shape(x)[2]
    length = tf.reduce_sum(tf.cast(tf.reduce_any(tf.not_equal(x, 0.0), axis=-1), tf.int32), axis=1)
    feature_index = tf.range(features)[tf.newaxis, :]
    for _ in range(num_freq_masks):
        width = tf.random.uniform([batch], 0, max_freq_mask + 1, dtype=tf.int32)
        start = tf.cast(tf.random.uniform([batch]) * tf.cast(features - width + 1, tf.float32), tf.int32)
        keep = (feature_index < start[:, None]) | (feature_index >= (start + width)[:, None])
        x = x * tf.cast(keep, x.dtype)[:, tf.newaxis, :]
    frame_index = tf.range(frames)[tf.newaxis, :]
    for _ in range(num_time_masks):
        width = tf.minimum(tf.random.uniform([batch], 0, max_time_mask + 1, dtype=tf.int32), length // 2)
        start = tf.cast(tf.random.uniform([batch]) * tf.cast(length - width + 1, tf.float32), tf.int32)
        masked = (frame_index >= start[:, None]) & (frame_index < (start + width)[:, None])
        x = tf.where(masked[..., tf.newaxis], tf.cast(TIME_MASK_FILL, x.dtype), x)
    return x


def mixup(x, y, alpha):
    """Blend each sample with a random partner; the original sample keeps the larger weight."""
    batch = tf.shape(x)[0]
    first = tf.random.gamma([batch], alpha)
    second = tf.random.gamma([batch], alpha)
    lam = first / (first + second)
    lam = tf.maximum(lam, 1.0 - lam)
    partner = tf.random.shuffle(tf.range(batch))
    x = lam[:, None, None] * x + (1.0 - lam)[:, None, None] * tf.gather(x, partner)
    y = lam[:, None] * y + (1.0 - lam)[:, None] * tf.gather(y, partner)
    return x, y


@tf.keras.utils.register_keras_serializable(package="respinet")
class CategoricalFocalLoss(tf.keras.losses.Loss):
    def __init__(
        self,
        gamma: float = FOCAL_GAMMA,
        alpha: float = FOCAL_ALPHA,
        label_smoothing: float = 0.1,
        name: str = "categorical_focal_loss",
    ):
        super().__init__(name=name)
        self.gamma = float(gamma)
        self.alpha = float(alpha)
        self.label_smoothing = float(label_smoothing)

    def call(self, y_true, y_pred):
        y_true = tf.cast(y_true, tf.float32)
        y_pred = tf.cast(y_pred, tf.float32)
        num_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)

        if self.label_smoothing > 0.0:
            y_true = y_true * (1.0 - self.label_smoothing) + (self.label_smoothing / num_classes)

        epsilon = tf.keras.backend.epsilon()
        y_pred = tf.clip_by_value(y_pred, epsilon, 1.0 - epsilon)

        cross_entropy = -y_true * tf.math.log(y_pred)
        weight = self.alpha * y_true * tf.math.pow(1.0 - y_pred, self.gamma)
        focal_loss = weight * cross_entropy
        return tf.reduce_sum(focal_loss, axis=-1)

    def get_config(self):
        return {
            "gamma": self.gamma,
            "alpha": self.alpha,
            "label_smoothing": self.label_smoothing,
        }


def train_model(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    *,
    output_dir: str | Path,
    batch_size: int = 64,
    epochs: int = 75,
    learning_rate: float = 3e-4,
    healthy_class_index: int | None = None,
    healthy_class_multiplier: float = 1.0,
    use_focal_loss: bool = True,
    label_smoothing: float = 0.08,
    gamma: float = FOCAL_GAMMA,
    use_spec_augment: bool = False,
    num_freq_masks: int = 2,
    max_freq_mask: int = 15,
    num_time_masks: int = 2,
    max_time_mask: int = 25,
    seed: int = 42,
    cudnn_gru: bool = False,
    spec_augment_mode: str = "batch",
    mixup_alpha: float = 0.0,
    aux_train: np.ndarray | None = None,
    aux_val: np.ndarray | None = None,
    aux_weight: float = 0.5,
) -> tuple[Model, object, Path, dict[int, float]]:
    """Train a model using validation data only for model selection.

    ``spec_augment_mode`` is "batch" (one mask per batch, the original behavior) or "sample".
    ``aux_train``/``aux_val`` (windows × n, NaN where unknown) enable multi-task training with a
    masked binary cross-entropy on an auxiliary head; the returned and saved model has only the
    class output.
    """
    if spec_augment_mode not in {"batch", "sample"}:
        raise ValueError("spec_augment_mode must be 'batch' or 'sample'")
    multitask = aux_train is not None
    if multitask and (aux_val is None or mixup_alpha > 0):
        raise ValueError("Multi-task training needs aux_val and does not support mixup")
    if x_train.ndim != 3 or x_val.ndim != 3:
        raise ValueError("Feature arrays must have shape (samples, time, features)")
    if y_train.ndim != 2 or y_val.ndim != 2:
        raise ValueError("Targets must be one-hot encoded 2D arrays")
    if x_train.shape[0] != y_train.shape[0] or x_val.shape[0] != y_val.shape[0]:
        raise ValueError("Feature/target sample counts do not match")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "best_model.keras"

    K.clear_session()
    input_sample = Input(shape=(x_train.shape[1], x_train.shape[2]))
    if multitask:
        output, aux_output = instantiate_model(
            input_sample, y_train.shape[1], cudnn_gru=cudnn_gru, aux_outputs=aux_train.shape[1]
        )
        model = Model(
            inputs=input_sample, outputs={"class_output": output, "aux_output": aux_output}
        )
        classifier = Model(inputs=input_sample, outputs=output)
    else:
        output = instantiate_model(input_sample, y_train.shape[1], cudnn_gru=cudnn_gru)
        model = classifier = Model(inputs=input_sample, outputs=output)

    steps_per_epoch = max(1, int(np.ceil(x_train.shape[0] / batch_size)))
    total_steps = steps_per_epoch * epochs
    # Cosine decay with warm-up tail: decays smoothly to 5e-3 × lr_init.
    # alpha=5e-3 (vs old 1e-2) keeps late-epoch lr lower, reducing
    # overfitting on the smaller Asthma V2 training set.
    lr_schedule = CosineDecay(
        initial_learning_rate=learning_rate,
        decay_steps=total_steps,
        alpha=COSINE_DECAY_ALPHA,
    )

    if use_focal_loss:
        loss_fn = CategoricalFocalLoss(gamma=gamma, label_smoothing=label_smoothing)
    else:
        loss_fn = CategoricalCrossentropy(label_smoothing=label_smoothing)

    monitor = EARLY_STOPPING_MONITOR
    if multitask:
        model.compile(
            loss={"class_output": loss_fn, "aux_output": tf.keras.losses.BinaryCrossentropy()},
            loss_weights={"class_output": 1.0, "aux_output": float(aux_weight)},
            metrics={"class_output": ["accuracy"]},
            optimizer=Adamax(learning_rate=lr_schedule),
        )
        monitor = "val_class_output_accuracy"
    else:
        model.compile(
            loss=loss_fn,
            metrics=["accuracy"],
            optimizer=Adamax(learning_rate=lr_schedule),
        )
    with (output_dir / "model_summary.txt").open("w", encoding="utf-8") as handle:
        classifier.summary(print_fn=lambda line: handle.write(f"{line}\n"))

    y_integers = np.argmax(y_train, axis=1)
    present_classes = np.unique(y_integers)
    weights = class_weight.compute_class_weight(
        class_weight="balanced", classes=present_classes, y=y_integers
    )
    class_weights = {
        int(class_index): float(weight)
        for class_index, weight in zip(present_classes, weights)
    }
    if healthy_class_index is not None and healthy_class_index in class_weights:
        class_weights[healthy_class_index] *= float(healthy_class_multiplier)

    callbacks = [
        # Monitor val_accuracy rather than val_loss so that early stopping
        # does not terminate the run while the model is still learning to
        # discriminate classes (val_loss can plateau or oscillate when the
        # focal loss is still re-weighting hard examples, even as accuracy
        # continues to improve — this was the root cause of the premature
        # Epoch-7 save in the v2 run).
        # NOTE: ReduceLROnPlateau is intentionally absent. Keras raises
        # TypeError when that callback tries to imperatively set
        # optimizer.learning_rate on an optimizer that was constructed with
        # a LearningRateSchedule object. CosineDecay already provides
        # smooth LR reduction natively; the secondary guard is not needed.
        ModelCheckpoint(
            output_dir / "multitask_checkpoint.keras" if multitask else model_path,
            monitor=monitor,
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        EarlyStopping(
            monitor=monitor,
            min_delta=EARLY_STOPPING_MIN_DELTA,
            patience=EARLY_STOPPING_PATIENCE,
            mode="max",
            restore_best_weights=True,
            verbose=1,
        ),
        CSVLogger(output_dir / "training_history.csv"),
    ]

    # Efficient tf.data pipeline to avoid memory duplication during training
    def targets(y, aux):
        if not multitask:
            return y, None
        labeled = (~np.isnan(aux).any(axis=1)).astype(np.float32)
        class_sample_weight = np.asarray(
            [class_weights.get(int(index), 1.0) for index in np.argmax(y, axis=1)], dtype=np.float32
        )
        return (
            {"class_output": y, "aux_output": np.nan_to_num(aux).astype(np.float32)},
            {"class_output": class_sample_weight, "aux_output": labeled},
        )

    train_targets, train_weights = targets(y_train, aux_train)
    train_slices = (x_train, train_targets) if train_weights is None else (x_train, train_targets, train_weights)
    train_ds = tf.data.Dataset.from_tensor_slices(train_slices)
    train_ds = train_ds.shuffle(
        buffer_size=min(len(x_train), 10_000),
        seed=seed,
        reshuffle_each_iteration=True,
    )
    train_ds = train_ds.batch(batch_size, drop_remainder=False)

    if mixup_alpha > 0:
        train_ds = train_ds.map(
            lambda x_b, y_b: mixup(x_b, y_b, mixup_alpha), num_parallel_calls=tf.data.AUTOTUNE
        )

    if use_spec_augment and spec_augment_mode == "sample":
        def _augment(x_b):
            return spec_augment_per_sample(
                x_b,
                num_freq_masks=num_freq_masks,
                max_freq_mask=max_freq_mask,
                num_time_masks=num_time_masks,
                max_time_mask=max_time_mask,
            )

        train_ds = train_ds.map(
            lambda x_b, *rest: (_augment(x_b), *rest), num_parallel_calls=tf.data.AUTOTUNE
        )
    elif use_spec_augment:
        def _apply_spec_augment_batch(x_b, *rest):
            shape = tf.shape(x_b)
            T, F = shape[1], shape[2]

            # 1. Frequency masking
            for _ in range(num_freq_masks):
                f = tf.random.uniform([], 0, max_freq_mask + 1, dtype=tf.int32)
                f0 = tf.random.uniform([], 0, tf.maximum(1, F - f + 1), dtype=tf.int32)
                f_indices = tf.range(F)
                f_mask = tf.logical_or(f_indices < f0, f_indices >= f0 + f)
                f_mask = tf.reshape(tf.cast(f_mask, x_b.dtype), [1, 1, F])
                x_b = x_b * f_mask

            # 2. Time masking
            for _ in range(num_time_masks):
                t = tf.random.uniform([], 0, max_time_mask + 1, dtype=tf.int32)
                t0 = tf.random.uniform([], 0, tf.maximum(1, T - t + 1), dtype=tf.int32)
                t_indices = tf.range(T)
                t_mask = tf.logical_or(t_indices < t0, t_indices >= t0 + t)
                t_mask = tf.reshape(tf.cast(t_mask, x_b.dtype), [1, T, 1])
                x_b = x_b * t_mask

            return (x_b, *rest)

        train_ds = train_ds.map(
            _apply_spec_augment_batch,
            num_parallel_calls=tf.data.AUTOTUNE,
        )

    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)

    val_targets, val_weights = targets(y_val, aux_val)
    val_slices = (x_val, val_targets) if val_weights is None else (x_val, val_targets, val_weights)
    val_ds = tf.data.Dataset.from_tensor_slices(val_slices)
    val_ds = val_ds.batch(batch_size, drop_remainder=False).prefetch(tf.data.AUTOTUNE)

    history = model.fit(
        train_ds,
        epochs=epochs,
        validation_data=val_ds,
        callbacks=callbacks,
        # Multi-output models take class weights as per-sample weights (see targets()).
        class_weight=None if multitask else class_weights,
        verbose=1,
    )
    if multitask:
        # EarlyStopping restored the best weights; serve only the class output.
        classifier.save(model_path)
        history.history["val_accuracy"] = history.history["val_class_output_accuracy"]
        history.history["accuracy"] = history.history["class_output_accuracy"]

    with (output_dir / "training_history.json").open("w", encoding="utf-8") as handle:
        json.dump(history.history, handle, indent=2)
    _save_plots(history.history, output_dir)
    return classifier, history, model_path, class_weights


def _save_plots(history: dict[str, list[float]], output_dir: Path) -> None:
    for metric, validation_metric, title, filename in (
        ("accuracy", "val_accuracy", "Model Accuracy", "accuracy_plot.png"),
        ("loss", "val_loss", "Model Loss", "loss_plot.png"),
    ):
        plt.figure(figsize=(10, 6))
        plt.plot(history[metric], label=f"Training {metric.title()}")
        plt.plot(history[validation_metric], label=f"Validation {metric.title()}")
        plt.title(title)
        plt.ylabel(metric.title())
        plt.xlabel("Epoch")
        plt.legend()
        plt.tight_layout()
        plt.savefig(output_dir / filename)
        plt.close()


trainModel = train_model
