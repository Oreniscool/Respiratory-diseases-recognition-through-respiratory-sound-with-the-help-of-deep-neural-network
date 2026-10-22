import io

import numpy as np
import soundfile as sf

from experiments.site_vs_band import KAUH_RATE, as_kauh_format, summarize


def test_recording_is_rewritten_in_the_kauh_format(tmp_path):
    t = np.arange(44_100) / 44_100
    source = tmp_path / "x.wav"
    sf.write(source, (0.2 * np.sin(2 * np.pi * 300 * t) + 0.2 * np.sin(2 * np.pi * 3_000 * t)).astype(np.float32), 44_100)
    data, rate = sf.read(io.BytesIO(as_kauh_format(source)))
    assert rate == KAUH_RATE and abs(len(data) - KAUH_RATE) <= 1
    spectrum = np.abs(np.fft.rfft(data))
    freqs = np.fft.rfftfreq(len(data), 1 / KAUH_RATE)
    assert freqs.max() <= 2_000 and spectrum[np.argmin(np.abs(freqs - 300))] > 10 * spectrum.mean()


def test_summary_counts_asthma_predictions_per_condition_and_label():
    rows = [
        {"condition": "original", "label": "healthy", "prediction": "healthy"},
        {"condition": "as_4khz", "label": "healthy", "prediction": "asthma"},
        {"condition": "as_4khz", "label": "healthy", "prediction": "healthy"},
    ]
    summary = summarize(rows)
    assert summary["original/healthy"]["accuracy"] == 1.0
    assert summary["as_4khz/healthy"]["predicted_asthma"] == 0.5
