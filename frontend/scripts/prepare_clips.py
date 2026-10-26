"""Pick, process and record the frontend's demo and scene clips (Task 14).

Run from the repository root with the backend venv, the datasets in backend/dataset/ and the served model
listening on 127.0.0.1:5001:

    backend/venv/bin/python -I frontend/scripts/prepare_clips.py

- Demo clips: one per class from the locked test split (backend/artifacts/latest/split_manifest.csv), the
  best by audio quality only (never by the model's answer): unclipped, 4-90 s, highest breath-band share.
- Scene-1 excerpts: 8-12 s runs of ICBHI breath cycles annotated (crackles, wheezes) = (0,0), (1,0), (0,1),
  from test-split ICBHI recordings, cut on cycle boundaries. The "normal" excerpt comes from a healthy patient only
  (NORMAL_PICK; see there). `--scene-only` re-picks the scene excerpts and keeps the demo clips and their answers.
- Every clip: loudness-normalised (EBU R128, -20 LUFS, -2 dBTP), 50 ms fades, mono 22,050 Hz MP3 96 kbit/s.
- Each processed demo clip is sent to the live /predict; the response is saved next to it.
Writes frontend/public/audio/*.mp3, frontend/public/demo/*.json, frontend/src/content/clips.json and
frontend/src/content/clips.provenance.json.
"""

import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import welch

ROOT = Path.cwd()
BACKEND = ROOT / "backend"
PUBLIC = ROOT / "frontend/public"
CONTENT = ROOT / "frontend/src/content"
ANNOTATIONS = BACKEND / "dataset/ICBHI_final_dataset"
CLASSES = ["asthma", "bronchial", "copd", "healthy", "pneumonia"]
# The first pick for "normal" (the highest breath-band share over all diagnoses) was a COPD patient's annotated-normal
# cycles, dominated by heartbeat-like thumps. "Normal" now comes from healthy patients only; of the 7 healthy
# test-split candidates this one was chosen by eye for clearly visible breath cycles after the 100-2,000 Hz band-pass
# (2026-10-27; audio only, never the model's answer).
NORMAL_PICK = "153_1b1_Al_sc_Meditron.wav"
SOURCE_NAMES = {"icbhi": "ICBHI 2017", "kauh": "KAUH (Mendeley Data, CC BY 4.0)", "kaggle_asthma_v2": "Kaggle Asthma Detection V2"}


def load_mono(path: Path, start: float = 0.0, end: float | None = None) -> tuple[np.ndarray, int]:
    info = sf.info(str(path))
    frames = (int(start * info.samplerate), None if end is None else int(end * info.samplerate))
    data, sr = sf.read(str(path), start=frames[0], stop=frames[1], always_2d=True)
    return data.mean(axis=1), sr


def quality(x: np.ndarray, sr: int) -> dict[str, float]:
    """Higher band_db = more of the energy sits in the breath band (100-2,000 Hz) than outside it."""
    f, p = welch(x, fs=sr, nperseg=min(4096, len(x)))
    band = p[(f >= 100) & (f <= 2000)].sum()
    out = p[((f >= 20) & (f < 100)) | (f > 2000)].sum() + 1e-20
    return {"band_db": float(10 * np.log10(band / out + 1e-20)), "peak": float(np.max(np.abs(x))),
            "rms": float(np.sqrt(np.mean(x**2))), "seconds": len(x) / sr}


def acceptable(q: dict[str, float], lo: float = 8.0, hi: float = 90.0) -> bool:
    return q["peak"] < 0.99 and q["rms"] > 0.002 and lo <= q["seconds"] <= hi


def process(src: Path, dst: Path, start: float | None = None, end: float | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    seconds = (end - start) if start is not None and end is not None else sf.info(str(src)).duration
    cut = ["-ss", f"{start:.3f}", "-to", f"{end:.3f}"] if start is not None else []
    fade = f"afade=t=in:d=0.05,afade=t=out:st={max(0.0, seconds - 0.05):.3f}:d=0.05"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *cut, "-i", str(src), "-ac", "1", "-ar", "22050",
                    "-af", f"loudnorm=I=-20:TP=-2,{fade}", "-c:a", "libmp3lame", "-b:a", "96k", str(dst)], check=True)


def predict(path: Path) -> dict:
    out = subprocess.run(["curl", "-s", "-m", "300", "-F", f"file=@{path};type=audio/mpeg", "http://127.0.0.1:5001/predict"],
                         check=True, capture_output=True, text=True).stdout
    result = json.loads(out)
    if "error" in result:
        raise RuntimeError(f"{path.name}: {result['error']}")
    return result


def cycles(stem: str) -> list[tuple[float, float, int, int]]:
    rows = []
    for line in (ANNOTATIONS / f"{stem}.txt").read_text().split("\n"):
        parts = line.split()
        if len(parts) == 4:
            rows.append((float(parts[0]), float(parts[1]), int(parts[2]), int(parts[3])))
    return rows


