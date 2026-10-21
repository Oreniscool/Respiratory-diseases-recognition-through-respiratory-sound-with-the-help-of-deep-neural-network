# RespiNet model card

## Status

Research prototype; not clinically validated and not intended for diagnosis,
screening, triage, treatment, or reassurance.

- **Current model:** `backend/artifacts/latest/` (trained 2026-10-22), RespiNet-Attention v3,
  458,701 parameters, 5 classes: asthma, bronchial, copd, healthy, pneumonia.
- **Archived:** `backend/artifacts/v3-2026-08-14/`. Its reported metrics (82.09% patient-level
  accuracy) were inflated by cross-dataset leakage and must not be cited.
- **Legacy:** `backend/best_model.h5` (2021, 8 classes, leakage-prone split) has no verified
  contract and is never loaded or served.

## Intended use

- Educational exploration of respiratory-audio classification.
- Reproducible ML-method development on public respiratory-sound datasets.
- Local demonstrations using non-sensitive data.

## Out-of-scope use

- Real-patient clinical decisions.
- Ruling disease in or out.
- Emergency or remote triage.
- Autonomous treatment recommendations.
- Performance comparisons using archived or historical values.

## Training data

ICBHI 2017 (920 recordings, 126 patients, real patient IDs, authentic diagnoses mapped to 5
classes) merged with the Kaggle Asthma Detection Dataset V2 after removing:

- **631 Kaggle clips that are verbatim cuts of ICBHI recordings** (52% of Kaggle, including all of
  its COPD clips; evidence in `backend/data/kaggle_icbhi_overlap.csv`), and
- 12 byte-identical Kaggle duplicates.

Cohort: 1,488 recordings / 243 patient groups. Patient-disjoint split: 145 / 49 / 49 patients.
See [`DATASET_CARD.md`](DATASET_CARD.md).

## Inputs and outputs

Mono audio resampled to 22.05 kHz, band-pass filtered (100–2,000 Hz), converted into 40 MFCC,
40 delta, and 40 delta-delta features, normalized per recording. The model evaluates overlapping
200-frame windows across the complete recording. Window probabilities are averaged and then
temperature-scaled (T = 0.713, fit on validation recordings). The output is a distribution over
the ordered classes stored in the verified `model_metadata.json` contract.

The service abstains (`prediction: "uncertain"`) when the top calibrated score is below 0.573 or
the normalized entropy is above 0.583 (thresholds chosen for 80% validation coverage). This is a
research heuristic. Unsupported sounds, silence, noise, unseen devices, and out-of-distribution
populations may still receive a high score.

## Evaluation (held-out test split, 49 patients / 296 recordings)

| Metric | Recording level | Patient level |
|---|---:|---:|
| Accuracy | 77.36% | 75.51% (95% CI 63.3–87.8%) |
| Balanced accuracy | 71.42% | 73.72% |
| Macro F1 | 0.690 | 0.737 |
| Macro one-vs-rest AUROC | 0.927 | 0.932 |
| Expected calibration error | 0.074 | 0.148 |

Patient-level sensitivity / specificity: asthma 91.7% / 97.3% (12 patients), bronchial 50.0% /
97.6% (8), copd 76.9% / 97.2% (13), healthy 75.0% / 82.9% (8), pneumonia 75.0% / 95.1% (8).

By source (patient-level accuracy): ICBHI 65.4% (26 patients; reliable identities but only one
asthma and one pneumonia patient), Kaggle 87.0% (23 patient groups; identities unverified, likely
optimistic). Source: `backend/artifacts/latest/test_metrics.json`.

## Evaluation requirement

A publishable model must be trained and evaluated using patient-disjoint partitions created
before augmentation, with no audio shared across partitions. Report at least:

- Locked-test accuracy and balanced accuracy.
- Recording-level and patient-aggregated results, overall and per data source.
- Macro and per-class precision, recall/sensitivity, specificity, and F1.
- Confusion matrix and one-vs-rest AUROC.
- Log loss, Brier score, reliability plot, and calibration error.
- Patient-bootstrap confidence intervals.
- Results by device, recording location, relevant demographics, and audio quality when metadata
  permits (not yet done).

## Known limitations

- Small, public, technically heterogeneous datasets; a single held-out split; no external,
  prospective, or cross-device validation.
- Kaggle V2 has no subject identifiers. Its patient groups are inferred from filename prefixes
  that are known to be unreliable, and part of it derives from the KAUH database, which was not
  checked for overlap.
- Patient-level labels may not describe every recorded respiratory cycle. `bronchial` groups
  several distinct conditions.
- Inference-time denoising is disabled by default because it is not part of training.
- No dedicated OOD detector. Explanation overlays show time-only gradient sensitivity, not causal
  or frequency-specific clinical evidence.

## Artifact requirements

The server loads a model only when its hash, ordered classes, preprocessing settings,
evaluation, calibration, and dataset-audit files are present and verified at startup
(`artifact_contract.py`). Otherwise inference endpoints return 503. Each artifact also records
the split-manifest hash, seed, all hyperparameters, library versions, limitations, and the git
source revision.
