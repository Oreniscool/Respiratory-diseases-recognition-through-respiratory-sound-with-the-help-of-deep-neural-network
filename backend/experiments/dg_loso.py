"""Domain-generalization comparison, leave-one-site-out (D-35).

Task: healthy vs diseased on frozen embeddings (YAMNet, OPERA-CE, HeAR, AST). Sites: ICBHI, Kaggle
remainder and KAUH-site (development patients only; the locked test split is never used) and SPRSound
(never trained on, D-34). Each site is held out in turn and the heads are trained on the other development
sites. Five methods, linear heads with C = 0.1 and nothing tuned:

- **M0 erm**: standardized logistic regression, balanced classes (the heads of D-33);
- **M1 site_standardized**: every training site z-scored with its own statistics; the held-out site with
  its own unlabeled statistics;
- **M2 group_balanced**: sample weights 1 / (n_site * n_site,class);
- **M3 inlp**: 30 rounds of a site classifier whose weight directions are projected out (iterative
  nullspace projection), then the disease head;
- **M4 group_dro**: 15 rounds of reweighting over (site, class) cells (cell weight *= exp(loss)), scores
  averaged over rounds.

Primary outcome: patient-level AUROC on held-out SPRSound with a 2,000-draw patient bootstrap, plus the
paired difference to M0. H10 and the rule for calling a cell effective are in D-35. Writes
``artifacts/experiments/dg_loso.json``.

    python -m experiments.dg_loso
"""

from __future__ import annotations

import csv
import json
import warnings
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

from experiments.cv import OUTPUT_DIR, load_development_records
from experiments.shortcut import source_detail

REPRESENTATIONS = ("yamnet", "opera_ce", "hear", "ast")
DEV_SITES = ("icbhi", "kaggle_remainder", "kauh_site")
SITE_OF = {"icbhi": "icbhi", "kauh": "kauh_site", "kaggle_from_kauh": "kauh_site", "kaggle_unknown": "kaggle_remainder"}
INLP_ROUNDS, DRO_ROUNDS, DRO_ETA = 30, 15, 1.0
DRAWS = 2_000
IN_LABEL = {"healthy", "asthma", "bronchial", "pneumonia"}


def head(**kwargs) -> LogisticRegression:
    return LogisticRegression(C=0.1, max_iter=5000, **kwargs)


