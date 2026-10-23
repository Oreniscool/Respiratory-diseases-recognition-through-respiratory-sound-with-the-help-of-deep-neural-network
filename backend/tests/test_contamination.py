from experiments.contamination import status_of, summarize


def test_recordings_are_classified_by_how_they_relate_to_kaggle_copies():
    copied = {"104_1b1_Al_sc_Meditron.wav"}
    patients = {"104"}
    assert status_of("104_1b1_Al_sc_Meditron.wav", copied, patients) == "copied_recording"
    assert status_of("104_2b1_Ar_sc_Meditron.wav", copied, patients) == "copied_patient"
    assert status_of("105_1b1_Al_sc_Meditron.wav", copied, patients) == "clean"


def test_summary_reports_accuracy_per_status_and_class():
    rows = [
        {"status": "copied_recording", "label": "copd", "patient_id": "104", "prediction": "copd"},
        {"status": "clean", "label": "copd", "patient_id": "105", "prediction": "asthma"},
        {"status": "clean", "label": "copd", "patient_id": "106", "prediction": "copd"},
    ]
    summary = summarize(rows)
    assert summary["copied_recording/copd"]["accuracy"] == 1.0
    assert summary["clean/copd"]["accuracy"] == 0.5 and summary["clean/copd"]["patients"] == 2
