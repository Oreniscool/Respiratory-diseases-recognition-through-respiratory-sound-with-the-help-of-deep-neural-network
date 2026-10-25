"""Non-breath probes: is the recording source decodable from audio that contains no breath sound?

For every development recording (split v3, train + validation) three feature sets are built from
the raw audio (22,050 Hz mono, no band-pass):

- ``full``: mean and std of 40 MFCCs over all frames (reference);
- ``quietest``: the same over the quietest 10% of frames by RMS (at least 5 frames), which are mostly
  pauses between breaths, i.e. the device and room noise floor;
- ``edges``: mean MFCCs of the first and of the last 100 ms (recording start and end).

Each set gets the patient-grouped linear probes of ``experiments/shortcut.py`` (dataset of origin,
ICBHI device, disease, and source within one diagnosis). If the source stays decodable from
``quietest`` and ``edges``, the source signature lies in the acquisition chain, not in the breath
sounds, and "acquisition/site confounding" can be named as the mechanism.

Writes ``artifacts/experiments/nonbreath_probes.json``.

    python -m experiments.nonbreath --workers 8
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ProcessPoolExecutor

import numpy as np

from experiments.cv import OUTPUT_DIR, load_development_records, recording_device
from experiments.shortcut import probe, source_detail, within_label_probes

SAMPLE_RATE, N_FFT, HOP, N_MFCC = 22_050, 2_048, 512, 40


def features(path: str) -> dict[str, np.ndarray]:
    import librosa

    audio, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    mfcc = librosa.feature.mfcc(y=audio, sr=SAMPLE_RATE, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP)
    rms = librosa.feature.rms(y=audio, frame_length=N_FFT, hop_length=HOP)[0][: mfcc.shape[1]]
    quiet = np.argsort(rms)[: max(5, int(0.1 * len(rms)))]
    edge = max(1, int(round(0.1 * SAMPLE_RATE / HOP)))  # frames in 100 ms
    stats = lambda m: np.concatenate([m.mean(axis=1), m.std(axis=1)])  # noqa: E731
    return {
        "full": stats(mfcc),
        "quietest": stats(mfcc[:, quiet]),
        "edges": np.concatenate([mfcc[:, :edge].mean(axis=1), mfcc[:, -edge:].mean(axis=1)]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    records, _ = load_development_records()
    paths = [str(r.path) for r in records]
    sources = np.asarray([r.source for r in records])
    patients = np.asarray([r.patient_id for r in records])
    labels = np.asarray([r.disease for r in records])
    devices = np.asarray([recording_device(p) for p in paths])
    detail = np.asarray([source_detail(s, int(p)) for s, p in zip(sources, patients)])
    with ProcessPoolExecutor(args.workers) as pool:
        table = list(pool.map(features, paths, chunksize=8))
    icbhi = sources == "icbhi"
    results: dict[str, object] = {"recordings": len(paths), "patients": int(len(np.unique(patients)))}
    for name in ("full", "quietest", "edges"):
        x = np.stack([t[name] for t in table])
        results[name] = {
            "dataset_of_origin": probe(x, sources, patients),
            "icbhi_device": probe(x[icbhi], devices[icbhi], patients[icbhi]),
            "disease": probe(x, labels, patients),
            "within_label": within_label_probes(x, labels, detail, patients),
        }
        r = results[name]
        print(name, {k: round(v, 3) for k, v in r.items() if not isinstance(v, dict)}, flush=True)
    (OUTPUT_DIR / "nonbreath_probes.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
