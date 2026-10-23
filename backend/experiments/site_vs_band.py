"""X2 — is the KAUH → "asthma" failure a site/device shortcut or a 4 kHz bandwidth artifact?

KAUH recordings are 4 kHz WAV files (no content above 2 kHz); ICBHI recordings are mostly 44.1 kHz.
This diagnostic takes ICBHI recordings that the evaluated model never trained on (its own test and validation splits,
read from the artifact's ``split_manifest.csv``) and scores each one twice through the served
prediction path:

- ``original``: the file as recorded;
- ``as_4khz``: resampled to 4 kHz and written as a 4 kHz WAV, i.e. exactly KAUH's format.

If ICBHI healthy/COPD audio keeps its predictions at 4 kHz while KAUH healthy/COPD patients are
called asthma, the failure is about the site/device, not the bandwidth. If ICBHI audio also flips to
asthma at 4 kHz, the bandwidth is the cause. A fixed, already-evaluated model is analyzed; nothing
here feeds back into model choice (EVALUATION_PROTOCOL.md §2, diagnostic analyses).

Usage (from ``backend/``; the model comes from RESPINET_MODEL_PATH / RESPINET_MODEL_METADATA)::

    python -m experiments.site_vs_band --name served_round2
"""

from __future__ import annotations

import argparse
import csv
import io
import json
from collections import Counter
from pathlib import Path

import numpy as np

OUTPUT_DIR = Path("artifacts/experiments/site_vs_band")
KAUH_RATE = 4_000


def as_kauh_format(path: str | Path) -> bytes:
    """The recording resampled to 4 kHz and encoded as a 16-bit WAV, like the KAUH files."""
    import librosa
    import soundfile as sf

    waveform, _ = librosa.load(str(path), sr=KAUH_RATE, mono=True)
    buffer = io.BytesIO()
    sf.write(buffer, waveform, KAUH_RATE, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def summarize(rows: list[dict[str, object]]) -> dict[str, object]:
    """Accuracy and prediction distribution per (condition, true label)."""
    summary: dict[str, object] = {}
    for condition in sorted({row["condition"] for row in rows}):
        for label in sorted({row["label"] for row in rows}):
            subset = [row for row in rows if row["condition"] == condition and row["label"] == label]
            if subset:
                summary[f"{condition}/{label}"] = {
                    "recordings": len(subset),
                    "accuracy": float(np.mean([row["prediction"] == label for row in subset])),
                    "predicted_asthma": float(np.mean([row["prediction"] == "asthma" for row in subset])),
                    "predictions": dict(Counter(row["prediction"] for row in subset)),
                }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--name", required=True)
    parser.add_argument("--labels", nargs="+", default=["healthy", "copd", "bronchial"])
    # Validation recordings were used for early stopping/calibration but never trained on; the
    # original-vs-4 kHz comparison is paired per recording, so that selection does not bias it.
    parser.add_argument("--splits", nargs="+", default=["test", "validation"])
    args = parser.parse_args()

    import server

    model = server.load_model_once()
    if server.CONTRACT is None:
        raise SystemExit(f"Model contract not verified: {server.MODEL_CONTRACT_ERROR}")
    split = server.CONTRACT.metadata_path.parent / "split_manifest.csv"
    with split.open(newline="", encoding="utf-8") as handle:
        test = [r for r in csv.DictReader(handle)
                if r["split"] in args.splits and r["source"] == "icbhi" and r["disease"] in args.labels]
    rows = []
    for index, record in enumerate(test):
        path = Path(record["path"])
        for condition, audio in (("original", path.read_bytes()), ("as_4khz", as_kauh_format(path))):
            try:
                windows, data, rate, lengths, _, yamnet_audio = server.extract_mfcc(audio, filename=path.name)
            except ValueError as error:  # the lung-sound gate refused the audio: record it, don't crash
                rows.append({"path": record["path"], "patient_id": record["patient_id"], "label": record["disease"],
                             "split": record["split"], "device": path.stem.rsplit("_", 1)[-1],
                             "condition": condition, "prediction": "gate_rejected", "uncertain": None,
                             "gate_reason": str(error)})
                continue
            payload, _, _ = server._prediction_payload(
                model, windows, data, rate, lengths, denoise=False, yamnet_audio=yamnet_audio
            )
            rows.append({"path": record["path"], "patient_id": record["patient_id"], "label": record["disease"],
                         "split": record["split"],
                         "device": path.stem.rsplit("_", 1)[-1], "condition": condition,
                         "prediction": payload["model_prediction"], "uncertain": payload["uncertain"]})
        if index % 25 == 0:
            print(f"[x2] {index}/{len(test)}", flush=True)
    result = {"artifact": str(server.MODEL_PATH), "source_revision": server.CONTRACT.metadata.get("source_revision"),
              "summary": summarize(rows)}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / f"{args.name}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (OUTPUT_DIR / f"{args.name}_recordings.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()
