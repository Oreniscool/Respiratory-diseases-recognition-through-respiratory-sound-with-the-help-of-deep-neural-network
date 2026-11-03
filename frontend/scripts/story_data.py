"""Build the array data behind the story's research and training scenes: frontend/src/content/story-data.json.

Run from the repository root (standard library only; the training curve needs backend/artifacts/latest):

    backend/venv/bin/python -I frontend/scripts/story_data.py

- ``nccHistogram``: best normalized cross-correlation of every Kaggle V2 clip against all ICBHI recordings, in
  bins of 0.02 (backend/data/kaggle_icbhi_overlap.csv, tracked).
- ``oneRecording``: the ICBHI recording with the most Kaggle copies, with each copy's offset and its Kaggle file
  name (same CSV).
- ``trainingCurve``: per-epoch accuracy and loss of the served seed-42 RespiNet
  (backend/artifacts/latest/training_history.json, gitignored). Kept from the previous file when it is absent.

``frontend/src/content/facts.sources.test.ts`` recomputes the first two from the CSV and the third from the
artifact (when present), so the file cannot drift from its sources.
"""

import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path.cwd()
OVERLAP = ROOT / "backend/data/kaggle_icbhi_overlap.csv"
HISTORY = ROOT / "backend/artifacts/latest/training_history.json"
OUT = ROOT / "frontend/src/content/story-data.json"
BIN = 0.02
BINS = 50


def group(clip: str) -> str:
    """The Kaggle file-name "patient" (e.g. P47 in copd/P47COPDPr_373.wav); not a real patient ID."""
    match = re.match(r"P\d+", clip.split("/", 1)[-1])
    return match.group(0) if match else "?"


def histogram(rows: list[dict[str, str]]) -> dict:
    counts = [0] * BINS
    for row in rows:
        counts[min(BINS - 1, int(float(row["best_ncc"]) / BIN))] += 1
    return {"binWidth": BIN, "counts": counts, "source": "backend/data/kaggle_icbhi_overlap.csv → best_ncc"}


def one_recording(rows: list[dict[str, str]]) -> dict:
    copies = [r for r in rows if r["is_overlap"] == "True"]
    # most copies first; ties broken by name so the choice is stable
    reference = min(Counter(r["reference"] for r in copies).items(), key=lambda kv: (-kv[1], kv[0]))[0]
    clips = sorted((r for r in copies if r["reference"] == reference), key=lambda r: float(r["offset_seconds"]))
    return {
        "reference": reference,
        "patient": reference.split("_", 1)[0],
        "clips": [
            {
                "clip": r["clip"].split("/", 1)[-1],
                "group": group(r["clip"]),
                "className": r["clip_class"],
                "offset": float(r["offset_seconds"]),
                "seconds": float(r["clip_seconds"]),
                "ncc": float(r["best_ncc"]),
            }
            for r in clips
        ],
        "source": "backend/data/kaggle_icbhi_overlap.csv (rows whose reference is this recording)",
    }


def training_curve(previous: dict | None) -> dict | None:
    if not HISTORY.exists():
        return (previous or {}).get("trainingCurve")
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    r4 = lambda values: [round(float(v), 4) for v in values]  # noqa: E731
    val = history["val_accuracy"]
    return {
        "seed": 42,
        "epochs": len(val),
        "restoredEpoch": max(range(len(val)), key=lambda i: (val[i], -i)) + 1,
        "accuracy": r4(history["accuracy"]),
        "valAccuracy": r4(val),
        "loss": r4(history["loss"]),
        "valLoss": r4(history["val_loss"]),
        "source": "backend/artifacts/latest/training_history.json (seed 42, best_model.keras)",
    }


def main() -> None:
    with OVERLAP.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
    data = {"nccHistogram": histogram(rows), "oneRecording": one_recording(rows), "trainingCurve": training_curve(previous)}
    OUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(rows)} clips, recording {data['oneRecording']['reference']} "
          f"({len(data['oneRecording']['clips'])} copies), training curve {'yes' if data['trainingCurve'] else 'absent'}")


if __name__ == "__main__":
    main()