def find_run(rows, pattern: tuple[int, int], lo: float = 8.0, hi: float = 12.0) -> tuple[float, float] | None:
    for i in range(len(rows)):
        j = i
        while j < len(rows) and (rows[j][2], rows[j][3]) == pattern:
            if lo <= rows[j][1] - rows[i][0] <= hi:
                return rows[i][0], rows[j][1]
            if rows[j][1] - rows[i][0] > hi:
                break
            j += 1
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene-only", action="store_true", help="re-pick the scene excerpts; keep the demo clips")
    args = parser.parse_args()
    manifest = [r for r in csv.DictReader((BACKEND / "artifacts/latest/split_manifest.csv").open()) if r["split"] == "test"]
    demo, scene, provenance = [], {}, {"demo": [], "scene": []}
    if args.scene_only:
        demo = json.loads((CONTENT / "clips.json").read_text())["demo"]
        provenance["demo"] = json.loads((CONTENT / "clips.provenance.json").read_text())["demo"]

    for disease in ([] if args.scene_only else CLASSES):
        scored = []
        for r in (r for r in manifest if r["disease"] == disease):
            x, sr = load_mono(BACKEND / r["path"])
            q = quality(x, sr)
            if acceptable(q, lo=4.0):  # Kaggle asthma clips are all <= 6 s; 4 s is just under one model window
                scored.append((q["band_db"], r, q))
        if not scored:
            sys.exit(f"no acceptable test recording for {disease}")
        _, row, q = max(scored, key=lambda s: s[0])
        clip_id = f"demo-{disease}"
        audio = PUBLIC / f"audio/{clip_id}.mp3"
        process(BACKEND / row["path"], audio)
        response = predict(audio)
        (PUBLIC / "demo").mkdir(parents=True, exist_ok=True)
        (PUBLIC / f"demo/{clip_id}.json").write_text(json.dumps(response, indent=2) + "\n")
        label = f"{disease.upper() if disease == 'copd' else disease.capitalize()} example"
        demo.append({"id": clip_id, "label": label, "file": f"/audio/{clip_id}.mp3", "predictFile": f"/demo/{clip_id}.json",
                     "source": SOURCE_NAMES.get(row["source"], row["source"]), "patientId": row["patient_id"]})
        provenance["demo"].append({"id": clip_id, **row, "quality": {k: round(v, 3) for k, v in q.items()},
                                   "candidates": len(scored), "model_answer": response["prediction"]})
        print(f"{clip_id}: {Path(row['path']).name} ({row['source']}, patient {row['patient_id']}, {q['seconds']:.1f} s, "
              f"band {q['band_db']:.1f} dB) -> model says {response['prediction']} {response['confidence']}%")

    patterns = {"normal": (0, 0), "crackles": (1, 0), "wheezes": (0, 1)}
    icbhi = [r for r in manifest if r["source"] == "icbhi"]
    for kind, pattern in patterns.items():
        best = None
        candidates = [r for r in icbhi if Path(r["path"]).name == NORMAL_PICK] if kind == "normal" else icbhi
        for r in candidates:
            stem = Path(r["path"]).stem
            span = find_run(cycles(stem), pattern)
            if not span:
                continue
            x, sr = load_mono(BACKEND / r["path"], *span)
            q = quality(x, sr)
            if acceptable(q, 7.5, 12.5) and (best is None or q["band_db"] > best[0]):
                best = (q["band_db"], r, span, q)
        if best is None:
            sys.exit(f"no test-split ICBHI run for {kind}")
        _, row, (start, end), q = best
        audio = PUBLIC / f"audio/scene1-{kind}.mp3"
        process(BACKEND / row["path"], audio, start, end)
        scene[kind] = f"/audio/scene1-{kind}.mp3"
        provenance["scene"].append({"id": kind, **row, "start_s": start, "end_s": end, "annotation": list(pattern),
                                    "quality": {k: round(v, 3) for k, v in q.items()}})
        print(f"scene1-{kind}: {Path(row['path']).name} {start:.2f}-{end:.2f} s (band {q['band_db']:.1f} dB)")

    (CONTENT / "clips.json").write_text(json.dumps({"demo": demo, "scene": scene}, indent=2) + "\n")
    (CONTENT / "clips.provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    (PUBLIC / "audio/CREDITS.md").write_text(
        "# Audio credits\n\nAll clips are short, loudness-normalised excerpts or recordings from public research datasets,\n"
        "taken from patients in RespiNet's locked test split (never trained on):\n\n"
        "- ICBHI 2017 Respiratory Sound Database (Rocha et al., 2019)\n"
        "- KAUH lung sounds, Mendeley Data, doi:10.17632/jwyy9np4gv.3 (CC BY 4.0)\n"
        "- Kaggle \"Asthma Detection Dataset Version 2\"\n\n"
        "Per-clip source files, patient IDs and time ranges: `frontend/src/content/clips.provenance.json`.\n")


if __name__ == "__main__":
    main()
