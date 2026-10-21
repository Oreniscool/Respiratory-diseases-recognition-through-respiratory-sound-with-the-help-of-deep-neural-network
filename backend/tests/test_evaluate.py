import numpy as np

from evaluate import aggregate_probabilities_by_group, evaluate_model


def test_perfect_probabilities_produce_perfect_core_metrics():
    probabilities = np.asarray(
        [[0.95, 0.05], [0.02, 0.98], [0.91, 0.09], [0.04, 0.96]]
    )
    metrics = evaluate_model(
        np.asarray([0, 1, 0, 1]), probabilities, ["negative", "positive"]
    )
    assert metrics["accuracy"] == 1.0
    assert metrics["balanced_accuracy"] == 1.0
    assert metrics["macro_f1"] == 1.0
    assert metrics["confusion_matrix"] == [[2, 0], [0, 2]]
    assert metrics["per_class"]["positive"]["specificity"] == 1.0
    assert metrics["calibration_curve"]


def test_window_probabilities_are_aggregated_per_recording():
    targets, probabilities, groups = aggregate_probabilities_by_group(
        np.asarray([0, 0, 1]),
        np.asarray([[0.8, 0.2], [0.6, 0.4], [0.1, 0.9]]),
        np.asarray(["a.wav", "a.wav", "b.wav"]),
    )
    np.testing.assert_array_equal(targets, [0, 1])
    np.testing.assert_allclose(probabilities, [[0.7, 0.3], [0.1, 0.9]])
    np.testing.assert_array_equal(groups, ["a.wav", "b.wav"])


def test_metrics_are_strict_json_when_a_class_is_absent():
    import json

    # Class 2 never occurs in y_true: sklearn may return NaN AUROC rather than raising.
    y_true = np.array([0, 1, 0, 1])
    probabilities = np.array([[0.7, 0.2, 0.1], [0.2, 0.7, 0.1], [0.6, 0.3, 0.1], [0.3, 0.6, 0.1]])
    metrics = evaluate_model(y_true, probabilities, ["a", "b", "c"])
    assert metrics["macro_ovr_roc_auc"] is None or np.isfinite(metrics["macro_ovr_roc_auc"])
    json.dumps(metrics, allow_nan=False)  # raises ValueError if any NaN/inf survived
