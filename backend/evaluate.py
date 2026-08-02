"""Evaluation helpers for untouched patient-level test data."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    log_loss,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
)


def _expected_calibration_error(
    y_true: np.ndarray, probabilities: np.ndarray, bins: int = 10
) -> float:
    confidences = np.max(probabilities, axis=1)
    predictions = np.argmax(probabilities, axis=1)
    correct = predictions == y_true
    edges = np.linspace(0.0, 1.0, bins + 1)
    error = 0.0
    for lower, upper in zip(edges[:-1], edges[1:]):
        mask = (confidences > lower) & (confidences <= upper)
        if np.any(mask):
            error += float(np.mean(mask)) * abs(
                float(np.mean(correct[mask])) - float(np.mean(confidences[mask]))
            )
    return error


def evaluate_model(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    class_names: list[str],
) -> dict[str, object]:
    if y_true.ndim == 2:
        y_true = np.argmax(y_true, axis=1)
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    if probabilities.ndim != 2 or probabilities.shape[1] != len(class_names):
        raise ValueError("Probability matrix does not match the configured classes")
    if not np.isfinite(probabilities).all():
        raise ValueError("Probabilities contain non-finite values")

    y_pred = np.argmax(probabilities, axis=1)
    labels = np.arange(len(class_names))
    metrics: dict[str, object] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_precision": float(
            precision_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "macro_recall": float(
            recall_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "weighted_f1": float(
            f1_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "cohen_kappa": float(cohen_kappa_score(y_true, y_pred)),
        "matthews_correlation_coefficient": float(
            matthews_corrcoef(y_true, y_pred)
        ),
        "log_loss": float(log_loss(y_true, probabilities, labels=labels)),
        "multiclass_brier_score": float(
            np.mean(np.sum((np.eye(len(class_names))[y_true] - probabilities) ** 2, axis=1))
        ),
        "expected_calibration_error": _expected_calibration_error(
            y_true, probabilities
        ),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "classification_report": classification_report(
            y_true,
            y_pred,
            labels=labels,
            target_names=class_names,
            output_dict=True,
            zero_division=0,
        ),
    }
    try:
        metrics["macro_ovr_roc_auc"] = float(
            roc_auc_score(
                y_true,
                probabilities,
                labels=labels,
                average="macro",
                multi_class="ovr",
            )
        )
    except ValueError:
        metrics["macro_ovr_roc_auc"] = None
    return metrics


def evaluate_patient_level(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    patient_ids: np.ndarray,
    class_names: list[str],
) -> dict[str, object]:
    """Average recording probabilities per patient before scoring."""
    if y_true.ndim == 2:
        y_true = np.argmax(y_true, axis=1)
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    patient_ids = np.asarray(patient_ids)
    if not (len(y_true) == len(probabilities) == len(patient_ids)):
        raise ValueError("Patient IDs, targets, and probabilities must have equal length")

    patient_targets = []
    patient_probabilities = []
    for patient_id in np.unique(patient_ids):
        mask = patient_ids == patient_id
        labels = np.unique(y_true[mask])
        if labels.size != 1:
            raise ValueError(f"Patient {patient_id} has multiple target classes")
        patient_targets.append(int(labels[0]))
        patient_probabilities.append(np.mean(probabilities[mask], axis=0))

    metrics = evaluate_model(
        np.asarray(patient_targets), np.asarray(patient_probabilities), class_names
    )
    metrics["num_patients"] = int(len(patient_targets))
    metrics["aggregation"] = "mean recording probability per patient"
    return metrics


evalModel = evaluate_model
