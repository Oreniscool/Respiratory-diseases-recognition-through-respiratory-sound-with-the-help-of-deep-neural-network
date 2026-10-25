"""Frozen embeddings of the SPRSound recordings the manifest marks ``ok`` (D-33).

Same extractors and settings as the development caches (``cv.embeddings``): every recording is decoded
to 16 kHz mono without a band-pass (``pretrained.load_yamnet_audio``); YAMNet, OPERA-CE and HeAR go
through ``pretrained.Extractor``; AST is the frozen ``MIT/ast-finetuned-audioset-10-10-0.4593`` (mean ‖ std
of the pooled output over 10.24 s chunks, as in ``ast_embed.py``). Output: ``cache/emb_sprsound_<name>.npz``.

    python -m experiments.sprsound_embed yamnet|opera_ce|hear      # main venv
    venv-gpu/bin/python -m experiments.sprsound_embed ast          # GPU venv (no TensorFlow)
"""

from __future__ import annotations

import csv
import os
import sys
import time
from pathlib import Path

import numpy as np

CACHE = Path("artifacts/experiments/cache")
SAMPLE_RATE = 16_000
CHUNK = int(10.24 * SAMPLE_RATE)
AST_MODEL = "MIT/ast-finetuned-audioset-10-10-0.4593"


def ok_paths() -> list[str]:
    with Path("data/sprsound_manifest.csv").open(newline="", encoding="utf-8") as handle:
        return [r["path"] for r in csv.DictReader(handle) if r["status"] == "ok"]


def ast_embedding(model, extractor, waveform: np.ndarray) -> np.ndarray:
    """Duplicate of ``ast_embed.ast_embedding``, kept here so the GPU venv never imports TensorFlow."""
    import torch

    chunks = [waveform[i:i + CHUNK] for i in range(0, max(len(waveform), 1), CHUNK)] or [waveform]
    chunks = [c for c in chunks if len(c) >= SAMPLE_RATE // 2] or chunks[:1]
    inputs = extractor(chunks, sampling_rate=SAMPLE_RATE, return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    with torch.no_grad():
        pooled = model(**inputs).pooler_output.float().cpu().numpy()
    return np.concatenate([pooled.mean(axis=0), pooled.std(axis=0)]).astype(np.float32)


def main() -> None:
    name = sys.argv[1]
    from pretrained import load_yamnet_audio

    paths = ok_paths()
    if name == "ast":
        import torch
        from transformers import ASTFeatureExtractor, ASTModel

        extractor = ASTFeatureExtractor.from_pretrained(AST_MODEL)
        model = ASTModel.from_pretrained(AST_MODEL).eval().to("cuda" if torch.cuda.is_available() else "cpu")
        embed = lambda wave: ast_embedding(model, extractor, wave)  # noqa: E731
    else:
        from pretrained import EXTRACTORS, Extractor

        if name.startswith("opera"):
            import torch

            torch.set_num_threads(int(os.environ.get("RESPINET_TORCH_THREADS", "8")))
        embed = Extractor(name, EXTRACTORS[name]).embed_waveform
    target = CACHE / f"emb_sprsound_{name}.npz"
    done = {}
    if target.is_file():
        stored = np.load(target, allow_pickle=False)
        done = dict(zip(stored["paths"].tolist(), stored["embeddings"]))
    started = time.time()
    for index, path in enumerate([p for p in paths if p not in done]):
        done[path] = embed(load_yamnet_audio(path))
        if index % 250 == 0:
            print(f"[{name}] {index} ({time.time() - started:.0f}s)", flush=True)
            np.savez(target, paths=np.asarray(list(done)), embeddings=np.stack(list(done.values())))
    np.savez(target, paths=np.asarray(list(done)), embeddings=np.stack(list(done.values())))
    print(f"[{name}] {len(done)} embeddings -> {target}")


if __name__ == "__main__":
    main()
