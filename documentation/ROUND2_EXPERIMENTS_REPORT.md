# RespiNet round 2: validity first, then accuracy (2026-10-22)

Branch `round2-validity-accuracy` (stacked on `accuracy-experiments`). Goal: every change that
improves the results, where "improves" means more accurate **and** more likely to hold outside this
cohort. The previous round's report is [`ACCURACY_EXPERIMENTS_REPORT.md`](ACCURACY_EXPERIMENTS_REPORT.md).

## 1. Why validity came first

A read-only look at the merged cohort showed that the disease label is tangled up with where and
how a recording was made:

| Class | Origin of its recordings |
|---|---|
| copd | 100% ICBHI; 646 of 793 on the AKG C417L stethoscope, which records no other class |
| healthy, bronchial (ICBHI part) | all on the Meditron stethoscope |
| asthma | 288 of 289 from Kaggle |

A model can score well by recognizing the dataset or the stethoscope rather than the disease.
Section 3 measures how easy that is.

## 2. Data fixes

### 2.1 Kaggle patient identities from KAUH

The KAUH lung-sound dataset (Fraiwan et al. 2021, Mendeley Data doi:10.17632/jwyy9np4gv.3,
CC BY 4.0; 112 patients, 336 recordings at 4 kHz, each recorded with three stethoscope filters) was
downloaded and checked against Kaggle Asthma V2 with the same cross-correlation tool that found the
ICBHI copies:

- **316 Kaggle clips are cut from KAUH recordings of 40 patients**: asthma 262 of 288, pneumonia
  39, bronchial 15. Copies score ≥ 0.772 normalized cross-correlation and everything else ≤ 0.573.
  Every clip's Kaggle class agrees with the KAUH diagnosis.
- **57 of the 64 Kaggle filename groups (the "P54" prefixes) that match KAUH contain clips of
  several KAUH patients.** The filename pseudo-IDs therefore split real patients across training
  and test. In round 1, a test "patient" could share a real person with training patients, mostly
  in the asthma class.
- These clips now carry the real KAUH patient ID. The pipeline refuses to run without complete
  evidence or if a label disagrees (`main.assign_kauh_patient_ids`; evidence
  `backend/data/kaggle_kauh_overlap.csv`).
- KAUH vs ICBHI: 0 of 336 KAUH recordings match ICBHI.

Corrected cohort: 1,488 recordings, **223 patients** (was 243 because filename groups over-split
real patients). New seed-42 split: 133 / 45 / 45 patients (868 / 284 / 336 recordings). **This is a
new locked test set; round-1 test numbers are not comparable with it.**

### 2.2 External test set

The 72 KAUH patients who contributed nothing to Kaggle (216 recordings) form an external test set:
35 healthy, 9 COPD, 1 bronchial, plus 27 patients with diagnoses outside the five labels (heart
failure, lung fibrosis, pleural effusion, combined diagnoses) that test abstention. Every KAUH
asthma and pneumonia patient is already in Kaggle, so the external set tests **healthy vs COPD on
a different stethoscope (Littmann 3200), at a different hospital**, which is exactly the case the
shortcut would break. It is used once, at the end, for the current model and the adopted
candidate, and never to choose between candidates.

## 3. How big is the shortcut?

Patient-grouped 3-fold logistic-regression probes on the 178 development patients (balanced
accuracy; `experiments/shortcut.py`):

