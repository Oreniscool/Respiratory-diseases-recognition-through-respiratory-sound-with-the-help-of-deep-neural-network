import numpy as np

from experiments.external import summarize
from kauh import OUT_OF_LABEL

CLASSES = ["asthma", "bronchial", "copd", "healthy", "pneumonia"]


def _row(patient, label, probabilities, uncertain=False):
    probabilities = np.asarray(probabilities, dtype=float)
    return {"patient_id": patient, "label": label, "probabilities": probabilities.tolist(),
            "model_prediction": CLASSES[int(probabilities.argmax())], "uncertain": uncertain}


def test_patients_are_scored_on_the_mean_of_their_recordings():
    rows = [
        _row(1, "healthy", [0, 0, 0.4, 0.6, 0]),
        _row(1, "healthy", [0, 0, 0.7, 0.3, 0]),  # mean favours copd (0.55)
        _row(2, "copd", [0, 0, 0.9, 0.1, 0]),
        _row(3, "healthy", [0, 0, 0.1, 0.9, 0]),
        _row(4, OUT_OF_LABEL, [0.2, 0.2, 0.2, 0.2, 0.2], uncertain=True),
        _row(5, OUT_OF_LABEL, [0, 0, 1, 0, 0]),
    ]
    result = summarize(rows, CLASSES)
    assert result["in_label_patients"] == 3
    assert result["patient_sensitivity"] == {"copd": 1.0, "healthy": 0.5}
    assert result["patient_balanced_accuracy"] == 0.75
    assert result["recording_accuracy"] == 3 / 4
    assert result["out_of_label_abstention"] == 0.5
    assert result["out_of_label_predictions"] == {"asthma": 1, "copd": 1}


def test_external_patients_must_not_be_in_the_models_cohort(tmp_path):
    import pytest

    from experiments.external import assert_not_in_training

    split = tmp_path / "split_manifest.csv"
    split.write_text("split,patient_id,disease,source,path\ntrain,900005,healthy,kauh,a.wav\n")
    assert_not_in_training([{"patient_id": "900006"}], split)
    with pytest.raises(SystemExit, match="in this model's cohort"):
        assert_not_in_training([{"patient_id": "900005"}], split)


def test_external_refuses_patients_whose_audio_is_in_the_cohort(tmp_path):
    import pytest

    from experiments.external import assert_no_linked_audio

    audio = tmp_path / "audio"
    audio.mkdir()
    (audio / "BP100_N,N,P R M,70,F.wav").write_bytes(b"same")
    (audio / "BP101_Asthma,E W,P L M,12,F.wav").write_bytes(b"same")
    split = tmp_path / "split_manifest.csv"
    split.write_text("split,patient_id,disease,source,path\nvalidation,900101,asthma,kaggle_asthma_v2,x.wav\n")
    with pytest.raises(SystemExit, match="share audio"):
        assert_no_linked_audio([{"patient_id": "900100"}], split, audio)
    assert_no_linked_audio([{"patient_id": "900005"}], split, audio)  # unrelated patient passes
