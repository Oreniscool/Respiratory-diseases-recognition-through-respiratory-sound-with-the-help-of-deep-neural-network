"""Post-training probability calibration and uncertainty policy helpers."""

from __future__ import annotations

import numpy as np


def apply_temperature(probabilities: np.ndarray, temperature: float) -> np.ndarray:
    """Temperature-scale a categorical distribution without requiring logits."""
    probabilities = np.asarray(probabilities, dtype=float)
    if temperature <= 0:
        raise ValueError("temperature must be positive")
    clipped = np.clip(probabilities, 1e-12, 1.0)
    scaled = np.power(clipped, 1.0 / temperature)
    return scaled / np.sum(scaled, axis=1, keepdims=True)


def multiclass_negative_log_likelihood(y_true: np.ndarray, probabilities: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    return float(-np.mean(np.log(np.clip(probabilities[np.arange(len(y_true)), y_true], 1e-12, 1))))


def fit_temperature(y_true: np.ndarray, probabilities: np.ndarray) -> dict[str, float]:
    """Choose temperature on validation data using a deterministic log-space search."""
    candidates = np.exp(np.linspace(np.log(0.25), np.log(5.0), 161))
    losses = [multiclass_negative_log_likelihood(y_true, apply_temperature(probabilities, item)) for item in candidates]
    index = int(np.argmin(losses))
    return {
        "temperature": float(candidates[index]),
        "validation_nll_before": multiclass_negative_log_likelihood(y_true, probabilities),
        "validation_nll_after": float(losses[index]),
    }


def normalized_entropy(probabilities: np.ndarray) -> np.ndarray:
    probabilities = np.asarray(probabilities, dtype=float)
    classes = probabilities.shape[1]
    entropy = -np.sum(probabilities * np.log(np.clip(probabilities, 1e-12, 1.0)), axis=1)
    return entropy / np.log(classes)


def fit_abstention_policy(
    probabilities: np.ndarray, *, target_coverage: float = 0.80
) -> dict[str, float]:
    """Derive transparent validation-set thresholds for research-only abstention."""
    if not 0 < target_coverage < 1:
        raise ValueError("target_coverage must be between zero and one")
    confidence = np.max(probabilities, axis=1)
    entropy = normalized_entropy(probabilities)
    return {
        "min_confidence": float(np.quantile(confidence, 1.0 - target_coverage)),
        "max_normalized_entropy": float(np.quantile(entropy, target_coverage)),
        "target_validation_coverage": target_coverage,
    }


def is_uncertain(probabilities: np.ndarray, policy: dict[str, float]) -> tuple[bool, dict[str, float]]:
    vector = np.asarray(probabilities, dtype=float).reshape(1, -1)
    confidence = float(np.max(vector))
    entropy = float(normalized_entropy(vector)[0])
    uncertain = (
        confidence < float(policy.get("min_confidence", 0.0))
        or entropy > float(policy.get("max_normalized_entropy", 1.0))
    )
    return uncertain, {"confidence": confidence, "normalized_entropy": entropy}
