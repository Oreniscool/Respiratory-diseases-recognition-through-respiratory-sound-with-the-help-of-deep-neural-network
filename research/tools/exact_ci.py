"""Exact (Clopper–Pearson) 95% intervals for the small-count results cited in the claim matrix.

    python research/tools/exact_ci.py
"""

from __future__ import annotations

import json
from pathlib import Path

from scipy.stats import beta

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "backend" / "artifacts" / "experiments"


def clopper_pearson(k: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    low = 0.0 if k == 0 else float(beta.ppf(alpha / 2, k, n - k + 1))
    high = 1.0 if k == n else float(beta.ppf(1 - alpha / 2, k + 1, n - k))
    return low, high


def main() -> None:
    results = {}
    for name, path in (("EXP-011", "../experiments-round2a/external/previous_served_model.json"),
                       ("EXP-013", "../experiments-round2a/external/served_round2.json")):
        e = json.loads((ART / path).read_text())
        n = e["in_label_patients"]
        k = round(e["patient_accuracy"] * n)
        results[f"{name} external KAUH in-label patients correct"] = (k, n, clopper_pearson(k, n))
    x2 = json.loads((ART / "site_vs_band" / "served_round2.json").read_text())["summary"]
    for label in ("healthy", "copd", "bronchial"):
        cell = x2[f"as_4khz/{label}"]
        k = cell["predictions"].get("asthma", 0)
        results[f"X2 ICBHI {label} at 4 kHz predicted asthma"] = (k, cell["recordings"], clopper_pearson(k, cell["recordings"]))
    for name, (k, n, (low, high)) in results.items():
        print(f"{name}: {k}/{n}  95% CI {low:.4f}–{high:.4f}")


if __name__ == "__main__":
    main()
