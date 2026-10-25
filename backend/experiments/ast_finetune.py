"""Fine-tuned AST under the patient-grouped CV protocol (exploratory; D-28, claim C-29).

Frozen AST (``ast_embed.py``) was the best single member in cohort but carried the strongest source
signature. This asks whether *fine-tuning* the whole model changes that. The rules were fixed before
any result (``research/DECISION_LOG.md`` D-28): single seed (42 + fold), AdamW lr 1e-5, batch 8,
at most 6 epochs, early stopping (patience 2) on inner-validation recording accuracy, balanced class
weights, label smoothing 0.1, SpecAugment, temperature fitted on the inner validation split. Nothing
here changes the served model.

It runs in two environments, because CUDA PyTorch must not share a venv with TensorFlow's GPU stack:

    # main venv (TensorFlow, librosa, the repo's CV helpers)
    python -m experiments.ast_finetune prepare
    # GPU venv (``backend/venv-gpu``: torch+cu126, transformers; no TensorFlow)
    venv-gpu/bin/python -m experiments.ast_finetune train
    # main venv again
    python -m experiments.ast_finetune finish

``prepare`` caches the normalized 1024×128 fbank of every 10.24 s chunk (``cache/ast_inputs.npz``)
and the fold assignment of ``cv.make_folds`` (``cache/ast_folds.json``); ``train`` writes raw
recording probabilities (``ast_finetune_raw.json``, resumable per fold); ``finish`` calibrates and
writes ``oof_D_ast.csv`` / ``run_D_ast.json`` / ``ast_finetune_summary.json``.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

OUTPUT_DIR = Path("artifacts/experiments")
MODEL = "MIT/ast-finetuned-audioset-10-10-0.4593"
SAMPLE_RATE = 16_000
CHUNK = int(10.24 * SAMPLE_RATE)
INPUTS = OUTPUT_DIR / "cache" / "ast_inputs.npz"
FOLDS_JSON = OUTPUT_DIR / "cache" / "ast_folds.json"
RAW = OUTPUT_DIR / "ast_finetune_raw.json"
SETTINGS = {"lr": 1e-5, "weight_decay": 0.01, "batch_size": 8, "max_epochs": 6, "patience": 2,
            "label_smoothing": 0.1, "warmup_steps": 30, "freq_mask": 24, "time_mask": 96, "seed": 42,
            "precision": "bfloat16 autocast"}


# --------------------------------------------------------------------------- prepare (main venv)


def prepare() -> None:
    from transformers import ASTFeatureExtractor

    from experiments.cv import load_development_records, make_folds
    from pretrained import load_yamnet_audio

    records, _ = load_development_records()
    extractor = ASTFeatureExtractor.from_pretrained(MODEL)
    fbanks, owner = [], []
    started = time.time()
    for index, record in enumerate(records):
        wave = load_yamnet_audio(record.path)
        chunks = [wave[i:i + CHUNK] for i in range(0, max(len(wave), 1), CHUNK)] or [wave]
        chunks = [c for c in chunks if len(c) >= SAMPLE_RATE // 2] or chunks[:1]  # as in ast_embed.py
        features = extractor(chunks, sampling_rate=SAMPLE_RATE, return_tensors="np")["input_values"]
        fbanks.append(features.astype(np.float16))
        owner += [index] * len(chunks)
        if index % 100 == 0:
            print(f"[prepare] {index}/{len(records)} ({time.time() - started:.0f}s)", flush=True)
    paths = [str(r.path) for r in records]
    index_of = {p: i for i, p in enumerate(paths)}
    INPUTS.parent.mkdir(parents=True, exist_ok=True)
    np.savez(INPUTS, x=np.concatenate(fbanks), owner=np.asarray(owner), paths=np.asarray(paths),
             labels=np.asarray([r.disease for r in records]), patients=np.asarray([r.patient_id for r in records]))
    folds = [{part: [index_of[str(r.path)] for r in members] for part, members in fold.items()}
             for fold in make_folds(records)]
    FOLDS_JSON.write_text(json.dumps(folds), encoding="utf-8")
    print(f"[prepare] {len(paths)} recordings, {len(owner)} chunks; folds: "
          f"{[{k: len(v) for k, v in f.items()} for f in folds]}")


# --------------------------------------------------------------------------- train (GPU venv)


def spec_augment(x, freq_mask: int, time_mask: int, generator):
    """One frequency and one time mask per sample on a (B, 1024 time, 128 freq) batch (zero = mean)."""
    import torch

    batch, time_steps, freq_bins = x.shape
    for b in range(batch):
        width = int(torch.randint(0, freq_mask + 1, (1,), generator=generator))
        start = int(torch.randint(0, freq_bins - width + 1, (1,), generator=generator))
        x[b, :, start:start + width] = 0
        width = int(torch.randint(0, time_mask + 1, (1,), generator=generator))
        start = int(torch.randint(0, time_steps - width + 1, (1,), generator=generator))
        x[b, start:start + width, :] = 0
    return x


def recording_probabilities(model, x, owner, recordings, device, batch: int = 16) -> dict[int, np.ndarray]:
    """Mean softmax over each recording's chunks."""
    import torch

    chunk_ids = np.flatnonzero(np.isin(owner, recordings))
    model.eval()
    sums: dict[int, list] = {}
    with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
        for start in range(0, len(chunk_ids), batch):
            ids = chunk_ids[start:start + batch]
            logits = model(input_values=torch.from_numpy(x[ids].astype(np.float32)).to(device)).logits
            probs = torch.softmax(logits.float(), dim=-1).cpu().numpy()
            for i, p in zip(ids, probs):
                sums.setdefault(int(owner[i]), []).append(p)
    return {r: np.mean(v, axis=0) for r, v in sums.items()}


