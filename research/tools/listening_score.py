"""Score the blind listening check of the copy detector (experiments/match_validation.py listening).

Compares the rater's answer sheet with the answer key and writes
``backend/artifacts/experiments/match_validation/listening_result.json``:
agreement on decided pairs, unsure rate, and precision/recall of the detector as judged by the rater.

    python research/tools/listening_score.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from scipy.stats import beta

DIR = Path(__file__).resolve().parents[2] / "backend" / "artifacts" / "experiments" / "match_validation"


def exact(k: int, n: int) -> list[float] | None:
    if n == 0:
        return None
    return [0.0 if k == 0 else float(beta.ppf(0.025, k, n - k + 1)), 1.0 if k == n else float(beta.ppf(0.975, k + 1, n - k))]


def main() -> None:
    with (DIR / "listening" / "answer_sheet.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))[1:]
    answers = {int(r[0]): r[1].strip().lower() for r in rows if r and r[0].strip()}
    with (DIR / "listening_key" / "answer_key.csv").open(newline="", encoding="utf-8") as handle:
        key = {int(r["pair"]): r for r in csv.DictReader(handle)}
    pairs = []
    for pair, row in sorted(key.items()):
        answer = answers.get(pair, "")
        if answer not in ("yes", "no", "unsure"):
            raise SystemExit(f"pair {pair}: answer {answer!r} is not yes/no/unsure")
        pairs.append({"pair": pair, "detector": row["truth"], "rater": answer, "best_ncc": float(row["best_ncc"]),
                      "clip": row["clip"], "reference": row["reference"]})
    decided = [p for p in pairs if p["rater"] != "unsure"]
    agree = [p for p in decided if (p["rater"] == "yes") == (p["detector"] == "match")]
    by = lambda d, r: sum(p["detector"] == d and p["rater"] == r for p in pairs)  # noqa: E731
    confirmed = by("match", "yes")
    result = {
        "raters": 1,
        "pairs": len(pairs), "unsure": len(pairs) - len(decided),
        "agreement_on_decided": len(agree) / len(decided) if decided else None,
        "agreement_on_decided_ci95": exact(len(agree), len(decided)),
        "table": {f"{d}/{r}": by(d, r) for d in ("match", "non-match") for r in ("yes", "no", "unsure")},
        "detector_matches_confirmed_by_rater": f"{confirmed}/{by('match', 'yes') + by('match', 'no')}",
        "detector_non_matches_confirmed_by_rater": f"{by('non-match', 'no')}/{by('non-match', 'yes') + by('non-match', 'no')}",
        "note": ("Pairs are the 10 lowest-scoring detector matches and the 10 highest-scoring non-matches "
                 "(the hardest cases), so agreement here is a lower bound for the full set."),
        "pairs_detail": pairs,
    }
    (DIR / "listening_result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "pairs_detail"}, indent=2))
    for p in pairs:
        flag = "" if p["rater"] == "unsure" or (p["rater"] == "yes") == (p["detector"] == "match") else "  <-- disagree"
        print(f"pair {p['pair']:2d}: detector {p['detector']:9s} (NCC {p['best_ncc']:.3f})  rater {p['rater']:6s}{flag}")


if __name__ == "__main__":
    main()
