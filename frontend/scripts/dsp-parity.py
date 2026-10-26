"""Write librosa's MFCCs for a 10 s excerpt, for src/lib/audio/dsp.parity.test.ts (local check, not CI).

    backend/venv/bin/python -I frontend/scripts/dsp-parity.py AUDIO_FILE OUTPUT_JSON
"""
import json
import sys

import librosa
import numpy as np

audio, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(audio, sr=22050, mono=True, duration=10.0)
m = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40, n_fft=2048, hop_length=512)  # as backend/preprocessing.py
with open(out, "w", encoding="utf-8") as handle:
    json.dump({"sr": sr, "samples": np.round(y, 7).tolist(), "mfcc": m.T.round(5).tolist(),
               "librosa": librosa.__version__}, handle)
print(f"wrote {out}: {len(y)} samples, mfcc {m.T.shape}, librosa {librosa.__version__}")
