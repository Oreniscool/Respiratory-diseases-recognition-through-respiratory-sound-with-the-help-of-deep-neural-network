# Evaluation protocol — v1 (frozen 2026-10-23)

This protocol governs every model comparison reported in the paper. Changing it requires a new
version number, a dated entry in `DECISION_LOG.md`, and re-running any comparison that depends on
the changed part. Results obtained under an earlier protocol stay in the ledger, labeled with it.

## 1. Data and splits

- **Cohort definition:** `backend/main.py build_cohort` with `--dataset-format folder --merge-icbhi
  --merge-kauh` (ICBHI 920 recordings with authentic labels; Kaggle V2 after dropping 631 ICBHI
  copies and 12 byte duplicates, with 316 clips assigned real KAUH patient IDs; 21 KAUH patients).
  See `DATASET_AUDIT.md`.
- **Split v3** (frozen copy `research/splits/v3/split_manifest.csv`, SHA-256
  `8bdc97ffcc1ddd9631e02969adebca9ca4ed136663b61e2badfd0b80c0dbe97c`): seed 42, stratified by patient
  label, patients disjoint across train / validation / test (146 / 49 / 49 patients; 837 / 325 / 389
  recordings). `split_by_patient` raises on any patient overlap, and `assert_three_way_class_support` requires
  ≥ 3 patients per class in the cohort, so each class can appear in all three partitions.
- Earlier splits (v0–v2, also frozen in `research/splits/`) are historical. Their results stay in the
  ledger and are compared only with results on the same split.

## 2. What may touch what

| Data | Used for | Never used for |
|---|---|---|
| Development patients (train + validation of v3) | 3-fold patient-grouped CV (`backend/experiments/cv.py`, StratifiedGroupKFold seed 42); inside each fold an inner 20% patient split for early stopping and temperature fitting | — |
| Locked test patients (v3) | **once** per adopted configuration, after calibration | model choice, tuning, thresholds |
| KAUH holdout (`data/kauh_external_holdout_manifest.csv`, 51 patients) | **once** per adopted model and once for the model served before it, through the served prediction path (`experiments/external.py`) | choosing between candidates; training |

**Diagnostic analyses** of a fixed, already-evaluated model (e.g. X2: re-encoding inputs) may reuse that model's
test and validation recordings, because nothing in them feeds back into model choice or tuning. Each such use is
logged in `DECISION_LOG.md`.

Augmentation (waveform variants, SpecAugment, mixup) is applied to training data only. Duplicates
and cross-dataset copies are removed before splitting.

## 3. Metrics

- **Primary:** patient-level balanced accuracy (macro recall), computed on patient-averaged
  calibrated probabilities. On the external set: patient-level accuracy and balanced accuracy over
  the in-label classes present.
- **Secondary:** patient-level macro F1, accuracy, macro one-vs-rest AUROC (undefined for subsets
  missing a class); recording-level accuracy, balanced accuracy and expected calibration error
  (10 bins); per-class sensitivity and specificity; per-source metrics.
- **Shortcut-robustness metrics (CV):** off-device COPD sensitivity (COPD recordings not made on the
  AKG C417L), Meditron accuracy (the one device shared by healthy, bronchial and COPD), accuracy on
  in-cohort KAUH recordings.
- **Uncertainty:** abstention rate (thresholds fitted on validation for 80% coverage) on in-label and
  out-of-label external recordings.

## 4. Statistics

- 95% confidence intervals: patient-level percentile bootstrap, 1,000 resamples
  (`evaluate.bootstrap_patient_confidence_intervals`).
- Paired comparisons: paired patient bootstrap of Δ balanced accuracy and Δ macro F1, 1,000
  resamples, reporting the 95% interval and P(Δ > 0) (`experiments.cv.paired_patient_bootstrap`).
- Training variance: where a claim depends on a deep model's training run, report at least 3 seeds
  (a seed ensemble or repeated runs), or state that a single seed was used.
- Multiple comparisons: candidate lists and adoption rules are written down before results
  (`DECISION_LOG.md`). The number of candidates compared is reported, with no correction claimed
  beyond that. A candidate that wins only on an unregistered metric is not adopted.

## 5. Adoption rule (model comparisons)

A candidate replaces the reference only if, on out-of-fold development predictions:
- patient balanced accuracy **and** macro F1 are both ≥ +2 points over the reference;
- the paired bootstrap gives P(Δ balanced accuracy > 0) ≥ 0.90;
- no shortcut-robustness metric is more than 5 points worse than the reference's.

Otherwise the reference is kept.

## 6. Reporting rules

- Every reported number is traceable to an artifact file (`research/tools/collect_evidence.py`).
- Failed, superseded and negative runs stay in the ledger.
- In-cohort results are never presented as real-world or clinical performance.
- The original paper's figures are quoted as reported, labeled with its protocol, and not compared
  directly with ours except through the leakage ladder (X1), which reproduces that protocol.
