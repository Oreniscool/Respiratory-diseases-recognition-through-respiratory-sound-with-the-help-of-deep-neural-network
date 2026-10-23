import numpy as np

from experiments.match_validation import degrade


def test_degrade_returns_a_bounded_cut_at_one_of_the_listed_rates():
    rng = np.random.default_rng(0)
    waveform = np.random.default_rng(1).standard_normal(44_100 * 10).astype(np.float32) * 0.1
    for _ in range(5):
        cut, rate, params = degrade(waveform, 44_100, rng)
        assert rate in (4_000, 8_000, 22_050, 44_100)
        assert 3.0 <= params["seconds"] <= 8.0
        assert abs(len(cut) / rate - params["seconds"]) < 0.01
        assert np.isfinite(cut).all() and np.abs(cut).max() <= 1.0
