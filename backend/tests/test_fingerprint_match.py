import importlib.util
from pathlib import Path

import numpy as np
import soundfile as sf

from experiments.fingerprint_match import THRESHOLD, Index, landmarks


def _noise(seconds: float, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(int(4_000 * seconds)).astype(np.float32) * 0.1


def test_a_gain_changed_cut_is_found_and_unrelated_audio_is_not(tmp_path):
    paths = []
    for i in range(3):
        path = tmp_path / f"ref{i}.wav"
        sf.write(path, _noise(25, seed=i), 4_000)
        paths.append(str(path))
    index = Index(paths, workers=1)
    cut = _noise(25, seed=1)[20_000:20_000 + 4_000 * 6] * 0.37  # a different gain, as in a re-upload
    name, votes = index.query(*landmarks(cut))
    assert name == "ref1.wav" and votes >= THRESHOLD
    _, chance = index.query(*landmarks(_noise(6, seed=99)))
    assert chance < THRESHOLD


def test_landmarks_of_very_short_audio_are_empty():
    hashes, anchors = landmarks(np.zeros(100, dtype=np.float32))
    assert len(hashes) == 0 and len(anchors) == 0


def test_cohen_kappa_of_two_raters():
    path = Path(__file__).resolve().parents[2] / "research" / "tools" / "listening_score.py"
    spec = importlib.util.spec_from_file_location("listening_score", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.cohen_kappa([True, True, False, False], [True, True, False, False]) == 1.0
    assert abs(module.cohen_kappa([True, True, False, False], [True, False, False, True])) < 1e-9  # chance level
    assert module.cohen_kappa([True, True], [True, True]) is None  # no variation, kappa undefined
