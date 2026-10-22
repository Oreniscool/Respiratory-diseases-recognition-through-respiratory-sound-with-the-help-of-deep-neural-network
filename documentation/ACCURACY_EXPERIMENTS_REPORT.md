# RespiNet accuracy experiments (2026-10-22)

Branch `accuracy-experiments` (stacked on `final-phase-improvements`). Question: which changes
make the leakage-free model more accurate, measured so that the answer can be trusted?

## 1. Method

**Starting point.** The current model (`backend/artifacts/latest/`, RespiNet-Attention v3 over
120-dim MFCC + Δ + Δ², focal loss) scores 75.51% patient-level test accuracy (95% CI 63.3–87.8%),
73.72% balanced accuracy and 0.737 macro F1 on 49 test patients.

**Why the test set is not used to compare variants.** With 49 test patients, a single patient
changes accuracy by 2 points, and the 95% interval is about ±12 points. Trying several variants
on the test set and keeping the best one would pick noise and make the reported number
optimistic, a milder form of the leakage that the final phase removed. The test split therefore
stays locked: it is used **once**, only for a configuration that the cross-validation rule adopts.

**Cross-validation on the development patients** (`backend/experiments/cv.py`):

- Development set: train + validation patients of the same seed-42 split `main.py` uses
  (194 patients, 1,192 recordings). The harness asserts that none of the 49 test patients is
  present.
- 3 stratified folds grouped by patient (`StratifiedGroupKFold`). In each fold, the training part
  is split again (80/20 by patient): the model is fit on about 103 patients, early-stopped and
  temperature-calibrated on about 26 inner-validation patients, and scored on the about 65
  held-out patients. The scored fold is never used for any choice.
- Every variant therefore produces one calibrated out-of-fold (OOF) prediction for each of the
  1,192 recordings, on identical folds. Variants are compared on the same patients with a paired
  patient bootstrap (1,000 resamples).
- Each fold model sees about 103 training patients instead of production's 145, so CV scores are
  lower than test scores of a production run. They measure **differences between variants**, not
  final performance.

**Pre-registered adoption rule** (fixed before any result was seen): a variant replaces the
current configuration only if its OOF patient-level balanced accuracy **and** macro F1 are both at
least 2 points better than D0, and the paired bootstrap gives P(Δ balanced accuracy > 0) ≥ 0.90.

## 2. Variants

| ID | Change from the current model | Rationale |
|---|---|---|
| D0 | none (current configuration, re-run under the harness) | reference |
| D1 | class-weighted cross-entropy + label smoothing 0.1 instead of focal loss | the focal-loss implementation squares smoothed targets and adds α = 0.25 on top of class weights |
| D2 | 64 log-mel bands (100–2,000 Hz) + Δ + Δ² instead of 40 MFCC | the DCT in MFCC discards spectral detail where crackles and wheezes live |
| C1 | per-recording mean/std/p10/p90 of the 120 MFCC features → logistic regression or gradient boosting | small-data reference; checks whether the deep model earns its complexity |
| C2 | YAMNet (pretrained on AudioSet) embeddings, mean + std pooled → logistic regression | transfer learning, the usual remedy for 1–2k recordings |
| F1 | average of the best deep variant's and C2's calibrated probabilities (fixed 50/50 weight) | the two representations may make different errors |

All deep variants use the current training settings: batch 64, up to 80 epochs, Adamax 3e-4 with
cosine decay, online SpecAugment, 5 waveform variants per training recording, early stopping on
validation accuracy (patience 18).

## 3. Cross-validation results

Out-of-fold predictions for all 1,192 development recordings / 194 patients (100 ICBHI, 94
Kaggle pseudo-patients). Source: `backend/artifacts/experiments/results.json` (gitignored, local).
Δ is the paired patient-bootstrap difference from D0 in patient-level balanced accuracy.

