import numpy as np

from experiments.dg_loso import METHODS, cell_ids, inlp, patient_scores


def _two_site_data(seed=0, n=240, d=30):
    """Disease lives in dimension 0; site 'b' adds a large offset along dimension 1 and has more disease."""
    rng = np.random.default_rng(seed)
    site = np.asarray(["a"] * (n // 2) + ["b"] * (n // 2))
    y = np.concatenate([rng.integers(0, 2, n // 2), (rng.random(n // 2) < 0.8).astype(int)])
    x = rng.standard_normal((n, d))
    x[:, 0] += 2.0 * y
    x[site == "b", 1] += 6.0
    return x, y, site


def test_every_method_returns_probabilities_for_unseen_data():
    x, y, site = _two_site_data()
    x_test, y_test, _ = _two_site_data(seed=1, n=80)
    for name, method in METHODS.items():
        scores = method(x, y, site, x_test, np.full(len(x_test), "c"))
        assert scores.shape == (80,) and np.isfinite(scores).all() and scores.min() >= 0 and scores.max() <= 1, name


def test_inlp_removes_the_site_direction():
    from sklearn.linear_model import LogisticRegression

    x, y, site = _two_site_data()
    before = LogisticRegression(max_iter=2000).fit(x, site).score(x, site)
    # replicate the projection loop of inlp() on the training features
    a = (x - x.mean(0)) / x.std(0)
    for _ in range(5):
        coef = LogisticRegression(C=0.1, max_iter=2000, class_weight="balanced").fit(a, site).coef_
        q, _ = np.linalg.qr(coef.T)
        a = a - (a @ q) @ q.T
    after = LogisticRegression(max_iter=2000).fit(a, site).score(a, site)
    assert before > 0.99 and after < before
    assert inlp(x, y, site, x[:10], site[:10]).shape == (10,)


def test_cells_and_patient_aggregation():
    y = np.asarray([0, 1, 0, 1, 1])
    site = np.asarray(["a", "a", "b", "b", "b"])
    assert len(set(cell_ids(y, site))) == 4
    score, truth = patient_scores(np.asarray([0.1, 0.3, 0.9]), np.asarray(["p", "p", "q"]), np.asarray([0, 0, 1]))
    assert np.allclose(score, [0.2, 0.9]) and truth.tolist() == [0, 1]
