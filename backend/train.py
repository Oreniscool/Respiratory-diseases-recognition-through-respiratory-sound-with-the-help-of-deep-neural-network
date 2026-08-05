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
    ReduceLROnPlateau,
)
from tensorflow.keras.layers import Input
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adamax
from sklearn.utils import class_weight

from model import instantiate_model


import tensorflow as tf
from tensorflow.keras.losses import CategoricalCrossentropy
from tensorflow.keras.optimizers.schedules import CosineDecay


@tf.keras.utils.register_keras_serializable(package="respinet")
class CategoricalFocalLoss(tf.keras.losses.Loss):
    def __init__(
        self,
        gamma: float = 2.0,
        alpha: float = 0.25,
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
    batch_size: int = 32,
    epochs: int = 50,
    learning_rate: float = 1e-3,
    healthy_class_index: int | None = None,
    healthy_class_multiplier: float = 1.0,
    use_focal_loss: bool = True,
    label_smoothing: float = 0.1,
    gamma: float = 2.0,
) -> tuple[Model, object, Path, dict[int, float]]:
    """Train a model using validation data only for model selection."""
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
    output = instantiate_model(input_sample, y_train.shape[1])
    model = Model(inputs=input_sample, outputs=output)

    steps_per_epoch = max(1, int(np.ceil(x_train.shape[0] / batch_size)))
    total_steps = steps_per_epoch * epochs
    lr_schedule = CosineDecay(
        initial_learning_rate=learning_rate,
        decay_steps=total_steps,
        alpha=1e-2,
    )

    if use_focal_loss:
        loss_fn = CategoricalFocalLoss(gamma=gamma, label_smoothing=label_smoothing)
    else:
        loss_fn = CategoricalCrossentropy(label_smoothing=label_smoothing)

    model.compile(
        loss=loss_fn,
        metrics=["accuracy"],
        optimizer=Adamax(learning_rate=lr_schedule),
    )
    with (output_dir / "model_summary.txt").open("w", encoding="utf-8") as handle:
        model.summary(print_fn=lambda line: handle.write(f"{line}\n"))

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
        ModelCheckpoint(
            model_path,
            monitor="val_loss",
            mode="min",
            save_best_only=True,
            verbose=1,
        ),
        EarlyStopping(
            monitor="val_loss",
            min_delta=0.001,
            patience=12,
            mode="min",
            restore_best_weights=True,
            verbose=1,
        ),
        CSVLogger(output_dir / "training_history.csv"),
    ]

    history = model.fit(
        x_train,
        y_train,
        batch_size=batch_size,
        epochs=epochs,
        validation_data=(x_val, y_val),
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    with (output_dir / "training_history.json").open("w", encoding="utf-8") as handle:
        json.dump(history.history, handle, indent=2)
    _save_plots(history.history, output_dir)
    return model, history, model_path, class_weights


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
