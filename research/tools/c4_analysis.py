"""Control C4 analysis: accuracy on ICBHI recordings copied into Kaggle V2 vs clean ICBHI recordings.

Reads the per-recording outputs of ``backend/experiments/contamination.py`` and writes
``backend/artifacts/experiments/contamination/analysis.json``:

- **within model** (``kaggle_all``): accuracy on copied vs clean recordings of the same class.
  The two groups share no patients ("clean" = the patient contributed nothing to Kaggle), so each is
  resampled by patient independently (cluster bootstrap, 10,000 draws).
- **between models**: the same copied ICBHI recordings scored by the model trained with the copies
  (``kaggle_all``) and by the one trained without them (``kaggle_clean``). Paired by recording,
  resampled by patient.

    python research/tools/c4_analysis.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "backend" / "artifacts" / "experiments" / "contamination"
DRAWS, SEED = 10_000, 0


def load(name: str) -> list[dict]:
    return json.loads((DIR / f"{name}_recordings.json").read_text())


def by_patient(rows: list[dict]) -> dict[str, np.ndarray]:
    groups: dict[str, list[float]] = {}
    for row in rows:
        groups.setdefault(row["patient_id"], []).append(float(row["prediction"] == row["label"]))
    return {patient: np.asarray(values) for patient, values in groups.items()}


def cluster_accuracy(groups: dict[str, np.ndarray], rng: np.random.Generator) -> np.ndarray:
    """Bootstrap distribution of recording accuracy, resampling patients."""
    values = list(groups.values())
    draws = rng.integers(0, len(values), size=(DRAWS, len(values)))
    sums = np.asarray([v.sum() for v in values])
    counts = np.asarray([v.size for v in values])
    return sums[draws].sum(1) / counts[draws].sum(1)


def interval(samples: np.ndarray) -> dict[str, float]:
    low, high = np.percentile(samples, [2.5, 97.5])
    return {"low": float(low), "high": float(high)}


def within_model(rows: list[dict], label: str, rng) -> dict[str, object]:
    copied = by_patient([r for r in rows if r["label"] == label and r["status"] == "copied_recording"])
    clean = by_patient([r for r in rows if r["label"] == label and r["status"] == "clean"])
    a, b = cluster_accuracy(copied, rng), cluster_accuracy(clean, rng)
    point = lambda g: float(sum(v.sum() for v in g.values()) / sum(v.size for v in g.values()))  # noqa: E731
    return {
        "copied": {"accuracy": point(copied), "recordings": int(sum(v.size for v in copied.values())), "patients": len(copied)},
        "clean": {"accuracy": point(clean), "recordings": int(sum(v.size for v in clean.values())), "patients": len(clean)},
        "difference": point(copied) - point(clean),
        "difference_ci95": interval(a - b),
        "p_difference_le_0": float(np.mean(a - b <= 0)),
    }


def between_models(with_copies: list[dict], without: list[dict], label: str, rng) -> dict[str, object]:
    other = {r["recording"]: r for r in without}
    pairs = [(r, other[r["recording"]]) for r in with_copies if r["label"] == label and r["status"] == "copied_recording"]
    groups: dict[str, list[float]] = {}
    for a, b in pairs:
        groups.setdefault(a["patient_id"], []).append(float(a["prediction"] == label) - float(b["prediction"] == label))
    values = [np.asarray(v) for v in groups.values()]
    draws = rng.integers(0, len(values), size=(DRAWS, len(values)))
    sums, counts = np.asarray([v.sum() for v in values]), np.asarray([v.size for v in values])
    boot = sums[draws].sum(1) / counts[draws].sum(1)
    return {
        "recordings": len(pairs), "patients": len(values),
        "accuracy_with_copies": float(np.mean([a["prediction"] == label for a, _ in pairs])),
        "accuracy_without_copies": float(np.mean([b["prediction"] == label for _, b in pairs])),
        "difference": float(sums.sum() / counts.sum()), "difference_ci95": interval(boot),
    }


def main() -> None:
    rng = np.random.default_rng(SEED)
    with_copies, without = load("kaggle_all"), load("kaggle_clean")
    result = {
        "method": f"patient-cluster bootstrap, {DRAWS} draws, seed {SEED}; recording-level accuracy",
        "within_model_kaggle_all": {label: within_model(with_copies, label, rng) for label in ("copd", "bronchial")},
        "between_models_copied_recordings": {
            label: between_models(with_copies, without, label, rng) for label in ("healthy", "pneumonia", "bronchial")
        },
    }
    # Replication with a second training seed (43), when its outputs exist.
    if (DIR / "kaggle_all_s43_recordings.json").is_file() and (DIR / "kaggle_clean_s43_recordings.json").is_file():
        with_s43, without_s43 = load("kaggle_all_s43"), load("kaggle_clean_s43")
        result["seed43"] = {
            "within_model_kaggle_all": {label: within_model(with_s43, label, rng) for label in ("copd", "bronchial")},
            "between_models_copied_recordings": {
                label: between_models(with_s43, without_s43, label, rng) for label in ("healthy", "pneumonia", "bronchial")
            },
        }
    (DIR / "analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
