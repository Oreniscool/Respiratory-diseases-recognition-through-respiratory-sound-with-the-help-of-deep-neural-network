"""Second external test: SPRSound (paediatric, Shanghai) through the served prediction path.

Runs every ``ok`` recording of ``data/sprsound_manifest.csv`` through ``server.extract_mfcc`` →
``_prediction_payload`` for the artifact selected by ``RESPINET_MODEL_PATH`` /
``RESPINET_MODEL_METADATA`` and stores one row per recording (probabilities, abstention, or the lung-sound
gate's refusal). Resumable: rows already in the output file are skipped. Pre-registered use (D-32): one
evaluation per artifact, never used to choose between candidates; analysis is in
``research/tools/sprsound_analysis.py``.

    RESPINET_MODEL_PATH=artifacts/latest/best_model.keras python -m experiments.external_sprsound --name round2b
"""

from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

OUTPUT_DIR = Path("artifacts/experiments/external")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--name", required=True)
    parser.add_argument("--manifest", default="data/sprsound_manifest.csv")
    parser.add_argument("--limit", type=int, default=0, help="only the first N rows (timing checks; not for results)")
    args = parser.parse_args()

    import server

    model = server.load_model_once()
    if server.CONTRACT is None:
        raise SystemExit(f"Model contract not verified: {server.MODEL_CONTRACT_ERROR}")
    with Path(args.manifest).open(newline="", encoding="utf-8") as handle:
        manifest = [r for r in csv.DictReader(handle) if r["status"] == "ok"]
    if args.limit:
        manifest = manifest[:args.limit]
    out = OUTPUT_DIR / f"sprsound_{args.name}_recordings.json"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = json.loads(out.read_text()) if out.is_file() and not args.limit else []
    done = {r["path"] for r in rows}
    started = time.time()
    for index, entry in enumerate(manifest):
        if entry["path"] in done:
            continue
        path = Path(entry["path"])
        base = {"path": entry["path"], "patient_id": entry["patient_id"], "label": entry["label"],
                "age": float(entry["age"]), "release": entry["release"]}
        try:
            windows, audio, rate, lengths, _, yamnet_audio = server.extract_mfcc(path.read_bytes(), filename=path.name)
            payload, probabilities, _ = server._prediction_payload(
                model, windows, audio, rate, lengths, denoise=False, yamnet_audio=yamnet_audio)
            rows.append({**base, "model_prediction": payload["model_prediction"], "uncertain": payload["uncertain"],
                         "probabilities": [float(p) for p in probabilities], "gate_reason": None})
        except ValueError as error:  # the lung-sound gate (or a length limit) refused the audio: record, don't crash
            rows.append({**base, "model_prediction": "gate_rejected", "uncertain": None, "probabilities": None,
                         "gate_reason": str(error)})
        if len(rows) % 100 == 0 and not args.limit:
            out.write_text(json.dumps(rows), encoding="utf-8")
            print(f"[sprsound] {len(rows)}/{len(manifest)} ({time.time() - started:.0f}s)", flush=True)
    if not args.limit:
        out.write_text(json.dumps(rows), encoding="utf-8")
    meta = {"artifact": str(server.MODEL_PATH), "model_sha256": server.CONTRACT.metadata["model_sha256"],
            "source_revision": server.CONTRACT.metadata.get("source_revision"), "classes": server.CLASSES,
            "recordings": len(rows), "gate_rejected": sum(r["model_prediction"] == "gate_rejected" for r in rows),
            "seconds": round(time.time() - started)}
    if not args.limit:
        (OUTPUT_DIR / f"sprsound_{args.name}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
