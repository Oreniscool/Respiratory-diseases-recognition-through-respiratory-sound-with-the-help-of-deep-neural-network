from pathlib import Path

import numpy as np

from experiments.cv import (
    _write_oof,
    development_split,
    make_folds,
    paired_patient_bootstrap,
    read_oof,
    window_mask,
)
from featureExtraction import AudioRecord


def _cohort(patients_per_class=12, recordings_per_patient=2):
    records = []
    for class_index, disease in enumerate(["asthma", "copd", "healthy"]):
        for p in range(patients_per_class):
            patient = 1000 * (class_index + 1) + p
            for r in range(recordings_per_patient):
                records.append(AudioRecord(Path(f"/data/{disease}/{patient}_{r}.wav"), patient, disease))
    return records


def test_development_split_excludes_every_test_patient():
    development, test_patients = development_split(
        _cohort(), test_size=0.2, validation_size=0.2, seed=42
    )
    assert test_patients
    assert not test_patients & {record.patient_id for record in development}


def test_folds_are_patient_disjoint_and_cover_each_patient_once():
    records = _cohort()
    folds = make_folds(records, k=3, seed=42)
    scored = [{r.patient_id for r in fold["scored"]} for fold in folds]
    assert set().union(*scored) == {r.patient_id for r in records}
    assert sum(len(s) for s in scored) == len({r.patient_id for r in records})
    for fold in folds:
        groups = [{r.patient_id for r in fold[name]} for name in ("fit", "inner_validation", "scored")]
        assert not (groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        assert {r.disease for r in fold["inner_validation"]} == {"asthma", "copd", "healthy"}


def test_window_mask_selects_records_and_original_audio_only():
    records = _cohort(patients_per_class=1, recordings_per_patient=1)
    paths = np.asarray([str(r.path) for r in records for _ in range(2)])
    meta = {"source_paths": paths, "variants": np.asarray(["original", "noise_20db"] * len(records))}
    mask = window_mask(meta, records[:1], original_only=True)
    assert mask.tolist() == [True, False, False, False, False, False]
    assert window_mask(meta, records[:1], original_only=False).sum() == 2


def test_paired_bootstrap_detects_which_model_is_better():
    rng = np.random.default_rng(0)
    patients = np.arange(60)
    y = patients % 3
    perfect = np.eye(3)[y] * 0.9 + 0.05
    noisy = np.eye(3)[rng.integers(0, 3, size=60)] * 0.9 + 0.05
    better = paired_patient_bootstrap(y, noisy, perfect, patients, samples=200)
    worse = paired_patient_bootstrap(y, perfect, noisy, patients, samples=200)
    assert better["balanced_accuracy"]["p_improvement"] > 0.95
    assert worse["balanced_accuracy"]["p_improvement"] < 0.05
    assert better["macro_f1"]["lower"] > 0


def test_oof_files_round_trip_sorted_by_path(tmp_path):
    rows = [
        {"path": "b.wav", "patient_id": 2, "source": "icbhi", "label": "copd", "fold": 0, "p_asthma": 0.2, "p_copd": 0.8},
        {"path": "a.wav", "patient_id": 1, "source": "icbhi", "label": "asthma", "fold": 1, "p_asthma": 0.7, "p_copd": 0.3},
    ]
    _write_oof(tmp_path / "oof_x.csv", rows, ["asthma", "copd"])
    class_names, table = read_oof(tmp_path / "oof_x.csv")
    assert class_names == ["asthma", "copd"]
    assert table["path"].tolist() == ["a.wav", "b.wav"]
    assert table["y"].tolist() == [0, 1]
    np.testing.assert_allclose(table["probabilities"][1], [0.2, 0.8])


def test_shallow_run_and_report_produce_paired_results(tmp_path, monkeypatch):
    import experiments.cv as cv

    monkeypatch.setattr(cv, "OUTPUT_DIR", tmp_path)
    records = _cohort(patients_per_class=12)
    rng = np.random.default_rng(1)
    signal = {"asthma": 0, "copd": 1, "healthy": 2}
    features = {}
    for record in records:
        vector = rng.standard_normal(6)
        vector[signal[record.disease]] += 3.0
        features[str(record.path)] = vector
    cv.run_shallow("D0", features, records, cv._fit_logistic)
    cv.run_shallow("C1_test", features, records, cv._fit_boosting)
    _, table = read_oof(tmp_path / "oof_D0.csv")
    assert len(table["path"]) == len(records)

    results = cv.report()
    assert results["D0"]["patient_level"]["accuracy"] > 0.8
    assert "vs_D0" in results["C1_test"]
    assert (tmp_path / "results.json").is_file()


def test_shortcut_probe_detects_a_recoverable_source():
    from experiments.shortcut import probe

    rng = np.random.default_rng(4)
    groups = np.repeat(np.arange(30), 2)
    source = np.where(groups % 2 == 0, "icbhi", "kaggle")
    informative = rng.standard_normal((60, 5)) + (source == "icbhi")[:, None] * 4.0
    noise = rng.standard_normal((60, 5))
    assert probe(informative, source, groups) > 0.95
    assert probe(noise, source, groups) < 0.8


def test_stacked_fusion_scores_each_fold_with_a_stacker_trained_elsewhere():
    from experiments.cv import stacked_fusion

    rng = np.random.default_rng(5)
    y = np.arange(90) % 3
    folds = np.arange(90) % 3
    good = np.eye(3)[y] * 0.8 + 0.2 / 3
    noise = rng.dirichlet(np.ones(3), 90)
    tables = [{"probabilities": noise, "y": y, "fold": folds}, {"probabilities": good, "y": y, "fold": folds}]
    stacked = stacked_fusion(tables)
    np.testing.assert_allclose(stacked.sum(axis=1), 1.0, rtol=1e-6)
    assert (stacked.argmax(axis=1) == y).mean() > 0.9  # learns to trust the informative member