def train(smoke: bool = False) -> None:
    import torch
    from transformers import ASTForAudioClassification

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is not available in this environment; use backend/venv-gpu")
    device = torch.device("cuda")
    stored = np.load(INPUTS, allow_pickle=False)
    x, owner, labels = stored["x"], stored["owner"], stored["labels"]
    class_names = sorted(set(labels.tolist()))
    y_recording = np.asarray([class_names.index(c) for c in labels])
    folds = json.loads(FOLDS_JSON.read_text())
    raw = json.loads(RAW.read_text()) if RAW.is_file() and not smoke else {"settings": SETTINGS, "classes": class_names, "folds": {}}
    for fold, parts in enumerate(folds):
        if str(fold) in raw["folds"]:
            print(f"[train] fold {fold} already done", flush=True)
            continue
        started = time.time()
        torch.manual_seed(SETTINGS["seed"] + fold)
        generator = torch.Generator().manual_seed(SETTINGS["seed"] + fold)
        rng = np.random.default_rng(SETTINGS["seed"] + fold)
        model = ASTForAudioClassification.from_pretrained(
            MODEL, num_labels=len(class_names), ignore_mismatched_sizes=True).to(device)
        fit_chunks = np.flatnonzero(np.isin(owner, parts["fit"]))
        y_chunks = y_recording[owner[fit_chunks]]
        counts = np.bincount(y_chunks, minlength=len(class_names)).astype(np.float64)
        weights = torch.tensor(len(y_chunks) / (len(class_names) * np.maximum(counts, 1)), dtype=torch.float32, device=device)
        loss_fn = torch.nn.CrossEntropyLoss(weight=weights, label_smoothing=SETTINGS["label_smoothing"])
        optimizer = torch.optim.AdamW(model.parameters(), lr=SETTINGS["lr"], weight_decay=SETTINGS["weight_decay"])
        steps_per_epoch = int(np.ceil(len(fit_chunks) / SETTINGS["batch_size"]))
        schedule = torch.optim.lr_scheduler.LambdaLR(optimizer, lambda s: min(1.0, (s + 1) / SETTINGS["warmup_steps"]))
        best = {"score": (-1.0, 0.0), "state": None, "epoch": 0}
        history, step, stale = [], 0, 0
        for epoch in range(1, SETTINGS["max_epochs"] + 1):
            model.train()
            order = rng.permutation(len(fit_chunks))
            running = 0.0
            for start in range(0, len(order), SETTINGS["batch_size"]):
                ids = fit_chunks[order[start:start + SETTINGS["batch_size"]]]
                batch_x = torch.from_numpy(x[ids].astype(np.float32))
                batch_x = spec_augment(batch_x, SETTINGS["freq_mask"], SETTINGS["time_mask"], generator).to(device)
                batch_y = torch.from_numpy(y_recording[owner[ids]]).to(device)
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    logits = model(input_values=batch_x).logits
                loss = loss_fn(logits.float(), batch_y)
                optimizer.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                schedule.step()
                running += loss.item()
                step += 1
                if smoke and step >= 6:
                    print(f"[smoke] {step} steps, peak memory {torch.cuda.max_memory_allocated() / 2**30:.2f} GiB, "
                          f"loss {running / step:.3f}, {(time.time() - started):.0f}s", flush=True)
                    return
            inner = recording_probabilities(model, x, owner, parts["inner_validation"], device)
            truth = np.asarray([y_recording[r] for r in inner])
            probs = np.stack([inner[r] for r in inner])
            accuracy = float(np.mean(probs.argmax(1) == truth))
            nll = float(-np.mean(np.log(probs[np.arange(len(truth)), truth] + 1e-9)))
            history.append({"epoch": epoch, "train_loss": running / steps_per_epoch, "inner_accuracy": accuracy, "inner_nll": nll})
            print(f"[train] fold {fold} epoch {epoch}: loss {running / steps_per_epoch:.3f} inner acc {accuracy:.3f} "
                  f"nll {nll:.3f} ({time.time() - started:.0f}s)", flush=True)
            if (accuracy, -nll) > best["score"]:
                best.update(score=(accuracy, -nll), epoch=epoch, state={k: v.detach().cpu().clone() for k, v in model.state_dict().items()})
                stale = 0
            else:
                stale += 1
                if stale >= SETTINGS["patience"]:
                    break
        model.load_state_dict(best["state"])
        to_json = lambda d: {str(r): p.tolist() for r, p in d.items()}  # noqa: E731
        raw["folds"][str(fold)] = {
            "best_epoch": best["epoch"], "history": history, "minutes": round((time.time() - started) / 60, 1),
            "peak_memory_gib": round(torch.cuda.max_memory_allocated() / 2**30, 2),
            "inner": to_json(recording_probabilities(model, x, owner, parts["inner_validation"], device)),
            "scored": to_json(recording_probabilities(model, x, owner, parts["scored"], device)),
        }
        RAW.write_text(json.dumps(raw), encoding="utf-8")
        print(f"[train] fold {fold} done: best epoch {best['epoch']}, {raw['folds'][str(fold)]['minutes']} min", flush=True)
        del model, optimizer
        torch.cuda.empty_cache()


