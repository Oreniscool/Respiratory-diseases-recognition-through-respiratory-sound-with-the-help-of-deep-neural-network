"""Score the blind listening check of the copy detector (experiments/match_validation.py listening).

Compares the rater's answer sheet with the answer key and writes
``backend/artifacts/experiments/match_validation/listening_result.json``:
agreement on decided pairs, unsure rate, and precision/recall of the detector as judged by the rater.
If a second rater's sheet exists (``listening_rater2/answer_sheet_rater2.csv``, filled in on a copy of
the pairs that does not contain the first rater's answers), it is scored the same way and the two
raters are compared: raw agreement and Cohen's kappa on the pairs both decided.

    python research/tools/listening_score.py [--detail]

``--detail`` prints the per-pair detector labels, i.e. the answer key. Do not use it in a transcript
that a still-blind rater, human or model, will see.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from scipy.stats import beta

DIR = Path(__file__).resolve().parents[2] / "backend" / "artifacts" / "experiments" / "match_validation"


def exact(k: int, n: int) -> list[float] | None:
    if n == 0:
        return None
    return [0.0 if k == 0 else float(beta.ppf(0.025, k, n - k + 1)), 1.0 if k == n else float(beta.ppf(0.975, k + 1, n - k))]


def read_answers(path: Path) -> dict[int, str]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))[1:]
    answers = {int(r[0]): (r[1].strip().lower() if len(r) > 1 else "") for r in rows if r and r[0].strip()}
    bad = {p: a for p, a in answers.items() if a not in ("yes", "no", "unsure")}
    if bad:
        raise SystemExit(f"{path.name}: answers must be yes/no/unsure; got {dict(list(bad.items())[:3])}")
    return answers


def score_rater(answers: dict[int, str], key: dict[int, dict]) -> dict[str, object]:
    pairs = [{"pair": pair, "detector": row["truth"], "rater": answers[pair], "best_ncc": float(row["best_ncc"]),
              "clip": row["clip"], "reference": row["reference"]} for pair, row in sorted(key.items())]
    decided = [p for p in pairs if p["rater"] != "unsure"]
    agree = [p for p in decided if (p["rater"] == "yes") == (p["detector"] == "match")]
    by = lambda d, r: sum(p["detector"] == d and p["rater"] == r for p in pairs)  # noqa: E731
    return {
        "pairs": len(pairs), "unsure": len(pairs) - len(decided),
        "agreement_on_decided": len(agree) / len(decided) if decided else None,
        "agreement_on_decided_ci95": exact(len(agree), len(decided)),
        "table": {f"{d}/{r}": by(d, r) for d in ("match", "non-match") for r in ("yes", "no", "unsure")},
        "detector_matches_confirmed_by_rater": f"{by('match', 'yes')}/{by('match', 'yes') + by('match', 'no')}",
        "detector_non_matches_confirmed_by_rater": f"{by('non-match', 'no')}/{by('non-match', 'yes') + by('non-match', 'no')}",
        "pairs_detail": pairs,
    }


def cohen_kappa(a: list[bool], b: list[bool]) -> float | None:
    """Cohen's kappa for two binary raters; None when chance agreement is 1 (no variation)."""
    n = len(a)
    if n == 0:
        return None
    observed = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    expected = pa * pb + (1 - pa) * (1 - pb)
    return None if expected == 1 else (observed - expected) / (1 - expected)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--detail", action="store_true", help="print the per-pair detector labels (the answer key)")
    args = parser.parse_args()
    with (DIR / "listening_key" / "answer_key.csv").open(newline="", encoding="utf-8") as handle:
        key = {int(r["pair"]): r for r in csv.DictReader(handle)}
    first = read_answers(DIR / "listening" / "answer_sheet.csv")
    result: dict[str, object] = {
        "raters": 1, **score_rater(first, key),
        "note": ("Pairs are the 10 lowest-scoring detector matches and the 10 highest-scoring non-matches "
                 "(the hardest cases), so agreement here is a lower bound for the full set."),
    }
    sheet2 = DIR / "listening_rater2" / "answer_sheet_rater2.csv"
    if sheet2.is_file() and any(len(r) > 1 and r[1].strip() for r in list(csv.reader(sheet2.open(encoding="utf-8")))[1:]):
        second = read_answers(sheet2)
        result["raters"] = 2
        result["rater2"] = score_rater(second, key)
        both = [p for p in sorted(key) if first[p] != "unsure" and second[p] != "unsure"]
        a, b = [first[p] == "yes" for p in both], [second[p] == "yes" for p in both]
        result["inter_rater"] = {"pairs_both_decided": len(both),
                                 "raw_agreement": sum(x == y for x, y in zip(a, b)) / len(both) if both else None,
                                 "cohen_kappa": cohen_kappa(a, b),
                                 "disagreeing_pairs": [p for p, x, y in zip(both, a, b) if x != y]}
    (DIR / "listening_result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: (v if k not in ("pairs_detail", "rater2") else "…") for k, v in result.items()}, indent=2))
    if args.detail:
        for p in result["pairs_detail"]:
            flag = "" if p["rater"] == "unsure" or (p["rater"] == "yes") == (p["detector"] == "match") else "  <-- disagree"
            print(f"pair {p['pair']:2d}: detector {p['detector']:9s} (NCC {p['best_ncc']:.3f})  rater {p['rater']:6s}{flag}")


if __name__ == "__main__":
    main()
