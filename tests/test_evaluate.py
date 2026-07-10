import numpy as np

from evaluate import evaluate_model


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
