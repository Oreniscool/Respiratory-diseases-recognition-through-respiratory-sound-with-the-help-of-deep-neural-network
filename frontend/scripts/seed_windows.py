"""Record each RespiNet seed's own window-by-window reading of the story's sample recording (scene 7).

Run from the repository root with the backend venv and backend/artifacts/latest present:

    backend/venv/bin/python -I frontend/scripts/seed_windows.py

Uses the server's own feature extraction and per-model prediction (server.extract_mfcc, _predict_probabilities)
on ICBHI 218_1b1_Al_sc_Meditron.wav, the recording behind documentation/frontend_sample_predict.json. The served
response's window_scores are the plain mean of the three seeds' window probabilities, so this script checks that the
mean of what it records reproduces them before writing frontend/src/content/sample-seeds.json.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path.cwd()
SAMPLE_AUDIO = ROOT / "backend/dataset/ICBHI_final_dataset/218_1b1_Al_sc_Meditron.wav"
SAMPLE_RESPONSE = ROOT / "documentation/frontend_sample_predict.json"
OUT = ROOT / "frontend/src/content/sample-seeds.json"


def main() -> None:
    os.chdir(ROOT / "backend")
    sys.path.insert(0, str(ROOT / "backend"))
    import server  # loads and verifies the artifact contract
    from tensorflow.keras.models import load_model

    if server.CONTRACT is None:
        sys.exit(f"artifact contract not verified: {server.MODEL_CONTRACT_ERROR}")
    artifact = server.CONTRACT.metadata_path.parent
    respinet = next(m for m in server.CONTRACT.fusion["members"] if m["kind"] == "respinet")
    windows = server.extract_mfcc(SAMPLE_AUDIO.read_bytes(), filename=SAMPLE_AUDIO.name)[0]
    seeds = []
    for name in respinet["files"]:
        model = load_model(artifact / name, custom_objects=server._custom_objects())
        seeds.append((name, np.asarray(server._predict_probabilities(model, windows))))

    classes = list(server.CLASSES)
    served = json.loads(SAMPLE_RESPONSE.read_text())["window_scores"]
    mean = np.mean([p for _, p in seeds], axis=0) * 100
    expected = np.array([[w[c] for c in classes] for w in served])
    gap = float(np.max(np.abs(mean - expected)))
    print(f"{len(windows)} windows; max |mean of seeds - served window_scores| = {gap:.3f} points")
    if mean.shape != expected.shape or gap > 0.5:
        sys.exit("the seeds do not reproduce the served window scores; not writing")

    seed_numbers = {"best_model.keras": 42, "respinet_seed43.keras": 43, "respinet_seed44.keras": 44}
    OUT.write_text(json.dumps({
        "source": f"frontend/scripts/seed_windows.py on {SAMPLE_AUDIO.relative_to(ROOT)} with backend/artifacts/latest "
                  f"(code revision {server.CONTRACT.metadata.get('source_revision', 'unknown')}); the mean of the seeds "
                  f"reproduces documentation/frontend_sample_predict.json window_scores to {gap:.3f} points",
        "classes": classes,
        "seeds": [{"seed": seed_numbers.get(name, name), "file": name,
                   "window_scores": [{c: round(float(v) * 100, 2) for c, v in zip(classes, row)} for row in probs]}
                  for name, probs in seeds],
    }, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