| Variant | Rec. acc | Patient acc | Patient bal. acc | Patient macro F1 | Patient AUROC | Rec. ECE | Δ bal. acc vs D0 [95% CI] | P(Δ > 0) |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| D0 current RespiNet | 74.5% | 73.2% | 70.0% | 0.698 | 0.915 | 0.118 | reference | – |
| D2 log-mel front-end | 76.5% | 66.0% | 61.6% | 0.608 | 0.907 | 0.102 | −8.5 [−13.9, −3.2] | 0.00 |
| C1 MFCC stats + logistic reg. | 73.0% | 67.5% | 63.5% | 0.626 | 0.905 | 0.061 | −6.6 [−14.6, +0.8] | 0.04 |
| C1 MFCC stats + gradient boosting | 79.6% | 67.0% | 60.6% | 0.564 | 0.885 | 0.042 | −9.4 [−15.8, −2.7] | 0.00 |
| C2 YAMNet + logistic reg. | 74.9% | 73.2% | 71.1% | 0.710 | 0.911 | 0.078 | +1.1 [−5.5, +8.2] | 0.65 |
| **F1 D0 + YAMNet fusion** | **81.0%** | **76.8%** | **74.7%** | **0.747** | **0.932** | 0.186¹ | **+4.6 [−0.2, +9.5]** | **0.97** |

¹ The CV fusion averages two separately calibrated members without re-calibrating the result, so
it is under-confident. The production artifact fits one more temperature on the fused validation
probabilities, which changes confidence but not the predicted class.

**Per class (patient-level sensitivity, OOF):**

| Class (patients) | D0 | C2 YAMNet | F1 fusion |
|---|---:|---:|---:|
| asthma (47) | 93.6% | 87.2% | 91.5% |
| bronchial (32) | 46.9% | 53.1% | 59.4% |
| copd (51) | 82.4% | 80.4% | 82.4% |
| healthy (31) | 51.6% | 74.2% | 61.3% |
| pneumonia (33) | 75.8% | 60.6% | 78.8% |

The fusion is never worse than D0 on any class and improves the two weakest ones (bronchial
+12.5, healthy +9.7 points). YAMNet alone is better on healthy and bronchial, while RespiNet is
better on asthma and pneumonia, which is why combining them helps.

**By source (patient level, OOF):** ICBHI (100 patients) D0 67.0% → fusion 69.0% accuracy
(recording level 75.1% → 82.2%); Kaggle (94 pseudo-patients) 79.8% → 85.1%. The gain is not
confined to the source with unverified patient identities.

**What did not help:**
- **Log-mel (D2)** improved recording-level accuracy (+2.0) but lost 8.5 points of patient-level
  balanced accuracy, mostly on healthy (51.6% → 29.0%) and bronchial. The band-limited mel
  spectrum is noisier per recording than the cepstrum. Not adopted.
- **Hand-crafted statistics (C1)** are 6–9 points of balanced accuracy below D0, so the deep
  sequence model does earn its complexity.
- **YAMNet alone (C2)** matches D0 (+1.1, P = 0.65). It is a different model, not a better one.

**Decision.** Only F1 meets the pre-registered rule: balanced accuracy +4.6 (≥ 2), macro F1
+4.9 (0.698 → 0.747, ≥ 2), P(Δ > 0) = 0.97 (≥ 0.90). The 95% interval of the balanced-accuracy
gain still touches zero (−0.2), so the improvement is probable rather than certain. F1 is
adopted as the served model (section 4).

**Not run.** D1 (cross-entropy instead of the focal loss) was dropped to stay within the ~4 h GPU
budget: each deep variant costs about 70 minutes for 3 folds. PyTorch foundation models (OPERA,
PANNs, BEATs) were excluded by choice, HeAR needs a gated licence, and mixup, per-sample
SpecAugment and seed ensembles were lower priority. These remain the next things to try.

## 4. Adopted model: test-set result (used once)

Command (same split, seed and RespiNet settings as the previous model):

```bash
python main.py --dataset-format folder --merge-icbhi --output-dir artifacts/latest \
  --epochs 80 --batch-size 64 --seed 42 --fusion yamnet
```

