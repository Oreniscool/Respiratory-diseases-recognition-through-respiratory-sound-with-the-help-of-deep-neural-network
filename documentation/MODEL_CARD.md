# RespiNet model card

## Status

Research prototype; not clinically validated and not intended for diagnosis,
screening, triage, treatment, or reassurance.

> **Round 2b (2026-10-23, current):** trained at `724c52c` on split v3 (21 KAUH patients added).
>
> - **Members:** a four-member late fusion (`late_fusion_members`, equal weights):
>   - a RespiNet-Attention v3 ensemble (seeds 42/43/44, 458,701 parameters each, cuDNN GRUs,
>     per-sample SpecAugment);
>   - logistic heads over frozen YAMNet (C = 0.01), OPERA-CE (C = 0.1) and HeAR (C = 0.01)
>     embeddings.
> - **Temperatures:** RespiNet 0.910, YAMNet 1.057, OPERA-CE 1.509, HeAR 1.097, fused 0.549.
>   Abstention below 0.663 confidence or above 0.506 normalized entropy.
> - **Test (49 patients):** **75.51% patient / 82.01% recording accuracy** (95% CI 63.3–87.8%),
>   balanced 74.87% / 73.47%, macro F1 0.739 / 0.704, AUROC 0.939 / 0.919, ECE 0.085 / 0.074.
> - **KAUH holdout (24 in-label patients of the same hospital; within-site):** 17/24, healthy 17/18,
>   **COPD 0/5**.
> - **Second external site (SPRSound, 718 labelled children, Shanghai; pre-registered D-32):** balanced
>   accuracy **0.19** over four classes (chance 0.25), accuracy 28% (always "pneumonia": 62%),
>   healthy-vs-diseased AUROC **0.47** [0.40, 0.55]. The model served before it: 0.26 and 0.55. The model
>   abstains on 96% of that site's recordings but cannot tell in-label from out-of-label patients. **It
>   does not transfer to other hospitals, devices or age groups.**
> - **Serving:** needs PyTorch (CPU) for OPERA-CE, and the artifact is about 1.3 GB (HeAR 1.2 GB).
>   On the CPU, 1 of 389 test recordings differs from the GPU evaluation (TF32).
>
> See [`ROUND2_EXPERIMENTS_REPORT.md`](ROUND2_EXPERIMENTS_REPORT.md) §9. The round-2 block below and
> the member descriptions further down describe the previous two-member model.

> **Round 2 (2026-10-22, later):** retrained at `b1698e9` on a corrected split (real KAUH patient IDs
> for Kaggle clips). Test (45 patients): **73.33% patient / 81.25% recording accuracy** (95% CI
> 60.0–86.7%), balanced 71.92% / 70.49%, macro F1 0.673 / 0.648, AUROC 0.905 / 0.893. Temperatures
> RespiNet 0.844, YAMNet 1.537, fused 0.559; abstention below 0.693 confidence or above 0.453
> normalized entropy. **External KAUH patients (new hospital and stethoscope): 0%**, with healthy and
> COPD predicted asthma. The model does not transfer to other recording conditions. The evaluation
> numbers further down are from the earlier split (`fusion-2026-10-22-oldsplit`) and are superseded.
> See [`ROUND2_EXPERIMENTS_REPORT.md`](ROUND2_EXPERIMENTS_REPORT.md).

- **Current model:** `backend/artifacts/latest/` (trained 2026-10-22, retrained at `b1698e9`), a late fusion
  of two members over 5 classes (asthma, bronchial, copd, healthy, pneumonia):
  - RespiNet-Attention v3 (458,701 parameters) over MFCC windows, and
  - YAMNet (Google, pretrained on AudioSet, frozen) embeddings → logistic-regression head
    (stored as a one-layer Keras model).
  The two calibrated outputs are averaged 50/50. Chosen by patient-grouped cross-validation; see
  [`ACCURACY_EXPERIMENTS_REPORT.md`](ACCURACY_EXPERIMENTS_REPORT.md).
