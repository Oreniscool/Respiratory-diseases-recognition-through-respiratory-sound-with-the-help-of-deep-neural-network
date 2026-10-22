import numpy as np

from experiments.leakage_ladder import original_selection, split_indices


def test_selection_follows_the_original_rules():
    diagnosis = {"101": "URTI", "103": "Asthma", "108": "LRTI", "104": "COPD", "105": "COPD"}
    files = [f"104_{i}b1_Al_sc_AKGC417L.wav" for i in range(5)] + [
        "105_1b1_Ar_sc_Meditron.wav", "101_1b1_Al_sc_Meditron.wav", "103_2b2_Ar_mc_LittC2SE.wav",
        "108_1b1_Al_sc_Meditron.wav", "101_1b1_Al_sc_Meditron.txt",
    ]
    rows = original_selection(files, diagnosis)
    patients = [p for _, p, _ in rows]
    assert "103" not in patients and "108" not in patients  # excluded as in the 2021 code
    assert patients.count("104") == 3  # COPD capped at the first recording + 2 more
    assert patients.count("105") == 1 and patients.count("101") == 1
    assert all(name.endswith(".wav") for name, _, _ in rows)


def _ladder_data(patients=24, recordings=2, variants=5):
    labels = ["URTI", "Healthy", "COPD"]
    rows = {"recording": [], "patient": [], "label": [], "variant": []}
    for p in range(patients):
        for r in range(recordings):
            for v in range(variants):
                rows["recording"].append(f"{p}_{r}")
                rows["patient"].append(str(p))
                rows["label"].append(labels[p % 3])
                rows["variant"].append("original" if v == 0 else f"aug{v}")
    return {key: np.asarray(value) for key, value in rows.items()}


def test_rungs_differ_in_exactly_the_leak_they_remove():
    data = _ladder_data()

    def units(rung, part, key):
        return set(data[key][split_indices(rung, data, seed=3)[part]])

    l0 = split_indices("L0", data, seed=3)
    assert len(l0["validation"]) == 0  # L0 selects on test
    assert units("L0", "train", "recording") & units("L0", "test", "recording")  # copies cross the split
    assert len(split_indices("L1", data, seed=3)["validation"]) > 0

    for rung in ("L2", "L3"):
        parts = split_indices(rung, data, seed=3)
        assert not units(rung, "train", "recording") & units(rung, "test", "recording")
        assert set(data["variant"][parts["test"]]) == {"original"}  # no augmented copies in test
        assert set(data["variant"][parts["validation"]]) == {"original"}
    assert units("L2", "train", "patient") & units("L2", "test", "patient")  # L2 still shares patients
    assert not units("L3", "train", "patient") & units("L3", "test", "patient")
    assert not units("L3", "validation", "patient") & units("L3", "test", "patient")


def test_original_model_matches_the_paper_layer_counts():
    from experiments.leakage_ladder import ORIGINAL_PARAMETERS, original_model

    assert original_model().count_params() == ORIGINAL_PARAMETERS
