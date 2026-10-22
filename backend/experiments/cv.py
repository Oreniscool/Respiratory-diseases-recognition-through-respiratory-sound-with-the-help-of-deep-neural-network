"""Patient-grouped cross-validation for comparing model variants without touching the test split.

The development set is the train + validation part of the same seed-42 patient split that
``main.py`` uses; the test patients are never loaded. Each fold is a small copy of the real
pipeline: the model is fit on part of the training patients, early-stopped and temperature-
calibrated on an inner validation split of them, and scored on the held-out patients. Every
variant therefore produces one out-of-fold (OOF) calibrated prediction for every development
recording, on identical folds, so variants can be compared pairwise and fused.

Usage (from ``backend/``)::

    python -m experiments.cv cache --feature-type mfcc
    python -m experiments.cv deep --variant D0
    python -m experiments.cv classical
    python -m experiments.cv yamnet
    python -m experiments.cv report
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import warnings
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.metrics import balanced_accuracy_score, f1_score
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

from calibration import apply_temperature, fit_temperature
from evaluate import evaluate_by_group, evaluate_model, evaluate_patient_level, finite_or_none
from featureExtraction import AudioRecord

OUTPUT_DIR = Path("artifacts/experiments")
YAMNET_DIR = Path("artifacts/pretrained/yamnet")
SEED = 42
FOLDS = 3
INNER_VALIDATION_SIZE = 0.20

# Deep variants differ from the current model (D0) in exactly one setting.
DEEP_VARIANTS: dict[str, dict[str, object]] = {
    "D0": {"feature_type": "mfcc", "use_focal_loss": True},
    "D1": {"feature_type": "mfcc", "use_focal_loss": False},
    "D2": {"feature_type": "logmel", "use_focal_loss": True},
}
# Training settings of the current model (artifacts/latest/model_metadata.json).
TRAINING = {"batch_size": 64, "epochs": 80, "learning_rate": 3e-4, "label_smoothing": 0.1}


# --------------------------------------------------------------------------- cohort and folds


def development_split(
    records: list[AudioRecord], *, test_size: float, validation_size: float, seed: int
) -> tuple[list[AudioRecord], set[int]]:
    """Return the train + validation records of ``main.split_by_patient`` and the test patients."""
    from main import split_by_patient

    splits = split_by_patient(records, test_size=test_size, validation_size=validation_size, seed=seed)
    development = [*splits["train"], *splits["validation"]]
    test_patients = {record.patient_id for record in splits["test"]}
    if test_patients & {record.patient_id for record in development}:
        raise AssertionError("Test patients leaked into the development set")
    return development, test_patients


def load_development_records() -> tuple[list[AudioRecord], set[int]]:
    from main import build_cohort, parse_args, resolve_dataset_paths

    args = parse_args(["--dataset-format", "folder", "--merge-icbhi", "--seed", str(SEED)])
    resolve_dataset_paths(args)
    records, _ = build_cohort(args)
    return development_split(
        records, test_size=args.test_size, validation_size=args.validation_size, seed=args.seed
    )


def _patient_labels(records: list[AudioRecord]) -> dict[int, str]:
    labels: dict[int, str] = {}
    for record in records:
        if labels.setdefault(record.patient_id, record.disease) != record.disease:
            raise ValueError(f"Patient {record.patient_id} has more than one label")
    return labels


def make_folds(
    records: list[AudioRecord], *, k: int = FOLDS, seed: int = SEED
) -> list[dict[str, list[AudioRecord]]]:
    """Stratified, patient-disjoint folds, each with an inner validation split of its fit part."""
    labels = _patient_labels(records)
    patients = np.asarray(sorted(labels))
    patient_classes = np.asarray([labels[p] for p in patients])
    splitter = StratifiedGroupKFold(n_splits=k, shuffle=True, random_state=seed)
    folds = []
    for train_index, scored_index in splitter.split(patients, patient_classes, groups=patients):
        fit_patients, inner_patients = train_test_split(
            patients[train_index],
            test_size=INNER_VALIDATION_SIZE,
            stratify=patient_classes[train_index],
            random_state=seed,
        )
        groups = {
            "fit": set(fit_patients.tolist()),
            "inner_validation": set(inner_patients.tolist()),
            "scored": set(patients[scored_index].tolist()),
        }
        folds.append(
            {name: [r for r in records if r.patient_id in members] for name, members in groups.items()}
        )
    return folds


# --------------------------------------------------------------------------- feature cache


def cache_dir(feature_type: str) -> Path:
    return OUTPUT_DIR / "cache" / feature_type


def build_cache(records: list[AudioRecord], feature_type: str) -> None:
    """Extract every development recording once, with the same augmentation as training."""
    from featureExtraction import extract_manifest
    from preprocessing import PreprocessingConfig

    config = PreprocessingConfig(feature_type=feature_type)
    data = extract_manifest(records, augment=True, seed=SEED, config=config)
    target = cache_dir(feature_type)
    target.mkdir(parents=True, exist_ok=True)
    np.save(target / "X.npy", data.X)
    np.savez(
        target / "meta.npz",
        y=data.y,
        patient_ids=data.patient_ids,
        source_paths=data.source_paths,
        variants=data.variants,
        valid_lengths=data.valid_lengths,
    )
    (target / "config.json").write_text(json.dumps(config.to_dict(), indent=2), encoding="utf-8")
    print(f"[cache] {feature_type}: {data.X.shape} windows from {len(records)} recordings")


def load_cache(feature_type: str) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    target = cache_dir(feature_type)
    meta = dict(np.load(target / "meta.npz", allow_pickle=False))
    return np.load(target / "X.npy", mmap_mode="r"), meta


def window_mask(
    meta: dict[str, np.ndarray], records: list[AudioRecord], *, original_only: bool
) -> np.ndarray:
    """Windows that belong to ``records``; scoring and calibration use un-augmented audio only."""
    wanted = np.isin(meta["source_paths"], [str(record.path) for record in records])
    if original_only:
        wanted &= meta["variants"] == "original"
    return wanted


# --------------------------------------------------------------------------- OOF bookkeeping


def _write_oof(path: Path, rows: list[dict[str, object]], class_names: list[str]) -> None:
    fields = ["path", "patient_id", "source", "label", "fold", *[f"p_{c}" for c in class_names]]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def read_oof(path: Path) -> tuple[list[str], dict[str, np.ndarray]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    class_names = [name[2:] for name in rows[0] if name.startswith("p_")]
    rows.sort(key=lambda row: row["path"])
    table = {
        "path": np.asarray([r["path"] for r in rows]),
        "patient_id": np.asarray([int(r["patient_id"]) for r in rows]),
        "source": np.asarray([r["source"] for r in rows]),
        "y": np.asarray([class_names.index(r["label"]) for r in rows]),
        "probabilities": np.asarray([[float(r[f"p_{c}"]) for c in class_names] for r in rows]),
    }
    return class_names, table


def _oof_rows(fold, records, probabilities, class_names):
    by_path = {str(record.path): record for record in records}
    rows = []
    for path, probs in probabilities.items():
        record = by_path[path]
        rows.append({
            "path": path, "patient_id": record.patient_id, "source": record.source,
            "label": record.disease, "fold": fold,
            **{f"p_{c}": f"{p:.6f}" for c, p in zip(class_names, probs)},
        })
    return rows


def _recording_means(window_probabilities: np.ndarray, paths: np.ndarray) -> dict[str, np.ndarray]:
    return {path: window_probabilities[paths == path].mean(axis=0) for path in np.unique(paths)}


def _calibrate(inner: dict[str, np.ndarray], scored: dict[str, np.ndarray], labels, class_names):
    keys = sorted(inner)
    y = np.asarray([class_names.index(labels[k]) for k in keys])
    temperature = fit_temperature(y, np.stack([inner[k] for k in keys]))["temperature"]
    return {k: apply_temperature(v[None, :], temperature)[0] for k, v in scored.items()}, temperature


# --------------------------------------------------------------------------- deep variants


def run_deep(variant: str, records: list[AudioRecord]) -> None:
    import tensorflow as tf
    from tensorflow.keras.utils import set_random_seed

    from train import train_model

    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    settings = DEEP_VARIANTS[variant]
    X, meta = load_cache(str(settings["feature_type"]))
    class_names = sorted({record.disease for record in records})
    identity = np.eye(len(class_names), dtype=np.float32)
    labels = {str(record.path): record.disease for record in records}
    out = OUTPUT_DIR / variant
    rows, fold_log = [], []
    for fold, parts in enumerate(make_folds(records)):
        started = time.time()
        set_random_seed(SEED + fold)
        fit = window_mask(meta, parts["fit"], original_only=False)
        inner = window_mask(meta, parts["inner_validation"], original_only=True)
        scored = window_mask(meta, parts["scored"], original_only=True)
        targets = lambda mask: identity[[class_names.index(c) for c in meta["y"][mask]]]  # noqa: E731
        model, history, _, _ = train_model(
            np.asarray(X[fit]), targets(fit), np.asarray(X[inner]), targets(inner),
            output_dir=out / f"fold{fold}",
            healthy_class_index=class_names.index("healthy"),
            use_focal_loss=bool(settings["use_focal_loss"]),
            use_spec_augment=True,
            seed=SEED + fold,
            **TRAINING,
        )
        inner_probs = _recording_means(model.predict(np.asarray(X[inner]), verbose=0), meta["source_paths"][inner])
        scored_probs = _recording_means(model.predict(np.asarray(X[scored]), verbose=0), meta["source_paths"][scored])
        calibrated, temperature = _calibrate(inner_probs, scored_probs, labels, class_names)
        rows += _oof_rows(fold, records, calibrated, class_names)
        val_accuracy = history.history["val_accuracy"]
        fold_log.append({
            "fold": fold, "epochs_run": len(val_accuracy),
            "best_epoch": int(np.argmax(val_accuracy)) + 1,
            "best_inner_val_accuracy": float(np.max(val_accuracy)),
            "temperature": temperature, "minutes": round((time.time() - started) / 60, 1),
            "fit_windows": int(fit.sum()), "scored_recordings": len(scored_probs),
        })
        print(f"[{variant}] fold {fold}: {fold_log[-1]}", flush=True)
        _write_oof(OUTPUT_DIR / f"oof_{variant}.csv", rows, class_names)  # keep partial progress
    (OUTPUT_DIR / f"run_{variant}.json").write_text(
        json.dumps({"variant": variant, "settings": settings, "training": TRAINING, "folds": fold_log}, indent=2),
        encoding="utf-8",
    )


# --------------------------------------------------------------------------- shallow models


def _fit_logistic(x_fit, y_fit, x_inner, y_inner):
    """Standardized, class-balanced logistic regression; C chosen on the inner validation split."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    best = None
    for c in (0.001, 0.01, 0.1, 1.0):
        model = make_pipeline(
            StandardScaler(), LogisticRegression(C=c, class_weight="balanced", max_iter=5000)
        ).fit(x_fit, y_fit)
        loss = log_loss(y_inner, model.predict_proba(x_inner), labels=model.classes_)
        if best is None or loss < best[0]:
            best = (loss, c, model)
    return best[2], {"C": best[1]}