- **Archived:** `backend/artifacts/v3-2026-10-22-leakfree/` (RespiNet alone, 75.51% patient-level
  accuracy) and `backend/artifacts/v3-2026-08-14/`. The latter's metrics (82.09%) were inflated by
  cross-dataset leakage and must not be cited.
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

Cohort (round 2b): 1,551 recordings / 244 patients, including 63 recordings of 21 KAUH patients (17 healthy, 4 COPD); Kaggle clips cut from KAUH carry real KAUH patient IDs. Patient-disjoint split: 146 / 49 / 49 patients. (Round 2: 1,488 / 223, split 133 / 45 / 45.)
See [`DATASET_CARD.md`](DATASET_CARD.md).

## Inputs and outputs

**RespiNet member:** mono audio resampled to 22.05 kHz, band-pass filtered (100–2,000 Hz),
converted into 40 MFCC, 40 delta, and 40 delta-delta features, normalized per recording. The model
evaluates overlapping 200-frame windows across the complete recording, and the window
probabilities are averaged and temperature-scaled (T = 0.713).

**YAMNet member:** the same recording decoded at 16 kHz mono without band-pass. The mean and
standard deviation of YAMNet's 1,024-d frame embeddings (2,048 values) go through a standardized,
class-balanced logistic regression, temperature-scaled with T = 0.999.

**Fusion:** the two calibrated distributions are averaged 50/50 and scaled with a final
temperature (T = 0.674). All temperatures are fit on validation recordings. The output is a
distribution over the ordered classes stored in the verified `model_metadata.json` contract,
which also pins the SHA-256 of both members.

The service abstains (`prediction: "uncertain"`) when the top calibrated score is below 0.648 or
the normalized entropy is above 0.519 (thresholds chosen for 80% validation coverage). This is a
research heuristic. Unsupported sounds, silence, noise, unseen devices, and out-of-distribution
populations may still receive a high score.

## Evaluation (previous split, 49 patients / 296 recordings — superseded, see the round-2 note at the top)

| Metric | Recording level | Patient level |
|---|---:|---:|
| Accuracy | 84.46% | 77.55% (95% CI 65.3–89.8%) |
| Balanced accuracy | 79.87% | 76.22% |
| Macro F1 | 0.782 | 0.763 |
| Macro one-vs-rest AUROC | 0.971 | 0.953 |
| Expected calibration error | 0.031 | 0.088 |

Patient-level sensitivity / specificity: asthma 91.7% / 94.6% (12 patients), bronchial 75.0% /
90.2% (8), copd 76.9% / 94.4% (13), healthy 62.5% / 95.1% (8), pneumonia 75.0% / 97.6% (8).

By source (recording / patient accuracy): ICBHI 82.97% / 65.38% (26 patients; reliable identities
but only one asthma and one pneumonia patient), Kaggle 86.84% / 91.30% (23 patient groups;
identities unverified, likely optimistic). Source: `backend/artifacts/latest/test_metrics.json`.

Against the previous RespiNet-only model on the same test split, the gain is large at recording
level (+7.1 accuracy, +8.5 balanced accuracy) but only one patient (+2.0) at patient level. The
evidence that the improvement is real is the cross-validation over 194 development patients
(+4.6 balanced accuracy, P = 0.97), described in `ACCURACY_EXPERIMENTS_REPORT.md`.

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
- No dedicated OOD detector. Explanation overlays show time-only gradient sensitivity of the
  RespiNet member only (not YAMNet), not causal or frequency-specific clinical evidence.
- YAMNet was pretrained on general sounds (AudioSet), not on stethoscope recordings.

## Artifact requirements

The server loads a model only when its hash, ordered classes, preprocessing settings,
evaluation, calibration, and dataset-audit files are present and verified at startup
(`artifact_contract.py`). Otherwise inference endpoints return 503. Each artifact also records
the split-manifest hash, seed, all hyperparameters, library versions, limitations, and the git
source revision.
