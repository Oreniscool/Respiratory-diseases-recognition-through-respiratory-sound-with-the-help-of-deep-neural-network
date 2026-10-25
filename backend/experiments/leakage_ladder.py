"""X1 — leakage ladder: the 2021 protocol (Basu & Rana, IEEE 2020) with its leaks removed one at a time.

Faithful re-implementation of the original pipeline at git ``3ec7dc6`` (``featureExtraction.py``,
``model.py``, ``train.py``, ``Augmentation.py``):

- ICBHI 2017, six classes (URTI, Healthy, COPD, Bronchiectasis, Pneumonia, Bronchiolitis); patients
  103 (Asthma), 108 and 115 (LRTI) excluded, as in the original code. **Authentic** diagnoses are
  used (``dataset/patient_diagnosis_authentic.csv``): the repository's ``patient_diagnosis.csv`` is
  scrambled.
- COPD capped at three recordings per patient, with the original counter logic applied to the
  file list in sorted order (the original used ``os.listdir`` order, which is not specified).
- One 40-dim mean-MFCC vector per recording (``librosa.load`` defaults: 22,050 Hz, kaiser_fast).
- Non-COPD recordings get four augmented copies (noise 0.005·N(0,1), ``np.roll`` by 1,600 samples,
  time-stretch ×1.2 and ×0.8); COPD recordings are not augmented.
- The original GRU network (328,726 parameters, matching every layer in the paper's Fig. 3), Adamax,
  categorical cross-entropy, 1,000 epochs.

Rungs (each repeated over seeds 0…N−1; the same seed gives the same split within a rung):

- **L0 original:** augment first, random sample-level 75/25 split; checkpoint = best test accuracy.
- **L1 + validation selection:** as L0, but the checkpoint is chosen on a validation split carved
  from the training samples.
- **L2 + augment after split:** split recordings 75/25 (stratified), augment training recordings only;
  test on original recordings; validation from the training recordings.
- **L3 + patient-disjoint:** split patients 75/25 (stratified by patient diagnosis); validation
  patients from the training patients; augment training only.
- **L4** = L3 scored per patient (mean of a patient's recording probabilities).
- **L2T / L3T:** L2 / L3 splits with the checkpoint selected on the test split, completing the
  split-unit × selection factorial.

**Fidelity grid** (``fidelity`` command): the original code cannot run as published (undefined
``x_train``/``num_batch_size``/``data``, no split or evaluation code, Keras-2 APIs). L0 is therefore
re-run under the two undocumented choices that could plausibly matter:
- batch size: Keras's default of 32, or full-batch, which the original ``batch_size = X.shape[0]``
  suggests;
- GRU gate activation: ``sigmoid`` (Keras ≥ 2.3) or Keras 2's ``hard_sigmoid``, which is
  ``clip(0.2·x + 0.5, 0, 1)``, not Keras 3's slope-1/6 version.

Results go to ``results_fidelity.csv`` / ``fidelity_summary.json``.

Usage (from ``backend/``)::

    python -m experiments.leakage_ladder features
    python -m experiments.leakage_ladder run --repeats 20 --workers 6
    python -m experiments.leakage_ladder report
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

OUTPUT_DIR = Path("artifacts/experiments/leakage_ladder")
ICBHI_DIR = Path("dataset/ICBHI_final_dataset")
DIAGNOSIS_CSV = Path("dataset/patient_diagnosis_authentic.csv")
EXCLUDED_PATIENTS = ("103", "108", "115")  # as in the original code (Asthma, LRTI ×2)
CLASSES = ["Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"]
RUNGS = ("L0", "L1", "L2", "L3", "L2T", "L3T")
# Factorial completion (review request): split unit {sample, recording, patient} × checkpoint selection
# {test, validation}. L0/L1 = sample; L2/L2T = recording; L3/L3T = patient; "T" = selected on test.
SELECT_ON_TEST = ("L0", "L2T", "L3T")
EPOCHS = 1000
BATCH_SIZE = 32  # not stated in the paper or code; Keras default
# Sum of the per-layer counts in the paper's Fig. 3 (GRUs 323,616 + Dense 5,110). The figure's printed
# total reads 320,726, which does not match its own rows; we reproduce the rows.
ORIGINAL_PARAMETERS = 328_726


# --------------------------------------------------------------------------- data selection


def original_selection(file_names: list[str], diagnosis: dict[str, str]) -> list[tuple[str, str, str]]:
    """(file, patient, label) chosen exactly like ``InstantiateAttributes`` in the original code.

    The COPD rule: the first recording of a patient is always taken and resets a global counter;
    a further recording of an already-seen COPD patient is taken while the counter is below 2.
    """
    selected = []
    seen_copd: list[str] = []
    copd_count = 0
    for name in sorted(file_names):
        patient = name[:3]
        if not name.endswith("wav") or patient in EXCLUDED_PATIENTS:
            continue
        label = diagnosis[patient]
        if label == "COPD":
            if patient in seen_copd and copd_count < 2:
                seen_copd.append(patient)
                copd_count += 1
                selected.append((name, patient, label))
            if patient not in seen_copd:
                seen_copd.append(patient)
                copd_count = 0
                selected.append((name, patient, label))
        else:
            selected.append((name, patient, label))
    return selected


def load_diagnosis(path: Path = DIAGNOSIS_CSV) -> dict[str, str]:
    with path.open(newline="", encoding="utf-8") as handle:
        return {str(row["patient_id"]): row["disease"] for row in csv.DictReader(handle)}


# --------------------------------------------------------------------------- features


def mean_mfcc(waveform: np.ndarray, sample_rate: int) -> np.ndarray:
    import librosa

    return np.mean(librosa.feature.mfcc(y=waveform, sr=sample_rate, n_mfcc=40).T, axis=0)


def build_features(seed: int = 0) -> None:
    """Original (+ four augmented copies for non-COPD) mean-MFCC vectors, cached once."""
    import librosa

    rng = np.random.default_rng(seed)
    rows = original_selection(os.listdir(ICBHI_DIR), load_diagnosis())
    features, recording, variant, patients, labels = [], [], [], [], []
    for index, (name, patient, label) in enumerate(rows):
        data, sr = librosa.load(str(ICBHI_DIR / name), res_type="kaiser_fast")
        variants = [("original", data)]
        if label != "COPD":
            variants += [
                ("noise", data + 0.005 * rng.standard_normal(len(data))),
                ("roll_1600", np.roll(data, 1600)),
                ("stretch_1.2", librosa.effects.time_stretch(data, rate=1.2)),
                ("stretch_0.8", librosa.effects.time_stretch(data, rate=0.8)),
            ]
        for variant_name, audio in variants:
            features.append(mean_mfcc(audio, sr))
            recording.append(name)
            variant.append(variant_name)
            patients.append(patient)
            labels.append(label)
        if index % 100 == 0:
            print(f"[features] {index}/{len(rows)}", flush=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(OUTPUT_DIR / "features.npz", X=np.asarray(features, dtype=np.float32),
             recording=np.asarray(recording), variant=np.asarray(variant),
             patient=np.asarray(patients), label=np.asarray(labels))
    summary = {
        "recordings": len(rows), "samples": len(features),
        "recordings_per_class": dict(Counter(label for _, _, label in rows)),
        "samples_per_class": dict(Counter(labels)),
        "patients_per_class": {c: len({p for _, p, label in rows if label == c}) for c in CLASSES},
    }
    (OUTPUT_DIR / "features_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


# --------------------------------------------------------------------------- splits


def split_indices(rung: str, data: dict[str, np.ndarray], seed: int) -> dict[str, np.ndarray]:
    """Train / validation / test sample indices for one rung (validation is empty for L0)."""
    from sklearn.model_selection import train_test_split

    n = len(data["label"])
    everything = np.arange(n)
    if rung in ("L0", "L1"):
        train, test = train_test_split(everything, test_size=0.25, random_state=seed)
        if rung == "L0":
            return {"train": train, "validation": np.asarray([], dtype=int), "test": test}
        train, validation = train_test_split(train, test_size=0.2, random_state=seed)
        return {"train": train, "validation": validation, "test": test}

    unit = data["recording"] if rung in ("L2", "L2T") else data["patient"]
    units, first = np.unique(unit, return_index=True)
    unit_label = data["label"][first]
    train_units, test_units = train_test_split(units, test_size=0.25, random_state=seed, stratify=unit_label)
    train_label = unit_label[np.isin(units, train_units)]
    fit_units, validation_units = train_test_split(
        np.sort(train_units), test_size=0.2, random_state=seed,
        stratify=train_label[np.argsort(train_units)],
    )
    original = data["variant"] == "original"
    return {
        "train": everything[np.isin(unit, fit_units)],  # augmented copies only ever in training
        "validation": everything[np.isin(unit, validation_units) & original],
        "test": everything[np.isin(unit, test_units) & original],
    }


# --------------------------------------------------------------------------- model and training


def keras2_hard_sigmoid(x):
    """Keras 2's hard sigmoid, clip(0.2·x + 0.5, 0, 1) (Keras 3's has slope 1/6)."""
    import tensorflow as tf

    return tf.clip_by_value(0.2 * x + 0.5, 0.0, 1.0)


def original_model(num_classes: int = 6, recurrent_activation: str = "sigmoid"):
    """The 2021 network (``3ec7dc6:model.py``) in Keras 3.

    ``recurrent_activation`` is "sigmoid" (Keras ≥ 2.3 default) or "hard_sigmoid_keras2" (Keras < 2.3).
    """
    from tensorflow.keras import Input, Model
    from tensorflow.keras.layers import GRU, Dense, Dropout, LeakyReLU, add

    gate = keras2_hard_sigmoid if recurrent_activation == "hard_sigmoid_keras2" else recurrent_activation

    def gru(units, x):
        # reset_after=False: the Keras 2 default the 2021 code ran with (one bias per gate)
        return GRU(units, return_sequences=True, activation=None, go_backwards=True, reset_after=False,
                   recurrent_activation=gate)(x)

    inputs = Input(shape=(1, 40))
    m21 = gru(32, inputs)
    m2 = LeakyReLU()(gru(128, LeakyReLU()(m21)))
    m3 = LeakyReLU()(gru(128, LeakyReLU()(gru(64, inputs))))
    a1 = add([m3, m2])
    m5 = LeakyReLU()(gru(32, LeakyReLU()(gru(128, a1))))
    m6 = LeakyReLU()(gru(32, LeakyReLU()(gru(64, a1))))
    a2 = add([m5, m6, m21])
    m7 = LeakyReLU()(Dense(16)(Dropout(0.2)(LeakyReLU()(Dense(64)(a2)))))
    m9 = LeakyReLU()(Dense(16)(Dropout(0.2)(LeakyReLU()(Dense(32)(a2)))))
    m10 = Dropout(0.5)(LeakyReLU()(Dense(16)(add([m7, m9]))))
    outputs = Dense(num_classes, activation="softmax")(m10)
    return Model(inputs, outputs)


def run_one(job: tuple[str, int, int]) -> dict[str, object]:
    """Train one rung/seed and return its test metrics (selection per the rung's rules)."""
    rung, seed, epochs = job[:3]
    variant = job[3] if len(job) > 3 else {}
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    import tensorflow as tf
    from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score

    tf.config.threading.set_intra_op_parallelism_threads(2)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.keras.utils.set_random_seed(seed)
    stored = np.load(OUTPUT_DIR / "features.npz", allow_pickle=False)
    data = {key: stored[key] for key in stored.files}
    parts = split_indices(rung, data, seed)
    y = np.asarray([CLASSES.index(label) for label in data["label"]])
    # The 2021 network keeps return_sequences=True, so it outputs (N, 1, classes); targets match.
    onehot = np.eye(len(CLASSES), dtype=np.float32)[y][:, None, :]
    X = data["X"][:, None, :]
    selection = parts["test"] if rung in SELECT_ON_TEST else parts["validation"]

    model = original_model(len(CLASSES), variant.get("recurrent_activation", "sigmoid"))
    model.compile(loss="categorical_crossentropy", optimizer=tf.keras.optimizers.Adamax(), metrics=["accuracy"])
    best = {"score": -1.0, "weights": None, "epoch": 0}

    class Select(tf.keras.callbacks.Callback):
        def on_epoch_end(self, epoch, logs=None):
            predicted = np.argmax(self.model.predict(X[selection], verbose=0)[:, 0, :], axis=1)
            score = accuracy_score(y[selection], predicted)
            if score > best["score"]:  # ModelCheckpoint(save_best_only) keeps the first maximum
                best.update(score=score, weights=self.model.get_weights(), epoch=epoch + 1)

    started = time.time()
    batch_size = len(parts["train"]) if variant.get("batch_size") == "full" else BATCH_SIZE
    model.fit(X[parts["train"]], onehot[parts["train"]], batch_size=batch_size, epochs=epochs,
              verbose=0, callbacks=[Select()])
    model.set_weights(best["weights"])
    probabilities = model.predict(X[parts["test"]], verbose=0)[:, 0, :]
    predicted = probabilities.argmax(1)
    truth = y[parts["test"]]
    result = {
        "rung": rung, "seed": seed, "epochs": epochs, "best_epoch": best["epoch"],
        "selection_split": "test" if rung in SELECT_ON_TEST else "validation",
        "train_samples": int(len(parts["train"])), "test_samples": int(len(truth)),
        "accuracy": float(accuracy_score(truth, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(truth, predicted)),
        "weighted_f1": float(f1_score(truth, predicted, average="weighted")),
        "minutes": round((time.time() - started) / 60, 2),
    }
    if variant:
        result.update(batch_size=variant.get("batch_size", BATCH_SIZE),
                      recurrent_activation=variant.get("recurrent_activation", "sigmoid"))
    if rung in ("L3", "L3T"):  # L4: the same model scored per patient
        patients = data["patient"][parts["test"]]
        unique = np.unique(patients)
        patient_truth = np.asarray([truth[patients == p][0] for p in unique])
        patient_pred = np.asarray([probabilities[patients == p].mean(0).argmax() for p in unique])
        result.update({
            "patient_test_patients": int(len(unique)),
            "patient_accuracy": float(accuracy_score(patient_truth, patient_pred)),
            "patient_balanced_accuracy": float(balanced_accuracy_score(patient_truth, patient_pred)),
        })
    return result


# --------------------------------------------------------------------------- CLI


def run(rungs: list[str], repeats: int, workers: int, epochs: int) -> None:
    out = OUTPUT_DIR / "results.csv"
    done = set()
    if out.is_file():
        with out.open(newline="", encoding="utf-8") as handle:
            done = {(row["rung"], int(row["seed"])) for row in csv.DictReader(handle)}
    jobs = [(rung, seed, epochs) for rung in rungs for seed in range(repeats) if (rung, seed) not in done]
    print(f"[ladder] {len(jobs)} runs ({len(done)} already done)", flush=True)
    fields = ["rung", "seed", "epochs", "best_epoch", "selection_split", "train_samples", "test_samples",
              "accuracy", "balanced_accuracy", "weighted_f1", "patient_test_patients", "patient_accuracy",
              "patient_balanced_accuracy", "minutes"]
    write_header = not out.is_file()
    with ProcessPoolExecutor(workers) as pool, out.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        if write_header:
            writer.writeheader()
        for result in pool.map(run_one, jobs):
            writer.writerow(result)
            handle.flush()
            print(f"[ladder] {result['rung']} seed {result['seed']}: acc {result['accuracy']:.4f} "
                  f"bal {result['balanced_accuracy']:.4f} ({result['minutes']} min)", flush=True)


FIDELITY_CELLS = [
    {"batch_size": 32, "recurrent_activation": "hard_sigmoid_keras2"},
    {"batch_size": "full", "recurrent_activation": "sigmoid"},
    {"batch_size": "full", "recurrent_activation": "hard_sigmoid_keras2"},
]  # (32, sigmoid) is L0 in results.csv


def fidelity(repeats: int, workers: int, epochs: int) -> None:
    """L0 under the undocumented batch-size and gate-activation choices; resumable."""
    out = OUTPUT_DIR / "results_fidelity.csv"
    cell = lambda r: (str(r["batch_size"]), r["recurrent_activation"])  # noqa: E731
    done = set()
    if out.is_file():
        with out.open(newline="", encoding="utf-8") as handle:
            done = {(cell(row), int(row["seed"])) for row in csv.DictReader(handle)}
    jobs = [("L0", seed, epochs, v) for v in FIDELITY_CELLS for seed in range(repeats) if (cell(v), seed) not in done]
    print(f"[fidelity] {len(jobs)} runs ({len(done)} already done)", flush=True)
    fields = ["rung", "seed", "epochs", "best_epoch", "selection_split", "train_samples", "test_samples",
              "accuracy", "balanced_accuracy", "weighted_f1", "minutes", "batch_size", "recurrent_activation"]
    write_header = not out.is_file()
    with ProcessPoolExecutor(workers) as pool, out.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        if write_header:
            writer.writeheader()
        for result in pool.map(run_one, jobs):
            writer.writerow(result)
            handle.flush()
            print(f"[fidelity] batch {result['batch_size']} {result['recurrent_activation']} seed {result['seed']}: "
                  f"acc {result['accuracy']:.4f} ({result['minutes']} min)", flush=True)
    rows = list(csv.DictReader(out.open(newline="", encoding="utf-8")))
    with (OUTPUT_DIR / "results.csv").open(newline="", encoding="utf-8") as handle:
        rows += [{**r, "batch_size": "32", "recurrent_activation": "sigmoid"}
                 for r in csv.DictReader(handle) if r["rung"] == "L0"]
    summary = {"paper_reported": {"accuracy_mean": 0.9567, "accuracy_sd": 0.0077, "runs_shown": "10 of 20",
                                  "lowest_run_shown": 0.9486}}
    for key in sorted({cell(r) for r in rows}):
        acc = np.sort([float(r["accuracy"]) for r in rows if cell(r) == key])[::-1]
        summary[f"batch {key[0]}, {key[1]}"] = {
            "runs": int(acc.size), "accuracy_mean": float(acc.mean()), "accuracy_sd": float(acc.std(ddof=1)),
            "accuracy_max": float(acc[0]), "top10_mean": float(acc[:10].mean()),
            "runs_at_or_above_lowest_reported": int((acc >= 0.9486).sum()),
        }
    (OUTPUT_DIR / "fidelity_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


def summarize() -> dict[str, object]:
    with (OUTPUT_DIR / "results.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    summary: dict[str, object] = {}
    metrics = ("accuracy", "balanced_accuracy", "weighted_f1", "patient_accuracy", "patient_balanced_accuracy")
    for rung in sorted({row["rung"] for row in rows}):
        subset = [row for row in rows if row["rung"] == rung]
        summary[rung] = {"repeats": len(subset)}
        for metric in metrics:
            values = np.asarray([float(row[metric]) for row in subset if row.get(metric) not in ("", None)])
            if values.size:
                summary[rung][metric] = {"mean": float(values.mean()), "sd": float(values.std(ddof=1)) if values.size > 1 else 0.0,
                                         "min": float(values.min()), "max": float(values.max())}
    for metric, prefix in (("accuracy", "drop"), ("balanced_accuracy", "balanced_drop")):
        by_seed = {(row["rung"], int(row["seed"])): float(row[metric]) for row in rows}
        for low, high in (("L0", "L1"), ("L1", "L2"), ("L2", "L3"), ("L0", "L3"), ("L2T", "L2"), ("L3T", "L3")):
            seeds = sorted({s for r, s in by_seed if r == low} & {s for r, s in by_seed if r == high})
            if seeds:
                drops = np.asarray([by_seed[(low, s)] - by_seed[(high, s)] for s in seeds])
                summary[f"{prefix}_{low}_to_{high}"] = {
                    "mean": float(drops.mean()), "sd": float(drops.std(ddof=1)) if drops.size > 1 else 0.0,
                    "seeds": len(seeds),
                }
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["features", "run", "report", "params", "fidelity"])
    parser.add_argument("--rungs", nargs="+", default=list(RUNGS), choices=RUNGS)
    parser.add_argument("--repeats", type=int, default=20)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    args = parser.parse_args()
    if args.command == "features":
        build_features()
    elif args.command == "run":
        run(args.rungs, args.repeats, args.workers, args.epochs)
    elif args.command == "report":
        summarize()
    elif args.command == "fidelity":
        fidelity(args.repeats, args.workers, args.epochs)
    else:
        print(original_model().count_params())


if __name__ == "__main__":
    main()
