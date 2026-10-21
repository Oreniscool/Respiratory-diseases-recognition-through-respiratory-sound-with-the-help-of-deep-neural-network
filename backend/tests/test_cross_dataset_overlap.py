import numpy as np
import soundfile as sf

from cross_dataset_overlap import (
    MATCH_SAMPLE_RATE,
    band_limited,
    find_overlaps,
    max_normalized_cross_correlation,
    summarize,
)

SR = MATCH_SAMPLE_RATE


def _noise(seconds, seed):
    return band_limited(np.random.default_rng(seed).normal(size=int(seconds * SR)))


def test_amplified_noisy_segment_is_found_at_its_offset():
    reference = _noise(10, seed=0)
    start = 2 * SR
    segment = reference[start : start + 3 * SR] * 3.0  # "amplified" in an audio editor
    segment = segment + 0.05 * np.std(segment) * np.random.default_rng(1).normal(size=segment.size)
    score, offset = max_normalized_cross_correlation(segment.astype(np.float32), reference)
    assert score > 0.95
    assert abs(offset - start) <= 1


def test_unrelated_audio_scores_low():
    score, _ = max_normalized_cross_correlation(_noise(3, seed=2), _noise(10, seed=3))
    assert score < 0.3


def test_silent_clip_is_not_a_match():
    assert max_normalized_cross_correlation(np.zeros(SR, dtype=np.float32), _noise(5, 4))[0] == 0.0


def test_find_overlaps_flags_only_the_copied_clip(tmp_path):
    references = []
    for index in range(2):
        path = tmp_path / "icbhi" / f"10{index}_1b1_Al_sc_Meditron.wav"
        path.parent.mkdir(exist_ok=True)
        sf.write(path, _noise(8, seed=10 + index), SR)
        references.append(str(path))
    copied, original = tmp_path / "kaggle" / "copd" / "P1COPDMc_1.wav", tmp_path / "kaggle" / "copd" / "P2COPDMc_2.wav"
    copied.parent.mkdir(parents=True)
    sf.write(copied, sf.read(references[1])[0][SR : 4 * SR] * 2.0, SR)
    sf.write(original, _noise(3, seed=99), SR)

    rows = find_overlaps([str(copied), str(original)], references, threshold=0.95)
    by_clip = {row["clip"]: row for row in rows}
    assert by_clip[str(copied)]["is_overlap"] is True
    assert by_clip[str(copied)]["reference"] == "101_1b1_Al_sc_Meditron.wav"
    assert by_clip[str(copied)]["offset_seconds"] == 1.0
    assert by_clip[str(original)]["is_overlap"] is False

    summary = summarize(rows, 0.95)
    assert summary["overlaps"] == 1 and summary["by_class"]["copd"] == {"clips": 2, "overlaps": 1}