def standardized(train: np.ndarray, test: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    scaler = StandardScaler().fit(train)
    return scaler.transform(train), scaler.transform(test)


def erm(x, y, site, x_test, site_test) -> np.ndarray:
    a, b = standardized(x, x_test)
    return head(class_weight="balanced").fit(a, y).predict_proba(b)[:, 1]


def site_standardized(x, y, site, x_test, site_test) -> np.ndarray:
    a = np.empty_like(x, dtype=np.float64)
    for s in np.unique(site):
        m = site == s
        a[m] = (x[m] - x[m].mean(0)) / (x[m].std(0) + 1e-6)
    b = (x_test - x_test.mean(0)) / (x_test.std(0) + 1e-6)  # label-free statistics of the held-out site
    return head(class_weight="balanced").fit(a, y).predict_proba(b)[:, 1]


def cell_ids(y: np.ndarray, site: np.ndarray) -> np.ndarray:
    keys = [f"{s}|{c}" for s, c in zip(site, y)]
    return np.unique(keys, return_inverse=True)[1]


def group_balanced(x, y, site, x_test, site_test) -> np.ndarray:
    a, b = standardized(x, x_test)
    cell = cell_ids(y, site)
    n_site = {s: np.sum(site == s) for s in np.unique(site)}
    n_cell = np.bincount(cell)
    w = np.asarray([1.0 / (n_site[s] * n_cell[c]) for s, c in zip(site, cell)])
    return head().fit(a, y, sample_weight=w / w.mean()).predict_proba(b)[:, 1]


def inlp(x, y, site, x_test, site_test) -> np.ndarray:
    a, b = standardized(x, x_test)
    for _ in range(INLP_ROUNDS):
        coef = head(class_weight="balanced").fit(a, site).coef_
        q, _ = np.linalg.qr(coef.T)  # orthonormal basis of the site-decoding directions
        a, b = a - (a @ q) @ q.T, b - (b @ q) @ q.T
    return head(class_weight="balanced").fit(a, y).predict_proba(b)[:, 1]


def group_dro(x, y, site, x_test, site_test) -> np.ndarray:
    a, b = standardized(x, x_test)
    cell = cell_ids(y, site)
    n_cell = np.bincount(cell)
    q = np.full(len(n_cell), 1.0 / len(n_cell))
    total = np.zeros(len(b))
    for _ in range(DRO_ROUNDS):
        w = q[cell] / n_cell[cell]
        model = head().fit(a, y, sample_weight=w / w.mean())
        p = np.clip(model.predict_proba(a)[:, 1], 1e-6, 1 - 1e-6)
        loss = -(y * np.log(p) + (1 - y) * np.log(1 - p))
        cell_loss = np.bincount(cell, weights=loss) / n_cell
        q = q * np.exp(DRO_ETA * cell_loss)
        q /= q.sum()
        total += model.decision_function(b)
    return 1.0 / (1.0 + np.exp(-total / DRO_ROUNDS))


METHODS = {"erm": erm, "site_standardized": site_standardized, "group_balanced": group_balanced,
           "inlp": inlp, "group_dro": group_dro}


def patient_scores(scores: np.ndarray, patients: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ids = np.unique(patients)
    return (np.asarray([scores[patients == p].mean() for p in ids]), np.asarray([int(y[patients == p][0]) for p in ids]))


def auroc_with_ci(score: np.ndarray, truth: np.ndarray, rng, baseline: np.ndarray | None = None) -> dict[str, object]:
    draws, deltas = [], []
    for _ in range(DRAWS):
        idx = rng.integers(0, len(truth), len(truth))
        if 0 < truth[idx].sum() < len(idx):
            a = roc_auc_score(truth[idx], score[idx])
            draws.append(a)
            if baseline is not None:
                deltas.append(a - roc_auc_score(truth[idx], baseline[idx]))
    out = {"auroc": float(roc_auc_score(truth, score)), "ci95": [float(v) for v in np.percentile(draws, [2.5, 97.5])],
           "patients": int(len(truth)), "healthy": int((truth == 0).sum())}
    if baseline is not None:
        out["delta_vs_erm"] = float(roc_auc_score(truth, score) - roc_auc_score(truth, baseline))
        out["delta_vs_erm_ci95"] = [float(v) for v in np.percentile(deltas, [2.5, 97.5])]
    return out


def load_table(path: Path) -> dict[str, np.ndarray]:
    stored = np.load(path, allow_pickle=False)
    return dict(zip(stored["paths"].tolist(), stored["embeddings"]))


def evaluate(x_dev, y_dev, site_dev, pat_dev, x_spr, y_spr, pat_spr, seed: int = 0) -> dict[str, object]:
    """All methods x held-out sites for one representation."""
    out: dict[str, dict[str, object]] = {m: {} for m in METHODS}
    folds = [(s, np.flatnonzero(site_dev != s), np.flatnonzero(site_dev == s)) for s in DEV_SITES]
    for held, train, test in [*folds, ("sprsound", np.arange(len(y_dev)), None)]:
        x_test, y_test, pat_test = (x_spr, y_spr, pat_spr) if test is None else (x_dev[test], y_dev[test], pat_dev[test])
        site_test = np.full(len(y_test), held)
        cell_scores = {}
        for name, method in METHODS.items():
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                cell_scores[name] = patient_scores(method(x_dev[train], y_dev[train], site_dev[train], x_test, site_test),
                                                   pat_test, y_test)
        erm_score = cell_scores["erm"][0]
        for name, (score, truth) in cell_scores.items():
            out[name][held] = auroc_with_ci(score, truth, np.random.default_rng(seed), None if name == "erm" else erm_score)
    return out


def main() -> None:
    records, _ = load_development_records()
    site_dev = np.asarray([SITE_OF[source_detail(r.source, int(r.patient_id))] for r in records])
    y_dev = np.asarray([int(r.disease != "healthy") for r in records])
    pat_dev = np.asarray([str(r.patient_id) for r in records])
    with Path("data/sprsound_manifest.csv").open(newline="", encoding="utf-8") as handle:
        spr = [r for r in csv.DictReader(handle) if r["status"] == "ok" and r["label"] in IN_LABEL]
    y_spr = np.asarray([int(r["label"] != "healthy") for r in spr])
    pat_spr = np.asarray([r["patient_id"] for r in spr])
    result: dict[str, object] = {"rules": "research/DECISION_LOG.md D-35", "representations": {}}
    for name in REPRESENTATIONS:
        dev = load_table(OUTPUT_DIR / "cache" / f"emb_{name}.npz")
        ext = load_table(OUTPUT_DIR / "cache" / f"emb_sprsound_{name}.npz")
        cells = evaluate(np.stack([dev[str(r.path)] for r in records]), y_dev, site_dev, pat_dev,
                         np.stack([ext[r["path"]] for r in spr]), y_spr, pat_spr)
        others = [s for s in DEV_SITES]
        erm_mean = float(np.mean([cells["erm"][s]["auroc"] for s in others]))
        for method, per_site in cells.items():
            mean_dev = float(np.mean([per_site[s]["auroc"] for s in others]))
            spr_cell = per_site["sprsound"]
            per_site["mean_dev_auroc"] = mean_dev
            per_site["h10_bar_met"] = bool(spr_cell["auroc"] >= 0.70 and spr_cell["ci95"][0] > 0.60)
            per_site["effective"] = bool(per_site["h10_bar_met"] and mean_dev >= erm_mean + 0.05)
            print(f"[dg] {name:9s} {method:18s} SPRSound {spr_cell['auroc']:.3f} {[round(v, 3) for v in spr_cell['ci95']]} | "
                  f"dev sites " + ", ".join(f"{s} {per_site[s]['auroc']:.2f}" for s in others), flush=True)
        result["representations"][name] = cells
    (OUTPUT_DIR / "dg_loso.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    cells_all = [(r, m) for r, c in result["representations"].items() for m in c]
    met = [(r, m) for r, m in cells_all if result["representations"][r][m]["h10_bar_met"]]
    print(f"[dg] cells meeting the SPRSound bar: {len(met)} of {len(cells_all)}: {met}")


if __name__ == "__main__":
    main()