| Representation | Predicts the dataset | Predicts the ICBHI device | Predicts the disease |
|---|---:|---:|---:|
| MFCC statistics (RespiNet's input) | 89.6% | 76.9% | 59.0% |
| YAMNet embedding | 91.4% | 82.2% | 71.5% |
| YAMNet on 100–2,000 Hz audio | 94.6% | 82.2% | 67.0% |
| OPERA-CE embedding | 98.9% | 88.5% | 66.6% |
| OPERA-CT embedding | 94.3% | 87.6% | 69.1% |

In every representation, identifying the dataset or the stethoscope is far easier than
identifying the disease. Band-limiting does not remove the cue. Every model is therefore measured
with two metrics a device-recognizer cannot pass:

- **off-device COPD sensitivity:** 129 COPD recordings not made on the AKG C417L;
- **Meditron accuracy:** 103 recordings from the one device shared by healthy, bronchial and COPD.

## 4. Method for the accuracy experiments

As in round 1: 3-fold patient-grouped cross-validation on the development patients (train +
validation of the new split; test patients asserted absent). An inner 20% patient split is used for
early stopping and temperature, and calibrated out-of-fold predictions cover all 1,152 development
recordings. Comparisons use a paired patient bootstrap.

The reference **R** is the current served configuration (RespiNet D0 + YAMNet logistic head,
50/50) re-run on the new folds.

**Pre-registered rules:**
1. An accuracy candidate is adopted if patient balanced accuracy **and** macro F1 are ≥ +2 points
   over R, P(Δ > 0) ≥ 0.90, and off-device COPD sensitivity is not more than 5 points worse.
2. A shortcut-fix candidate is adopted if balanced accuracy is within −1 point of R and off-device
   COPD sensitivity is ≥ +5 points better.
3. The final model is evaluated once on the locked test split and once on KAUH. It is adopted only
   if its KAUH balanced accuracy is not more than 5 points below the current model's.

## 5. Cross-validation results

Out-of-fold, 1,152 development recordings / 178 patients, patient level unless marked. Δ is the
paired patient-bootstrap difference from R (`backend/artifacts/experiments/results.json`).

| Variant | Rec. acc | Patient acc | Bal. acc | Macro F1 | Off-device COPD sens. | Meditron acc. | Δ bal. acc vs R [95% CI] | P(Δ>0) |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| D0 RespiNet (current) | 68.8% | 66.9% | 65.8% | 0.653 | 57.4% | 61.2% | | |
| **D3** RespiNet, cuDNN GRUs + per-sample SpecAugment | 72.3% | 68.0% | 66.4% | 0.664 | **69.0%** | 59.2% | | |
| YAMNet + logistic | 77.0% | 74.7% | 73.3% | 0.736 | 66.7% | 62.1% | | |
| YAMNet (100–2,000 Hz) + logistic | 75.5% | 71.3% | 69.0% | 0.692 | 63.6% | 45.6% | | |
| OPERA-CE + logistic | 74.4% | 71.3% | 69.4% | 0.692 | 56.6% | 48.5% | | |
| OPERA-CT + logistic | 68.8% | 63.5% | 62.7% | 0.621 | 26.4% | 44.7% | | |
| **R** = D0 + YAMNet (served configuration) | 79.3% | 77.5% | 76.7% | 0.769 | 72.1% | 66.0% | reference | |
| D3 + YAMNet | 80.9% | 79.2% | 78.1% | 0.786 | 72.9% | 68.0% | +1.4 [−1.8, +4.7] | 0.81 |
| D0 + YAMNet + OPERA-CE | 82.7% | 80.3% | 78.9% | 0.791 | 75.2% | 68.0% | +2.2 [−3.3, +7.8] | 0.76 |
| D3 + YAMNet + OPERA-CE | 83.9% | 78.7% | 77.0% | 0.775 | 79.8% | 67.0% | +0.3 [−4.7, +5.4] | 0.56 |
| D0 + YAMNet (band-limited) | 76.7% | 75.8% | 74.3% | 0.745 | 68.2% | 58.3% | −2.4 | 0.15 |
| D0 + OPERA-CE | 78.0% | 75.8% | 74.0% | 0.740 | 63.6% | 67.0% | −2.7 | 0.24 |
| Learned stacking of D3 + YAMNet (nested) | 75.4% | 72.5% | 71.0% | 0.712 | 62.8% | 60.2% | −5.7 | 0.02 |

**What the table says:**
- **D3** (tanh GRUs that run on cuDNN, plus per-sample SpecAugment that no longer turns masked
  frames into "padding") is the better RespiNet. It is about 2× faster to train and raises
  off-device COPD sensitivity by 11.6 points over D0, with similar balanced accuracy (+0.6).
- **The best combinations improve on R but not past the pre-registered bar:** D3 + YAMNet is +1.4
  balanced accuracy and +1.7 macro F1 with P = 0.81; adding OPERA-CE to D0 + YAMNet is +2.2 / +2.2
  with P = 0.76. The rule needs ≥ +2 on both and P ≥ 0.90.
- **Band-limiting YAMNet does not remove the shortcut** (off-device COPD is worse) and costs accuracy.
- **OPERA**, the respiratory foundation model, used frozen, is weaker than general-purpose YAMNet
  here (OPERA-CT clearly so). OPERA-CE adds a little as a third member.
- **Learned stacking overfits** at this data size; equal weights are better.
- **Not finished (stopped for time):** the 3-seed D3 ensemble completed 1 of 3 folds; device
  augmentation, the crackle/wheeze multi-task head, cross-entropy loss and mixup were queued but
  not run. HeAR was not run (it needs the user's Hugging Face login).

**Decision under the pre-registered rules:** no candidate qualifies, so the served configuration
stays R. It is **retrained on the corrected split** (section 2), because the previous model's test
set shared real KAUH patients with its training set.

## 6. External validation on KAUH: the shortcut, confirmed

The model served before round 2 (RespiNet + YAMNet, trained on the old split, archived in
`backend/artifacts/fusion-2026-10-22-oldsplit/`) was run on the 72 external KAUH patients through the
served prediction path (`experiments/external.py`, results in
`backend/artifacts/experiments/external/previous_served_model.json`):

| External KAUH patients | Result |
|---|---|
| 35 healthy | 34 predicted **asthma**, 1 pneumonia |
| 9 COPD | all 9 predicted **asthma** |
| 1 bronchial | predicted **asthma** |
| Patient-level accuracy (45 in-label patients) | **0%** |
| Out-of-label recordings (heart failure, fibrosis, effusion; 81) | 42% abstained; otherwise 76 "asthma" |

The model labels essentially everything recorded at KAUH (Littmann 3200 stethoscope, 4 kHz) as
asthma. The reason is the composition of the training data: 262 of the 316 training clips that come
from KAUH are asthma, and almost no other training audio was recorded that way. The model learned
"sounds like a KAUH recording → asthma" rather than anything about the lungs. Inside the cohort this
is invisible, because KAUH-derived test clips really are asthma. Only an external set with healthy
and COPD patients from the same hospital exposes it.

**Consequence.** The in-cohort accuracy figures of every RespiNet model so far, round 1 included,
describe how well the model separates *these datasets*, not how well it would recognize disease in
a new clinic or with a new stethoscope. On new recording conditions the current models should be
assumed not to work.

## 7. Served model after round 2: test result (used once)

R (RespiNet D0 + YAMNet, `main.py --fusion yamnet`) was retrained on the corrected split at commit
`b1698e9`. RespiNet ran all 80 epochs (best epoch 67, validation window accuracy 0.7015).
Temperatures: RespiNet 0.844, YAMNet 1.537, fused 0.559. Abstention: min confidence 0.693, max
normalized entropy 0.453. The previous model is archived in
`backend/artifacts/fusion-2026-10-22-oldsplit/`.

**Locked test split, 45 patients / 336 recordings** (`backend/artifacts/latest/test_metrics.json`):

| Metric | Recording level | Patient level |
|---|---:|---:|
| Accuracy | 81.25% | **73.33%** (95% CI 60.0–86.7%) |
| Balanced accuracy | 70.49% | 71.92% |
| Macro F1 | 0.648 | 0.673 |
| Macro OvR AUROC | 0.893 | 0.905 |
| Expected calibration error | 0.046 | 0.196 |

Patient-level sensitivity / specificity: asthma 100% / 91.9% (8 patients), bronchial 12.5% / 97.3%
(8), copd 84.6% / 93.8% (13), healthy 100% / 86.5% (8), pneumonia 62.5% / 97.3% (8). By source
(recording / patient accuracy): ICBHI 85.92% / 70.37% (27 patients), Kaggle 73.17% / 77.78% (18).

These numbers are lower than round 1's 77.55% patient accuracy, which was measured on a split where
real KAUH patients sat on both sides. The two test sets differ, so the numbers are not directly
comparable, but the corrected one is the honest estimate.

**External KAUH (pre-registered gate):** 0% patient-level accuracy again: 32 of 35 healthy and all 9
COPD patients predicted asthma (`backend/artifacts/experiments/external/served_round2.json`). The gate
(not more than 5 points below the previous model's 0%) is met trivially. **The served model remains
unusable outside this cohort's recording conditions**; section 8 says what would fix that.

Server checks: `/ready` is ready with the verified contract, a test-split recording predicts end to end,
and a pure tone is refused with 422 by the lung-sound gate.

## 8. What to do next (overnight run)

In order of expected value:

1. **Break the KAUH confound, which is the only fix that addresses the 0% external result.** Today
   every KAUH-recorded training clip is asthma, pneumonia or bronchial, so "KAUH-sounding" means
   "asthma". Move about half of the 45 in-label external KAUH patients (healthy and COPD) into the
   training cohort, keep the other half as the external test, and re-run. This needs a decision,
   because it reduces the external set, which the user had reserved for testing only. Device
   augmentation (D3_devaug) can be tried first, but simulating a filter cannot teach the model that
   healthy people are also recorded with a Littmann 3200.
2. **Finish the queued CV variants on D3:** the 3-seed ensemble (`D3_x3`), device augmentation
   (`D3_devaug`), the crackle/wheeze multi-task head (`D3_mtl`), cross-entropy (`D3_ce`), and mixup
   (`D3_mixup`). Then the D3 + YAMNet (+ OPERA-CE) fusions with those members. About 3.5 h of GPU
   (`backend/experiments/cv.py`; the queue runner is in the session notes).
3. **HeAR embeddings**, once the Hugging Face terms are accepted and `backend/venv/bin/hf auth login`
   has been run.
4. Adopt whatever passes the rule, retrain with `main.py --fusion members --fusion-members … --cudnn-gru
   --spec-augment-mode sample [--ensemble-seeds 3]`, and run `experiments/external.py` once on it.

## 9. Round 2b: breaking the KAUH confound (decided 2026-10-22, 22:40, before any 2b result)

**Decision (user):** split the 45 in-label external KAUH patients about 50/50.
`kauh.py --split-for-training` (seeded shuffle per class) moved **21 patients (17 healthy, 4 COPD;
63 recordings)** into the cohort as source `kauh` (`data/kauh_cohort_manifest.csv`,
`main.py --merge-kauh`). **51 patients stay external** (`data/kauh_external_holdout_manifest.csv`:
18 healthy, 5 COPD, 1 bronchial, and the 27 out-of-label patients). The new cohort has 1,551
recordings / 244 patients, split 146 / 49 / 49 with seed 42. That is again a new locked test set,
and `experiments/external.py` refuses to evaluate any patient that appears in the artifact's own
split.

**Pre-registered plan and rules (fixed before any round-2b result):**
- Reference **R′** = D0 + YAMNet re-run on the new folds. Deep candidates: D3, D3_x3 (3 seeds),
  D3_devaug, D3_mtl, D3_ce, D3_mixup. Embedding members: YAMNet, OPERA-CE, and HeAR if the login
  happens. Fusions (equal weights): the best D3-family member (highest OOF patient balanced accuracy)
  with YAMNet, plus OPERA-CE and/or HeAR.
- **Adopt** a configuration only if its OOF patient balanced accuracy and macro F1 are both ≥ +2
  points over R′ with paired-bootstrap P(Δ > 0) ≥ 0.90, and neither its off-device COPD sensitivity
  nor its OOF accuracy on the in-cohort KAUH recordings is more than 5 points worse than R′'s.
  Otherwise retrain R′.
- The adopted model is trained once with `main.py … --merge-kauh`, evaluated once on the locked test
  split, and once on the KAUH holdout. For comparison, the model served before 2b (trained without
  KAUH) is also evaluated once on the same holdout. The holdout result is reported, not used to
  choose.

### 9.1 Round-2b cross-validation results (195 development patients of split v3; OOF)

Generated from `backend/artifacts/experiments/results.json` (report run 2026-10-23, reference R′ = D0 + YAMNet).

| Variant | Patient bal. acc | Macro F1 | Off-device COPD | Meditron | In-cohort KAUH | Δ bal. acc vs R′ [95% CI] | P(Δ>0) |
|---|---:|---:|---:|---:|---:|---|---:|
| D0 | 63.9% | 0.629 | 63.8% | 53.1% | 66.7% | -6.3 [-11.8, -1.1] | 0.01 |
| D3 | 65.7% | 0.643 | 67.2% | 53.1% | 72.2% | -4.4 [-10.1, +1.6] | 0.08 |
| D3_ce | 66.9% | 0.664 | 65.5% | 57.3% | 70.4% | -3.2 [-8.8, +2.1] | 0.13 |
| D3_x3 | 68.5% | 0.685 | 64.7% | 58.3% | 79.6% | -1.7 [-7.3, +3.6] | 0.29 |
| D3_devaug | 67.1% | 0.672 | 74.1% | 54.2% | 68.5% | -3.1 [-8.7, +2.5] | 0.17 |
| D3_mtl | 62.9% | 0.619 | 62.1% | 54.2% | 74.1% | -7.2 [-12.6, -1.5] | 0.01 |
| D3_mixup | 49.8% | 0.507 | 75.9% | 51.0% | 57.4% | -20.3 [-27.2, -12.7] | 0.00 |
| E_yamnet | 65.8% | 0.649 | 48.3% | 54.2% | 44.4% | -4.3 [-9.3, +0.9] | 0.05 |
| E_opera_ce | 67.7% | 0.677 | 34.5% | 27.1% | 57.4% | -2.4 [-9.2, +4.4] | 0.21 |
| E_hear | 71.6% | 0.704 | 69.8% | 64.6% | 70.4% | +1.5 [-4.3, +7.3] | 0.67 |
| D0+E_yamnet | 70.1% | 0.697 | 52.6% | 56.2% | 64.8% | reference |  |
| D3_x3+E_yamnet | 69.9% | 0.692 | 52.6% | 56.2% | 70.4% | -0.2 [-3.1, +3.1] | 0.48 |
| D3_x3+E_yamnet+E_opera_ce | 73.4% | 0.727 | 55.2% | 56.2% | 66.7% | +3.2 [-1.0, +7.5] | 0.94 |
| D3_x3+E_yamnet+E_hear | 73.1% | 0.726 | 72.4% | 60.4% | 75.9% | +3.0 [-0.3, +6.5] | 0.96 |
| D3_x3+E_yamnet+E_opera_ce+E_hear | 74.9% | 0.743 | 75.0% | 61.5% | 72.2% | +4.8 [-0.7, +10.4] | 0.95 |

- **Best D3-family member:** D3_x3 (3-seed ensemble). The single-change variants on D3: device
  augmentation +1.4, cross-entropy +1.2, multi-task −2.8, mixup −15.9 points of balanced accuracy.
  D3_devaug's first attempt ran out of GPU memory and was re-run in full after the `train.py` fix.
- **Pre-registered fusions** of D3_x3 with YAMNet (+ OPERA-CE and/or HeAR): all three that add a second
  embedding member pass the rule. The best passing combination, **D3_x3 + YAMNet + OPERA-CE + HeAR**, is
  adopted: +4.8 balanced accuracy and +4.6 macro F1, P = 0.95, and better on every shortcut-robustness
  metric. Several non-registered combinations (e.g. D3 + HeAR, D3_mtl + HeAR) also pass. They are
  reported here but were not eligible.
- **Cost:** serving now needs PyTorch (CPU, OPERA-CE) and HeAR (1.2 GB) in the artifact, and runs three
  RespiNets plus three embedding models per request.
- This decision was recorded before the adopted model was trained or the test/holdout sets were touched.


### 9.2 Round-2b production model: test split and KAUH holdout (2026-10-23)

**Getting to a valid artifact took three production runs.** Each failure is kept in the record:

| Run | Commit | Outcome | Record |
|---|---|---|---|
| #1 | `fe81a77` (HEAD at launch, 14:12; the run stopped before writing metadata) | stopped at the OPERA-CE head-export check: on the GPU, TF32 moved its probabilities by 2.2e-3 (C = 0.1) | EXP-014, D-23: heads now run on the CPU (`pretrained.predict_head`), tolerance 1e-4 |
| #2 | `a21b510` | completed, but the served `.keras` files of two ensemble members were later `ModelCheckpoint` epochs (56/44) than the `EarlyStopping`-restored weights (50/42) that calibration and the test metrics used | EXP-015, D-24: `train_model` now saves the restored model |
| **#3** | **`724c52c`** | **served model** | this section |

Run #2's test split and KAUH holdout results were seen before run #3 was trained. The configuration
was already fixed (D-21), so the re-evaluation chose nothing. It is disclosed here and in D-24.

**Test split (used for this configuration a second time; 49 patients, 389 recordings,
`test_metrics.json`):**

| | Recording level | Patient level |
|---|---:|---:|
| Accuracy | 82.01% | **75.51%** (95% CI 63.3–87.8%) |
| Balanced accuracy | 73.47% | 74.87% (CI 63.4–86.6%) |
| Macro F1 | 0.704 | 0.739 |
| Macro OvR AUROC | 0.919 | 0.939 |
| ECE | 0.074 | 0.085 |

- **Patient sensitivity:** asthma 8/8, COPD 12/14, healthy 7/11, bronchial 5/8, pneumonia 5/8.
- **By source (patient accuracy):** ICBHI 75.9% (29 patients), Kaggle 76.5% (17), KAUH 2/3.
- Split v3 has different test patients from split v2, so this is not comparable with the round-2
  model's 73.33% on 45 patients (§7).

**KAUH holdout (51 patients never in training; 24 with an in-label diagnosis; used once for run #3,
once for run #2):**

| Model | Patients correct | Healthy | COPD | Bronchial | Balanced | Out-of-label recordings (81) |
|---|---:|---:|---:|---:|---:|---|
| Served before 2b (`fusion-round2-split2`) | 0/24 (exact CI 0–14.2%) | 0/18 | 0/5 | 0/1 | 0.0% | asthma 63, pneumonia 17, COPD 1 |
| **Round 2b (`724c52c`)** | **17/24 (70.8%, CI 48.9–87.4%)** | **17/18** | **0/5** (CI 0–52%) | 0/1 | 31.5% | healthy 52, asthma 26, COPD 2, bronchial 1 |

**Interpretation:**
- The pre-registered criterion for H3 was holdout in-label accuracy at least 30 points above the
  previous 0%. It is **met on accuracy (+70.8 points)**, but only because 18 of the 24 patients are
  healthy.
  - COPD is still 0/5, even with 4 KAUH COPD patients in training.
  - Balanced accuracy is 31.5%, close to the 33% chance level for three classes.
- The predictions on out-of-label KAUH patients (heart failure, fibrosis, effusion and others)
  swung from mostly "asthma" to mostly "healthy".
- The model learns the site's dominant training label more than the diseases. Within the site it
  now says "healthy" where it used to say "asthma".
- It is a **within-site** result. It must not be presented as restored cross-site generalization.
- Abstention is higher on out-of-label recordings (64%) than on in-label ones (46%), a supporting
  observation for X5.

**Deployment checks** (`backend/artifacts/experiments/deployment_checks/round2b_final*.json`):
- `/ready`: 200 with a verified contract.
- Server vs training path: 4.7e-5 on 12 test recordings, same class 12/12.
- The gate rejects a tone, white noise and silence, and accepts a test recording.
- **Reported-metrics reproduction** (new in this round): all 389 test recordings go through the
  served files and are compared with `test_metrics.json`. On the GPU, the device that produced
  `test_metrics.json`, everything matches exactly. On the CPU (Docker serving), 1 recording flips
  (TF32 near-tie): recording balanced accuracy 72.3% vs 73.5%, patient metrics identical.

**Serving requirements:**
- PyTorch (CPU build, `requirements-experiments.txt`) for OPERA-CE. Both Dockerfiles install it;
  not yet build-tested.
- The artifact is about 1.3 GB, of which HeAR is 1.2 GB.