# --------------------------------------------------------------------------- finish (main venv)


def finish() -> None:
    from experiments.cv import (_calibrate, _oof_rows, _revision, _write_oof, paired_patient_bootstrap,
                                read_oof, shortcut_metrics, load_development_records)
    from evaluate import evaluate_patient_level

    records, _ = load_development_records()
    raw = json.loads(RAW.read_text())
    class_names = raw["classes"]
    by_index = {str(r.path): r for r in records}
    stored = np.load(INPUTS, allow_pickle=False)
    paths = stored["paths"].tolist()
    labels = {p: by_index[p].disease for p in paths}
    rows, log = [], []
    for fold in range(len(raw["folds"])):
        entry = raw["folds"][str(fold)]
        inner = {paths[int(r)]: np.asarray(p) for r, p in entry["inner"].items()}
        scored = {paths[int(r)]: np.asarray(p) for r, p in entry["scored"].items()}
        calibrated, temperature = _calibrate(inner, scored, labels, class_names)
        rows += _oof_rows(fold, records, calibrated, class_names)
        log.append({"fold": fold, "temperature": temperature, "best_epoch": entry["best_epoch"],
                    "minutes": entry["minutes"], "history": entry["history"]})
    _write_oof(OUTPUT_DIR / "oof_D_ast.csv", rows, class_names)
    (OUTPUT_DIR / "run_D_ast.json").write_text(json.dumps(
        {"variant": "D_ast", "source_revision": _revision(), "settings": raw["settings"], "folds": log}, indent=2), encoding="utf-8")

    tables = {}
    for name in ("D_ast", "E_ast", "D3_x3", "E_yamnet", "E_opera_ce", "E_hear"):
        _, tables[name] = read_oof(OUTPUT_DIR / f"oof_{name}.csv")
    adopted = dict(tables["D3_x3"])
    adopted["probabilities"] = np.mean([tables[m]["probabilities"] for m in ("D3_x3", "E_yamnet", "E_opera_ce", "E_hear")], axis=0)
    tables["adopted_fusion"] = adopted
    summary = {"rules": "research/DECISION_LOG.md D-28", "settings": raw["settings"], "variants": {}, "paired": {}}
    for name in ("D_ast", "E_ast", "adopted_fusion"):
        t = tables[name]
        patient = evaluate_patient_level(t["y"], t["probabilities"], t["patient_id"], class_names)
        summary["variants"][name] = {"patient_balanced_accuracy": patient["balanced_accuracy"],
                                     "patient_macro_f1": patient["macro_f1"], "shortcut": shortcut_metrics(class_names, t)}
    for a, b in (("E_ast", "D_ast"), ("adopted_fusion", "D_ast")):
        summary["paired"][f"{b}_minus_{a}"] = paired_patient_bootstrap(
            tables[a]["y"], tables[a]["probabilities"], tables[b]["probabilities"], tables[a]["patient_id"], samples=2_000)
    summary["folds"] = [{k: v for k, v in f.items() if k != "history"} for f in log]
    (OUTPUT_DIR / "ast_finetune_summary.json").write_text(json.dumps(summary, indent=2, default=float), encoding="utf-8")
    print(json.dumps(summary, indent=2, default=float))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("command", choices=["prepare", "train", "finish"])
    parser.add_argument("--smoke", action="store_true", help="train: 6 steps of fold 0, print peak memory, write nothing")
    args = parser.parse_args()
    {"prepare": prepare, "train": lambda: train(args.smoke), "finish": finish}[args.command]()


if __name__ == "__main__":
    main()
