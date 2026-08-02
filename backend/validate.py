"""Standalone inference helper for already-extracted feature arrays."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model


def validate_model(
    features: np.ndarray,
    model_path: str | Path = "artifacts/latest/best_model.keras",
    *,
    return_probabilities: bool = False,
) -> np.ndarray:
    model = load_model(model_path)
    probabilities = np.asarray(model.predict(features, verbose=0))
    if probabilities.ndim != 2:
        raise ValueError(f"Expected 2D model output, got {probabilities.shape}")
    return probabilities if return_probabilities else np.argmax(probabilities, axis=1)


validateModel = validate_model