def _fit_boosting(x_fit, y_fit, x_inner, y_inner):
    from sklearn.ensemble import HistGradientBoostingClassifier

    model = HistGradientBoostingClassifier(
        learning_rate=0.05, max_iter=300, class_weight="balanced", random_state=SEED
    ).fit(x_fit, y_fit)
    return model, {}


def run_shallow(name: str, features: dict[str, np.ndarray], records: list[AudioRecord], fitter) -> None:
    """Fit a recording-level classifier per fold on ``features[path]`` and write calibrated OOF rows."""
    class_names = sorted({record.disease for record in records})
    labels = {str(record.path): record.disease for record in records}
    rows, fold_log = [], []
    for fold, parts in enumerate(make_folds(records)):
        def matrix(part):
            keys = [str(record.path) for record in parts[part]]
            return keys, np.stack([features[k] for k in keys]), np.asarray([labels[k] for k in keys])

        _, x_fit, y_fit = matrix("fit")
        inner_keys, x_inner, y_inner = matrix("inner_validation")
        scored_keys, x_scored, _ = matrix("scored")
        model, chosen = fitter(x_fit, y_fit, x_inner, y_inner)
        order = [list(model.classes_).index(c) for c in class_names]
        inner = dict(zip(inner_keys, model.predict_proba(x_inner)[:, order]))
        scored = dict(zip(scored_keys, model.predict_proba(x_scored)[:, order]))
        calibrated, temperature = _calibrate(inner, scored, labels, class_names)
        rows += _oof_rows(fold, records, calibrated, class_names)
        fold_log.append({"fold": fold, "temperature": temperature, **chosen})
    _write_oof(OUTPUT_DIR / f"oof_{name}.csv", rows, class_names)
    (OUTPUT_DIR / f"run_{name}.json").write_text(json.dumps({"variant": name, "folds": fold_log}, indent=2))
    print(f"[{name}] done: {fold_log}")