Trained at commit `30f58ca`. The RespiNet member stopped at epoch 62 (best epoch 44, validation
window accuracy 0.7461). The YAMNet head chose C = 0.01. Temperatures: RespiNet member 0.7133,
YAMNet member 0.9992, final fused 0.6744. Abstention: min confidence 0.648, max normalized
entropy 0.519 (80% validation coverage). The previous model is archived in
`backend/artifacts/v3-2026-10-22-leakfree/`.

**Locked test split, 49 patients / 296 recordings** (`backend/artifacts/latest/test_metrics.json`):

| Metric | Previous (RespiNet) recording | **Fusion recording** | Previous patient | **Fusion patient** |
|---|---:|---:|---:|---:|
| Accuracy | 77.36% | **84.46%** | 75.51% | **77.55%** |
| Balanced accuracy | 71.42% | **79.87%** | 73.72% | **76.22%** |
| Macro F1 | 0.690 | **0.782** | 0.737 | **0.763** |
| Cohen's κ | 0.672 | **0.768** | 0.692 | **0.716** |
| Macro OvR AUROC | 0.927 | **0.971** | 0.932 | **0.953** |
| Log loss | 0.638 | **0.403** | 0.749 | **0.611** |
| Brier score | 0.330 | **0.209** | 0.365 | **0.289** |
| Expected calibration error | 0.074 | **0.031** | 0.148 | **0.088** |

Patient-bootstrap 95% CI for patient-level accuracy: 65.3–89.8% (previously 63.3–87.8%).

**Per class, patient level (sensitivity / specificity):** asthma 91.7% / 94.6% (12 patients),
bronchial 75.0% / 90.2% (8), copd 76.9% / 94.4% (13), healthy 62.5% / 95.1% (8), pneumonia
75.0% / 97.6% (8). Compared with the previous model, two more bronchial patients and one fewer
healthy patient are classified correctly.

**By source:**

| Source | Previous rec. / patient acc. | Fusion rec. / patient acc. |
|---|---:|---:|
| ICBHI (182 recordings, 26 patients) | 75.82% / 65.38% | **82.97%** / 65.38% |
| Kaggle (114 recordings, 23 pseudo-patients) | 79.82% / 86.96% | **86.84%** / **91.30%** |

**How to read this.**
- The **recording-level** gain is large and consistent: +7.1 points accuracy, +8.5 balanced
  accuracy, log loss −37%, calibration error more than halved, and it holds on both sources.
- The **patient-level** gain is +2.0 points, i.e. **one patient out of 49**. On its own this test
  split cannot distinguish that from noise; the evidence that the improvement is real comes from
  the cross-validation (section 3: +4.6 balanced accuracy over 194 patients, P = 0.97), and the
  test result is consistent with it.
- ICBHI patient-level accuracy did not move (65.38%). That subset has 1 asthma and 1 pneumonia
  test patient, so it cannot show class-level changes reliably.
- The new RespiNet member is a fresh training run, so the comparison also includes ordinary
  run-to-run variation; the controlled comparison is the cross-validation.

## 5. What changed for users

- `/predict`, `/predict-sample` and `/explain` now return fused scores. The server loads YAMNet
  (from the artifact, hash-checked) and decodes each upload a second time at 16 kHz.
- Saliency maps in `/explain` still describe the RespiNet member only.
- Artifacts without a `fusion` section (all older ones) are served exactly as before.

## 6. Limitations

- One public cohort, one test split of 49 patients, no external validation. The 95% interval
  (65–90%) is wider than any difference reported here.
- Kaggle patient groups are unverified and part of Kaggle derives from KAUH, which was not checked
  for overlap; the Kaggle subset numbers are likely optimistic.
- YAMNet was trained on AudioSet (general sounds), not on stethoscope audio. It helps here, but
  nothing guarantees it on other devices or populations.
- The fusion weight (50/50) was fixed in advance, not tuned; tuning it on these data would risk
  overfitting.
