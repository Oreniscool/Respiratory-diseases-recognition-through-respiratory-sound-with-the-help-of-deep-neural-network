"""Shortcut probes: can the features identify the dataset or the stethoscope instead of the disease?

For each representation (cached pretrained embeddings and MFCC statistics) a standardized logistic
regression is trained, with patient-grouped 3-fold CV on the development set, to predict

- the dataset of origin (ICBHI vs Kaggle), and
- the ICBHI recording device (AKG C417L, Littmann Classic II SE, Littmann 3200, Meditron), on
  ICBHI recordings only.

High balanced accuracy means the representation carries the shortcut, so a disease classifier
built on it can exploit the source/device confound (all COPD is ICBHI, mostly AKG C417L).

Usage (from ``backend/``)::

    python -m experiments.shortcut
"""

from __future__ import annotations

import json
import warnings

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from experiments.cv import OUTPUT_DIR, SEED, load_cache, load_development_records, recording_device, summary_statistics


def probe(features: np.ndarray, target: np.ndarray, groups: np.ndarray) -> float:
    """Patient-grouped 3-fold CV balanced accuracy of a logistic-regression probe."""
    predictions = np.empty(len(target), dtype=object)
    splitter = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=SEED)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for train, test in splitter.split(features, target, groups):
            model = make_pipeline(
                StandardScaler(), LogisticRegression(C=0.1, class_weight="balanced", max_iter=5000)
            ).fit(features[train], target[train])
            predictions[test] = model.predict(features[test])
    return float(balanced_accuracy_score(target, predictions.astype(str)))


def source_detail(source: str, patient_id: int) -> str:
    """Dataset of origin, separating Kaggle clips cut from KAUH (real KAUH IDs) from the rest of Kaggle."""
    if source == "kaggle_asthma_v2":
        return "kaggle_from_kauh" if patient_id >= 900_000 else "kaggle_unknown"
    return source


def _eligible(target: np.ndarray, groups: np.ndarray, min_patients: int = 3) -> np.ndarray:
    """Rows whose target value has at least ``min_patients`` distinct patients (3-fold grouped CV)."""
    keep = np.zeros(len(target), dtype=bool)
    for value in np.unique(target):
        rows = target == value
        if len(np.unique(groups[rows])) >= min_patients:
            keep |= rows
    return keep


def within_label_probes(features, labels, sources, patients) -> dict[str, dict[str, object]]:
    """Source predicted within one diagnosis, and diagnosis predicted within one source.

    A source probe that succeeds inside a single diagnosis cannot be using the disease: it reads
    acquisition differences. A disease probe inside one source shows how much disease signal
    survives without the source cue.
    """
    out: dict[str, dict[str, object]] = {}
    for label in np.unique(labels):
        rows = labels == label
        keep = rows & _eligible(np.where(rows, sources, ""), patients)
        if len(np.unique(sources[keep])) >= 2:
            out[f"source_within_{label}"] = {
                "balanced_accuracy": probe(features[keep], sources[keep], patients[keep]),
                "chance": 1 / len(np.unique(sources[keep])),
                "patients": {s: int(len(np.unique(patients[keep & (sources == s)]))) for s in np.unique(sources[keep])},
            }
    for source in np.unique(sources):
        rows = sources == source
        keep = rows & _eligible(np.where(rows, labels, ""), patients)
        if len(np.unique(labels[keep])) >= 2:
            out[f"disease_within_{source}"] = {
                "balanced_accuracy": probe(features[keep], labels[keep], patients[keep]),
                "chance": 1 / len(np.unique(labels[keep])),
                "patients": {c: int(len(np.unique(patients[keep & (labels == c)]))) for c in np.unique(labels[keep])},
            }
    return out


def main() -> None:
    records, _ = load_development_records()
    paths = [str(record.path) for record in records]
    sources = np.asarray([record.source for record in records])
    patients = np.asarray([record.patient_id for record in records])
    devices = np.asarray([recording_device(path) for path in paths])
    labels = np.asarray([record.disease for record in records])

    representations: dict[str, dict[str, np.ndarray]] = {}
    X, meta = load_cache("mfcc")
    representations["mfcc_statistics"] = summary_statistics(X, meta)
    for cached in sorted((OUTPUT_DIR / "cache").glob("emb_*.npz")):
        stored = np.load(cached, allow_pickle=False)
        representations[cached.stem[4:]] = dict(zip(stored["paths"].tolist(), stored["embeddings"]))

    icbhi = sources == "icbhi"
    results = {}
    for name, table in representations.items():
        if not all(path in table for path in paths):
            continue
        features = np.stack([table[path] for path in paths])
        results[name] = {
            "dataset_of_origin": probe(features, sources, patients),
            "icbhi_device": probe(features[icbhi], devices[icbhi], patients[icbhi]),
            # Reference: how well the same probe predicts the disease label.
            "disease": probe(features, labels, patients),
        }
        detail = np.asarray([source_detail(s, int(p)) for s, p in zip(sources, patients)])
        results[name]["within_label"] = within_label_probes(features, labels, detail, patients)
        print(name, {k: round(v, 3) for k, v in results[name].items() if not isinstance(v, dict)}, flush=True)
    (OUTPUT_DIR / "shortcut_probes.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
