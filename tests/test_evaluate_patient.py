import numpy as np

from evaluate import evaluate_patient_level


def test_patient_metrics_average_multiple_recordings():
    y_true = np.asarray([0, 0, 1, 1])
    probabilities = np.asarray(
        [[0.9, 0.1], [0.6, 0.4], [0.4, 0.6], [0.1, 0.9]]
    )
    metrics = evaluate_patient_level(
        y_true,
        probabilities,
        np.asarray([101, 101, 202, 202]),
        ["negative", "positive"],
    )
    assert metrics["num_patients"] == 2
    assert metrics["accuracy"] == 1.0
