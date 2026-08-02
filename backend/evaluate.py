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


def aggregate_probabilities_by_group(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    group_ids: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Average window probabilities into one prediction per recording/group."""
    if y_true.ndim == 2:
        y_true = np.argmax(y_true, axis=1)
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    group_ids = np.asarray(group_ids)
    if not (len(y_true) == len(probabilities) == len(group_ids)):
        raise ValueError("Targets, probabilities, and group IDs must have equal length")

    targets, grouped_probabilities, groups = [], [], []
    for group_id in np.unique(group_ids):
        mask = group_ids == group_id
        labels = np.unique(y_true[mask])
        if labels.size != 1:
            raise ValueError(f"Group {group_id} has multiple target classes")
        targets.append(int(labels[0]))
        grouped_probabilities.append(np.mean(probabilities[mask], axis=0))
        groups.append(group_id)
    return np.asarray(targets), np.asarray(grouped_probabilities), np.asarray(groups)


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


def _calibration_curve(y_true: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict[str, float | int]]:
    confidences = np.max(probabilities, axis=1)
    predictions = np.argmax(probabilities, axis=1)
    correct = predictions == y_true
    edges = np.linspace(0.0, 1.0, bins + 1)
    curve = []
    for lower, upper in zip(edges[:-1], edges[1:]):
        mask = (confidences > lower) & (confidences <= upper)
        if np.any(mask):
            curve.append(
                {
                    "lower": float(lower),
                    "upper": float(upper),
                    "count": int(np.count_nonzero(mask)),
                    "mean_confidence": float(np.mean(confidences[mask])),
                    "empirical_accuracy": float(np.mean(correct[mask])),
                }
            )
    return curve


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
        "calibration_curve": _calibration_curve(y_true, probabilities),
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
    per_class = {}
    matrix = np.asarray(metrics["confusion_matrix"], dtype=int)
    for index, class_name in enumerate(class_names):
        true_positive = int(matrix[index, index])
        false_negative = int(matrix[index, :].sum() - true_positive)
        false_positive = int(matrix[:, index].sum() - true_positive)
        true_negative = int(matrix.sum() - true_positive - false_negative - false_positive)
        per_class[class_name] = {
            "support": int(matrix[index, :].sum()),
            "sensitivity": float(true_positive / (true_positive + false_negative))
            if true_positive + false_negative
            else None,
            "specificity": float(true_negative / (true_negative + false_positive))
            if true_negative + false_positive
            else None,
        }
    metrics["per_class"] = per_class
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


def bootstrap_patient_confidence_intervals(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    patient_ids: np.ndarray,
    class_names: list[str],
    *,
    samples: int = 1_000,
    seed: int = 42,
) -> dict[str, object]:
    """Patient-resampled percentile confidence intervals for core metrics."""
    if samples < 100:
        raise ValueError("At least 100 bootstrap samples are required")
    patient_ids = np.asarray(patient_ids)
    unique_patients = np.unique(patient_ids)
    if unique_patients.size < 2:
        raise ValueError("At least two patients are required for bootstrapping")
    rng = np.random.default_rng(seed)
    values = {"accuracy": [], "balanced_accuracy": [], "macro_f1": [], "macro_recall": []}
    for _ in range(samples):
        selected = rng.choice(unique_patients, size=unique_patients.size, replace=True)
        indices = np.concatenate([np.flatnonzero(patient_ids == patient) for patient in selected])
        # Re-index repeated patient draws so each draw remains a distinct
        # bootstrap observation during patient-level aggregation.
        resampled_patient_ids = np.concatenate(
            [
                np.full(np.count_nonzero(patient_ids == patient), draw_index, dtype=int)
                for draw_index, patient in enumerate(selected)
            ]
        )
        result = evaluate_patient_level(
            np.asarray(y_true)[indices],
            np.asarray(probabilities)[indices],
            resampled_patient_ids,
            class_names,
        )
        for metric in values:
            values[metric].append(result[metric])
    return {
        "method": "patient bootstrap percentile interval",
        "samples": samples,
        "confidence_level": 0.95,
        "metrics": {
            metric: {
                "lower": float(np.percentile(metric_values, 2.5)),
                "upper": float(np.percentile(metric_values, 97.5)),
            }
            for metric, metric_values in values.items()
        },
    }


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
