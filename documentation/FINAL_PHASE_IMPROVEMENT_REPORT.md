# RespiNet: Final-Phase Improvement Report

| Field | Value |
|---|---|
| Started | 2026-10-21 |
| Branch | `final-phase-improvements` (one commit per item) |
| Baseline | `master` @ `1b81cff`; model artifact of 2026-08-14 (archived as `backend/artifacts/v3-2026-08-14/`) |
| Selection rule | Only changes with a **material, verifiable** benefit: correctness, safety, validity of evidence, reproducibility. Every item has a test or a measurement |
| Companion | [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) (§14 discrepancy register, §15 defect list) |

## Why a final-phase pass was needed

The project's headline result (82.09% patient-level test accuracy) and its safety claims
("fail-closed serving", "validated uploads", "verified provenance") were audited against the code
and the data. The audit found:

1. **Measured data leakage.** The Kaggle Asthma V2 half of the cohort contains **12 groups of
   byte-identical audio files** stored under different `P`-numbers. **8 of those groups straddle
   the train/validation/test split**, e.g. test `P22Healthy88S.wav` is identical to train
   `P23Healthy14S.wav`. The `P`-number, used as the patient ID, repeats across all five class
   folders, so it is not a subject identifier.
2. **Safety claims that did not hold in code.** These were the legacy-model fallback, denoising
   on by default, permissive upload checks, and the API key in the URL.
3. **Provenance that could not catch bad labels.** The label-count check was self-referential,
   and the cluster script rewrote the provenance file.
4. **Documentation and UI numbers** that no artifact supports.

Principle for the retrain: **only data validity changes.** Architecture, loss, and
hyperparameters stay identical, so any change in metrics is attributable to leakage removal and
not to tuning. A lower number after this pass is a *more correct* number, not a regression.

## Summary

| # | Improvement | Benefit type | Status |
|---|---|---|---|
| 1 | Repo hygiene: plain `pytest` works, lint clean, GPU deps complete | Reproducibility / CI | ✅ done |
| 2 | Fail-closed serving (no legacy fallback) | Safety | ✅ done |
| 3 | Denoising off by default (no train/serve drift) | Correctness | ✅ done |
| 4 | Real upload signature validation | Security | ✅ done |
| 5 | API key no longer in URL or logs | Security | planned |
| 6 | Provenance that actually rejects wrong labels | Evidence validity | planned |
| 7 | Duplicate-free, fully audited dataset | Evidence validity (leakage) | planned |
| 8 | Complete run metadata + per-source metrics | Reproducibility / evidence | planned |
| 9 | Retrain on the corrected pipeline | Evidence validity | planned |
| 10 | Truthful UI and documentation | Integrity | planned |

---

## Items

<!-- Each item: Problem · Evidence · Change · Benefit · Verification · Status -->

### 1. Repo hygiene
- **Problem:** Plain `pytest`, which is what CI runs, failed with `ModuleNotFoundError:
  preprocessing` because nothing put `backend/` on `sys.path`. `ruff check .` reported 4 errors.
  So CI could not have been green. On GPU machines TensorFlow failed with `JIT compilation failed
  [Op:Sign]` because `ptxas`/`libdevice` were not among the dependencies.
- **Change:** `pythonpath = ["."]` in `backend/pyproject.toml`. Fixed `Augmentation.py`
  (`TYPE_CHECKING` import for the `tf.Tensor` hints), removed an unused import in `model.py`,
  made `wsgi.py` re-export explicitly (`__all__`). Added `nvidia-cuda-nvcc-cu12` to
  `requirements.txt`, and ignored `*/venv.old/`.
- **Benefit:** The CI commands now pass as written. GPU inference works from a fresh install.
- **Verification:** `ruff check .` → "All checks passed!". `pytest` → 21 passed.
- **Status:** ✅ done

### 2. Fail-closed serving
- **Problem:** The README and model card said the legacy model is "blocked". In code, a failed
  contract check set status `legacy`, swapped in `backend/best_model.h5` (the 2021 model trained on
  a leaky split), and returned 8 hardcoded ICBHI class names. Calibration and abstention were
  silently disabled, and `/predict` kept serving. The UI treated `legacy` as ready. `/health` also
  loaded the model as a side effect on every 5-second poll.
- **Change:** `server.py:load_model_contract` sets status `unverified` with no classes and no
  fallback. `load_model_once` refuses without a contract. `/predict-sample` checks the model before
  anything else, and `/summarize` returns 503 without a contract. `/health` reports state without
  loading. `wsgi.py` loads the model eagerly, as `python server.py` already did. In the UI,
  `AnalyzePage` and `EvidencePage` accept only `verified-metadata`, with an explicit alert.
- **Benefit:** No prediction can ever be served from an unverified artifact. Every served number
  is backed by a hashed model, an ordered class list, calibration, and an evaluation record.
