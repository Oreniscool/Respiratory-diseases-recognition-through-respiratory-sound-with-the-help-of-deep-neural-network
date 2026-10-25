"""Frozen AST embeddings (Audio Spectrogram Transformer, AudioSet-fine-tuned) for the development set.

A stronger general-audio model than YAMNet, so the probe, leave-one-source-out and CV results can be
checked against a current architecture. Model: ``MIT/ast-finetuned-audioset-10-10-0.4593``
(Hugging Face). It is used **frozen**: a fine-tune needs a CUDA build of PyTorch, and this
environment's PyTorch is the CPU build on purpose (TensorFlow owns CUDA).

Each recording is decoded like the other embedding members (16 kHz mono, no band-pass, via
``pretrained.load_yamnet_audio``) and cut into consecutive 10.24 s chunks (AST's input length; the
last chunk is padded by the feature extractor). The embedding is the mean ‖ std over chunks of AST's
768-d pooled output (1,536 values).

The result is written in the cache format of ``experiments/cv.py``
(``artifacts/experiments/cache/emb_ast.npz``), so ``python -m experiments.cv embed --extractor ast``
reuses it.

    python -m experiments.ast_embed
"""

from __future__ import annotations

import os
import time

import numpy as np

from experiments.cv import OUTPUT_DIR, load_development_records

MODEL = "MIT/ast-finetuned-audioset-10-10-0.4593"
SAMPLE_RATE = 16_000
CHUNK = int(10.24 * SAMPLE_RATE)


def ast_embedding(model, extractor, waveform: np.ndarray) -> np.ndarray:
    import torch

    chunks = [waveform[i:i + CHUNK] for i in range(0, max(len(waveform), 1), CHUNK)] or [waveform]
    chunks = [c for c in chunks if len(c) >= SAMPLE_RATE // 2] or chunks[:1]  # drop <0.5 s tails
    inputs = extractor(chunks, sampling_rate=SAMPLE_RATE, return_tensors="pt")
    with torch.no_grad():
        pooled = model(**inputs).pooler_output.numpy()
    return np.concatenate([pooled.mean(axis=0), pooled.std(axis=0)]).astype(np.float32)


def main() -> None:
    import torch
    from transformers import ASTFeatureExtractor, ASTModel

    from pretrained import load_yamnet_audio

    torch.set_num_threads(int(os.environ.get("RESPINET_TORCH_THREADS", "8")))
    extractor = ASTFeatureExtractor.from_pretrained(MODEL)
    model = ASTModel.from_pretrained(MODEL).eval()
    records, _ = load_development_records()
    target = OUTPUT_DIR / "cache" / "emb_ast.npz"
    cached: dict[str, np.ndarray] = {}
    if target.is_file():
        stored = np.load(target, allow_pickle=False)
        cached = dict(zip(stored["paths"].tolist(), stored["embeddings"]))
    missing = [r for r in records if str(r.path) not in cached]
    started = time.time()
    for index, record in enumerate(missing):
        cached[str(record.path)] = ast_embedding(model, extractor, load_yamnet_audio(record.path))
        if index % 100 == 0:
            print(f"[ast] {index}/{len(missing)} ({time.time() - started:.0f}s)", flush=True)
            np.savez(target, paths=np.asarray(list(cached)), embeddings=np.stack(list(cached.values())))
    np.savez(target, paths=np.asarray(list(cached)), embeddings=np.stack(list(cached.values())))
    print(f"[ast] {len(cached)} embeddings in {target}")


if __name__ == "__main__":
    main()
