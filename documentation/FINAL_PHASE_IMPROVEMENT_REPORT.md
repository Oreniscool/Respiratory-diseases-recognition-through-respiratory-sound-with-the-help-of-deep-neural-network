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
| 1 | Repo hygiene: plain `pytest` works, lint clean, GPU deps complete | Reproducibility / CI | planned |
| 2 | Fail-closed serving (no legacy fallback) | Safety | planned |
| 3 | Denoising off by default (no train/serve drift) | Correctness | planned |
| 4 | Real upload signature validation | Security | planned |
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
_planned_

### 2. Fail-closed serving
_planned_

### 3. Denoising off by default
_planned_

### 4. Real upload validation
_planned_

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