- **Verification:** New `tests/test_server_fail_closed.py` (3 tests: no fallback, inference
  endpoints → 503, `/health` never loads the model). Live run with the real artifact:
  `verified-metadata`, `/predict` 200. With `RESPINET_MODEL_METADATA=/nonexistent.json`:
  `unverified`, `classes: []`, `/predict` 503, `/ready` 503, and no `best_model.h5` load. Backend:
  24 tests pass, ruff clean. Frontend: `tsc -b` clean.
- **Trade-off:** A fresh clone or container without `backend/artifacts/latest/` can no longer
  demo predictions until a model is trained. That is intended.
- **Status:** ✅ done

### 3. Denoising off by default
- **Problem:** The model was trained on band-passed, CMVN-normalized MFCCs without any spectral
  subtraction. The server nevertheless allowed optional inference-time denoising by default
  (`RESPINET_ALLOW_INFERENCE_DENOISING` defaulted to `"1"`), and the UI offered it as a checkbox. A
  user who ticked it got predictions on inputs whose distribution the model never saw. The README
  claimed it was disabled.
- **Change:** The default is now `"0"`. A disabled denoise request on `/predict`, `/explain` or
  `/predict-sample` returns 400 *before* any decoding. `/health` reports `denoise_allowed`, and the
  UI shows the checkbox (with a "not part of training preprocessing" warning) only when the server
  allows it, and only sends the flag then. `.env.example` documents the setting.
- **Benefit:** By default, every prediction uses exactly the preprocessing the model was trained and
  calibrated on.
- **Verification:** New `tests/test_server_denoise.py` (2 tests: 400 without touching the model;
  `/health` flag). 26 tests pass, ruff clean, `tsc -b` clean.
- **Status:** ✅ done (note: a local `.env` that explicitly sets `1` still opts in)

### 4. Real upload validation
- **Problem:** The README claimed uploads are signature-checked. In fact
  `audio_validation._looks_like_audio` returned `True` for **any** payload of 128 bytes or more,
  and `server._read_audio_upload` caught validation errors and accepted the file anyway, even with
  an unsupported extension. So arbitrary bytes reached `librosa`/`ffmpeg` decoding, which is the
  most complex and least trusted code path in the server.
- **Change:** Each allowed extension now needs its real container signature: WAV `RIFF…WAVE`,
  FLAC `fLaC`, Ogg `OggS`, WebM/Matroska EBML `1A45DFA3`, MP3 `ID3` or an MPEG frame sync, M4A
  `ftyp`. `.m4a` was added to the allowlist, since the UI already offered it. Validation errors now
  propagate as 400. The browser recorder's fallback file now keeps its real container extension
  (`.ogg` vs `.webm`), so Firefox recordings aren't rejected.
- **Benefit:** Non-audio and disguised payloads are rejected before any decoding, with no loss of
  legitimate inputs.
- **Verification:** `tests/test_audio_validation.py` grew from 2 to 18 test cases (every
  signature, random 4 KB payloads for every extension, container/extension mismatch, bad
  extension, path stripping, and `/predict` → 400 without touching the model). There were **0 false
  rejections across all 2,131 dataset recordings**, and ffmpeg-encoded WAV, FLAC, Ogg/Opus,
  WebM/Opus, MP3 (with and without ID3) and M4A/AAC were all accepted. Live: a real WAV/WebM → 200;
  random bytes and Ogg-renamed-as-`.wav` → 400. Side observation: a pure 440 Hz test tone is
  returned as `"uncertain"`, so abstention behaves sensibly on non-respiratory input.
- **Status:** ✅ done

### 5. API key handling
_planned_

### 6. Provenance integrity
_planned_

### 7. Duplicate-free, audited dataset
_planned_

### 8. Complete metadata + per-source metrics
_planned_

### 9. Retrain and results
_planned_

### 10. Truthful UI and documentation
_planned_

---

## Considered, not adopted

These may improve accuracy, but the benefit is not guaranteed and would confound the
before/after comparison. They are recommended as future work, each to be evaluated on validation
data only:

| Idea | Why not now |
|---|---|
| Rewrite `CategoricalFocalLoss` (it multiplies `y_true` twice) | Changes the optimization objective. Needs its own controlled experiment |
| Per-sample SpecAugment (currently one mask per batch) | Changes augmentation strength. Benefit is empirical |
| Seed ensembles / test-time augmentation | Likely helpful, but multiply cost and complicate the artifact contract |
| Pretrained audio encoders (AST, BEATs, wav2vec 2.0, CLAP) | Large change in scope. The right path for a follow-up project |
| More datasets (SPRSound, HF_Lung) | Need new label mappings and provenance work |
| Strict cross-class Kaggle grouping by `P`-number | `P`-numbers appear in every class, so grouping would create multi-label "patients". Mitigated instead by dedup + ICBHI-only metrics (items 7–8) |
