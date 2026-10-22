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

## 3. Results

_Pending: filled in from `backend/artifacts/experiments/results.json`._
