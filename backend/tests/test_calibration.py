import numpy as np

from calibration import apply_temperature, fit_abstention_policy, fit_temperature, is_uncertain


def test_temperature_scaling_preserves_probability_rows():
    probabilities = np.asarray([[0.95, 0.05], [0.2, 0.8]])
    scaled = apply_temperature(probabilities, 2.0)
    np.testing.assert_allclose(scaled.sum(axis=1), 1.0)
    assert scaled[0, 0] < probabilities[0, 0]


def test_calibration_and_abstention_return_explicit_policy():
    probabilities = np.asarray([[0.99, 0.01], [0.6, 0.4], [0.2, 0.8], [0.45, 0.55]])
    calibration = fit_temperature(np.asarray([0, 0, 1, 1]), probabilities)
    policy = fit_abstention_policy(probabilities, target_coverage=0.75)
    uncertain, values = is_uncertain(np.asarray([0.5, 0.5]), policy)

    assert calibration["temperature"] > 0
    assert uncertain
    assert 0 <= values["normalized_entropy"] <= 1
