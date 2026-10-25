"""Multiplicity control for the round-2b adoption decision (Holm–Bonferroni).

The paired patient bootstrap in ``experiments/cv.py report`` gives P(Δ > 0) for each candidate
against the reference R′ = D0 + E_yamnet. Its complement, 1 − P(Δ > 0), is read as a one-sided
bootstrap p-value (floored at 1/(B + 1) with B = 1,000 draws). Holm–Bonferroni is applied to two
families:

- **pre-registered:** the fusions the rule in ROUND2 report §9 named, built on the best D3-family
  member (D3_x3): + YAMNet, + YAMNet + OPERA-CE, + YAMNet + HeAR, + YAMNet + OPERA-CE + HeAR;
- **all reported:** every candidate in ``results.json`` compared with R′ (35, many run as
  exploration).

Writes ``backend/artifacts/experiments/multiplicity.json``.

    python research/tools/multiplicity.py
"""

from __future__ import annotations

import json
from pathlib import Path

ART = Path(__file__).resolve().parents[2] / "backend" / "artifacts" / "experiments"
REFERENCE = "D0+E_yamnet"
DRAWS = 1_000
PREREGISTERED = ["D3_x3+E_yamnet", "D3_x3+E_yamnet+E_opera_ce", "D3_x3+E_yamnet+E_hear",
                 "D3_x3+E_yamnet+E_opera_ce+E_hear"]
ADOPTED = "D3_x3+E_yamnet+E_opera_ce+E_hear"


def holm(pvalues: dict[str, float]) -> dict[str, float]:
    """Holm step-down adjusted p-values."""
    ordered = sorted(pvalues.items(), key=lambda item: item[1])
    adjusted, running = {}, 0.0
    for rank, (name, p) in enumerate(ordered):
        running = max(running, min(1.0, (len(ordered) - rank) * p))
        adjusted[name] = running
    return adjusted


def main() -> None:
    results = json.loads((ART / "results.json").read_text())
    key = f"vs_{REFERENCE}"
    out: dict[str, object] = {"reference": REFERENCE, "bootstrap_draws": DRAWS, "adopted": ADOPTED}
    for metric in ("balanced_accuracy", "macro_f1"):
        p = {name: max(1.0 - v[key][metric]["p_improvement"], 1.0 / (DRAWS + 1))
             for name, v in results.items() if key in v and name != REFERENCE}
        for family, names in (("preregistered", PREREGISTERED), ("all_reported", sorted(p))):
            subset = {n: p[n] for n in names}
            adjusted = holm(subset)
            out[f"{metric}/{family}"] = {
                "comparisons": len(subset),
                "adopted_raw_p": subset.get(ADOPTED), "adopted_holm_p": adjusted.get(ADOPTED),
                "significant_at_0.05_after_holm": sorted(n for n, a in adjusted.items() if a < 0.05),
                "raw": {n: round(subset[n], 4) for n in sorted(subset)},
            }
    (ART / "multiplicity.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    for k, v in out.items():
        if isinstance(v, dict):
            print(f"{k}: {v['comparisons']} comparisons; adopted raw p {v['adopted_raw_p']:.3f} → Holm "
                  f"{v['adopted_holm_p']:.3f}; significant after Holm: {v['significant_at_0.05_after_holm']}")


if __name__ == "__main__":
    main()
