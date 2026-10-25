"""Leave-one-source-out, normal vs abnormal, on the development patients (test split untouched).

Three recording sources: ICBHI, the Kaggle remainder (clips of unknown provenance) and the KAUH site
(KAUH recordings plus Kaggle clips cut from KAUH). Each has normal and abnormal patients. For every
representation (MFCC statistics and the cached YAMNet / OPERA-CE / HeAR embeddings) a standardized,
class-balanced logistic regression is

- trained on two sources and scored on the third (**held-out source**), and
- for reference, scored by patient-grouped 3-fold CV over all sources (**within cohort**), with the
  same AUROC computed per source on the out-of-fold predictions.

Score = P(abnormal) averaged per patient; patient-level AUROC with a 2,000-draw patient bootstrap.
Leave-one-*device*-out inside ICBHI is not run: every healthy ICBHI recording is Meditron and the
AKG C417L recorded only COPD, so holding out a device removes a class (reported in the output).

Writes ``artifacts/experiments/loso.json``.

    python -m experiments.loso
"""

from __future__ import annotations

import json
import warnings
from collections import Counter

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from experiments.cv import OUTPUT_DIR, SEED, load_cache, load_development_records, recording_device, summary_statistics
from experiments.shortcut import source_detail

SITE = {"icbhi": "icbhi", "kauh": "kauh_site", "kaggle_from_kauh": "kauh_site", "kaggle_unknown": "kaggle_remainder"}


def classifier():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, class_weight="balanced", max_iter=5000))


def patient_auroc(scores: np.ndarray, truth: np.ndarray, patients: np.ndarray, rng) -> dict[str, object]:
    ids = np.unique(patients)
    s = np.asarray([scores[patients == p].mean() for p in ids])
    t = np.asarray([truth[patients == p][0] for p in ids])
    draws = []
    for _ in range(2_000):
        idx = rng.integers(0, len(ids), len(ids))
        if 0 < t[idx].sum() < len(idx):
            draws.append(roc_auc_score(t[idx], s[idx]))
    return {"auroc": float(roc_auc_score(t, s)), "ci95": [float(x) for x in np.percentile(draws, [2.5, 97.5])],
            "normal_patients": int((t == 0).sum()), "abnormal_patients": int(t.sum())}


def main() -> None:
    records, _ = load_development_records()
    paths = [str(r.path) for r in records]
    patients = np.asarray([r.patient_id for r in records])
    truth = np.asarray([int(r.disease != "healthy") for r in records])
    site = np.asarray([SITE[source_detail(r.source, int(r.patient_id))] for r in records])
    representations: dict[str, dict[str, np.ndarray]] = {}
    X, meta = load_cache("mfcc")
    representations["mfcc_statistics"] = summary_statistics(X, meta)
    for name in ("yamnet", "opera_ce", "hear", "ast"):
        cache = OUTPUT_DIR / "cache" / f"emb_{name}.npz"
        if not cache.is_file():
            continue
        stored = np.load(cache, allow_pickle=False)
        table = dict(zip(stored["paths"].tolist(), stored["embeddings"]))
        if all(p in table for p in paths):  # skip a partially computed cache (e.g. AST in progress)
            representations[name] = table

    rng = np.random.default_rng(SEED)
    icbhi = np.asarray([r.source == "icbhi" for r in records])
    result: dict[str, object] = {
        "patients_per_site_and_label": {f"{s}/{lab}": len({p for p, ss, t in zip(patients, site, truth) if ss == s and t == lab})
                                        for s in np.unique(site) for lab in (0, 1)},
        "icbhi_device_by_class_recordings": {f"{d}/{c}": n for (d, c), n in sorted(Counter(
            (recording_device(p), r.disease) for p, r, i in zip(paths, records, icbhi) if i).items())},
    }
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for name, table in representations.items():
            x = np.stack([table[p] for p in paths])
            out: dict[str, object] = {"held_out_source": {}, "within_cohort_by_source": {}}
            for held in np.unique(site):
                train, test = site != held, site == held
                scores = classifier().fit(x[train], truth[train]).predict_proba(x[test])[:, 1]
                out["held_out_source"][held] = patient_auroc(scores, truth[test], patients[test], rng)
            oof = np.empty(len(x))
            for tr, te in StratifiedGroupKFold(3, shuffle=True, random_state=SEED).split(x, truth, patients):
                oof[te] = classifier().fit(x[tr], truth[tr]).predict_proba(x[te])[:, 1]
            for s in np.unique(site):
                m = site == s
                out["within_cohort_by_source"][s] = patient_auroc(oof[m], truth[m], patients[m], rng)
            result[name] = out
            print(name, {s: (round(out["within_cohort_by_source"][s]["auroc"], 3), round(out["held_out_source"][s]["auroc"], 3))
                         for s in np.unique(site)}, flush=True)
    (OUTPUT_DIR / "loso.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
