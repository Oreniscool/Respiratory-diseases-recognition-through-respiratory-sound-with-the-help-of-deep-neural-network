"""Export the served model's per-recording probabilities on its test split (server path, CPU).

``main.py`` stores only aggregate test metrics. Several analyses need the per-recording outputs
(normal-vs-abnormal AUROC in cohort, sensitivity without the Kaggle remainder, paired comparison
with the no-audio rule). This runs every test recording of ``artifacts/latest/split_manifest.csv``
through ``server._prediction_payload``. Use the CPU, as Docker serving does: one of 389 recordings
differs from the GPU evaluation (TF32 near-tie, CLAUDE.md §6).

Writes ``backend/artifacts/experiments/served_test_predictions.json``.

    cd backend && CUDA_VISIBLE_DEVICES="" python ../research/tools/export_test_predictions.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))


def main() -> None:
    import server

    model = server.load_model_once()
    if server.CONTRACT is None:
        raise SystemExit(f"Model contract not verified: {server.MODEL_CONTRACT_ERROR}")
    with (BACKEND / "artifacts/latest/split_manifest.csv").open(newline="", encoding="utf-8") as handle:
        rows = [r for r in csv.DictReader(handle) if r["split"] == "test"]
    out = []
    for index, row in enumerate(rows):
        path = BACKEND / row["path"]
        windows, wave, rate, lengths, _, audio16 = server.extract_mfcc(path.read_bytes(), filename=path.name)
        payload, _, _ = server._prediction_payload(model, windows, wave, rate, lengths, denoise=False, yamnet_audio=audio16)
        out.append({**row, "probabilities": [payload["probabilities"][c] / 100.0 for c in server.CLASSES],
                    "model_prediction": payload["model_prediction"], "uncertain": payload["uncertain"]})
        if index % 50 == 0:
            print(f"[export] {index}/{len(rows)}", flush=True)
    result = {"classes": server.CLASSES, "source_revision": server.CONTRACT.metadata.get("source_revision"),
              "device": "cpu", "recordings": out}
    (BACKEND / "artifacts/experiments/served_test_predictions.json").write_text(json.dumps(result), encoding="utf-8")
    print(f"wrote {len(out)} recordings")


if __name__ == "__main__":
    main()