def summary_statistics(X: np.ndarray, meta: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Mean, std, 10th and 90th percentile of every feature over a recording's valid frames."""
    original = np.flatnonzero(meta["variants"] == "original")
    frames: dict[str, list[np.ndarray]] = {}
    for index in original:
        frames.setdefault(str(meta["source_paths"][index]), []).append(
            np.asarray(X[index][: int(meta["valid_lengths"][index])])
        )
    stats = {}
    for path, chunks in frames.items():
        values = np.concatenate(chunks)
        stats[path] = np.concatenate(
            [values.mean(0), values.std(0), np.percentile(values, 10, 0), np.percentile(values, 90, 0)]
        )
    return stats


def yamnet_embeddings(records: list[AudioRecord]) -> dict[str, np.ndarray]:
    """Mean and std of YAMNet's 1,024-d frame embeddings (16 kHz mono audio, no band-pass)."""
    target = OUTPUT_DIR / "cache" / "yamnet.npz"
    if target.is_file():
        cached = np.load(target, allow_pickle=False)
        return dict(zip(cached["paths"].tolist(), cached["embeddings"]))
    import librosa
    import tensorflow as tf

    model = tf.saved_model.load(str(YAMNET_DIR))
    paths, embeddings = [], []
    for index, record in enumerate(records):
        waveform, _ = librosa.load(str(record.path), sr=16_000, mono=True)
        _, frame_embeddings, _ = model(tf.constant(waveform, dtype=tf.float32))
        frame_embeddings = frame_embeddings.numpy()
        paths.append(str(record.path))
        embeddings.append(np.concatenate([frame_embeddings.mean(0), frame_embeddings.std(0)]))
        if index % 200 == 0:
            print(f"[yamnet] {index}/{len(records)}", flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    np.savez(target, paths=np.asarray(paths), embeddings=np.stack(embeddings))
    return dict(zip(paths, embeddings))


# --------------------------------------------------------------------------- comparison


def _patient_table(y, probabilities, patient_ids):
    patients = np.unique(patient_ids)
    targets = np.asarray([y[patient_ids == p][0] for p in patients])
    probs = np.stack([probabilities[patient_ids == p].mean(0) for p in patients])
    return targets, probs


def paired_patient_bootstrap(
    y: np.ndarray, probs_a: np.ndarray, probs_b: np.ndarray, patient_ids: np.ndarray,
    *, samples: int = 1_000, seed: int = SEED,
) -> dict[str, float]:
    """Δ = B − A in patient-level balanced accuracy and macro F1, resampling the same patients."""
    targets, a = _patient_table(y, probs_a, patient_ids)
    _, b = _patient_table(y, probs_b, patient_ids)
    pred_a, pred_b = a.argmax(1), b.argmax(1)
    rng = np.random.default_rng(seed)
    deltas = {"balanced_accuracy": [], "macro_f1": []}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for _ in range(samples):
            idx = rng.integers(0, len(targets), len(targets))
            t = targets[idx]
            deltas["balanced_accuracy"].append(
                balanced_accuracy_score(t, pred_b[idx]) - balanced_accuracy_score(t, pred_a[idx])
            )
            deltas["macro_f1"].append(
                f1_score(t, pred_b[idx], average="macro") - f1_score(t, pred_a[idx], average="macro")
            )
    result = {}
    for metric, values in deltas.items():
        values = np.asarray(values)
        result[metric] = {
            "lower": float(np.percentile(values, 2.5)),
            "upper": float(np.percentile(values, 97.5)),
            "p_improvement": float(np.mean(values > 0)),
        }
    return result


def _metrics(class_names, table):
    y, probs, patients = table["y"], table["probabilities"], table["patient_id"]
    return {
        "recordings": int(len(y)),
        "patients": int(len(np.unique(patients))),
        "recording_level": evaluate_model(y, probs, class_names),
        "patient_level": evaluate_patient_level(y, probs, patients, class_names),
        "by_source": evaluate_by_group(y, probs, patients, table["source"], class_names),
    }


def report() -> dict[str, object]:
    tables = {}
    for path in sorted(OUTPUT_DIR.glob("oof_*.csv")):
        class_names, tables[path.stem[4:]] = read_oof(path)
    reference = tables.get("D0")
    for name, table in tables.items():
        if reference is not None and not np.array_equal(table["path"], reference["path"]):
            raise ValueError(f"{name} does not cover the same recordings as D0")
    deep = [name for name in tables if name in DEEP_VARIANTS]
    if deep and "C2_yamnet_lr" in tables:
        best_deep = max(deep, key=lambda n: evaluate_patient_level(
            tables[n]["y"], tables[n]["probabilities"], tables[n]["patient_id"], class_names
        )["balanced_accuracy"])
        fused = dict(tables[best_deep])
        fused["probabilities"] = 0.5 * tables[best_deep]["probabilities"] + 0.5 * tables["C2_yamnet_lr"]["probabilities"]
        tables[f"F1_{best_deep}+yamnet"] = fused

    results = {}
    for name, table in tables.items():
        results[name] = _metrics(class_names, table)
        if reference is not None and name != "D0":
            results[name]["vs_D0"] = paired_patient_bootstrap(
                reference["y"], reference["probabilities"], table["probabilities"], reference["patient_id"]
            )
    out = OUTPUT_DIR / "results.json"
    out.write_text(json.dumps(finite_or_none(results), indent=2, allow_nan=False), encoding="utf-8")
    print("| Variant | Rec. acc | Patient acc | Patient bal. acc | Patient macro F1 | AUROC (pat.) | ECE (rec.) | Δ bal. acc vs D0 [95% CI], P(>0) |")
    print("|---|---:|---:|---:|---:|---:|---:|---|")
    for name, r in results.items():
        rec, pat = r["recording_level"], r["patient_level"]
        delta = r.get("vs_D0", {}).get("balanced_accuracy")
        delta_text = "reference" if name == "D0" else (
            f"[{delta['lower'] * 100:+.1f}, {delta['upper'] * 100:+.1f}], {delta['p_improvement']:.2f}" if delta else "–"
        )
        auroc = pat["macro_ovr_roc_auc"]
        print(
            f"| {name} | {rec['accuracy'] * 100:.1f}% | {pat['accuracy'] * 100:.1f}% | "
            f"{pat['balanced_accuracy'] * 100:.1f}% | {pat['macro_f1']:.3f} | "
            f"{'n/a' if auroc is None else f'{auroc:.3f}'} | {rec['expected_calibration_error']:.3f} | {delta_text} |"
        )
    return results


# --------------------------------------------------------------------------- CLI


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["folds", "cache", "deep", "classical", "yamnet", "report"])
    parser.add_argument("--feature-type", default="mfcc")
    parser.add_argument("--variant", choices=sorted(DEEP_VARIANTS))
    args = parser.parse_args()
    if args.command == "report":
        report()
        return
    records, test_patients = load_development_records()
    print(f"[dev] {len(records)} recordings, {len({r.patient_id for r in records})} patients; "
          f"{len(test_patients)} test patients locked out")
    if args.command == "folds":
        for fold, parts in enumerate(make_folds(records)):
            print(fold, {name: (len(rs), len({r.patient_id for r in rs}), dict(Counter(r.disease for r in rs)))
                         for name, rs in parts.items()})
    elif args.command == "cache":
        build_cache(records, args.feature_type)
    elif args.command == "deep":
        run_deep(args.variant, records)
    elif args.command == "classical":
        X, meta = load_cache("mfcc")
        stats = summary_statistics(X, meta)
        run_shallow("C1_mfccstats_lr", stats, records, _fit_logistic)
        run_shallow("C1_mfccstats_gbt", stats, records, _fit_boosting)
    elif args.command == "yamnet":
        run_shallow("C2_yamnet_lr", yamnet_embeddings(records), records, _fit_logistic)


if __name__ == "__main__":
    main()
