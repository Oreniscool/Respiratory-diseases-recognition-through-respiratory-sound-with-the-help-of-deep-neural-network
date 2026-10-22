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

_Pending: R retrained on the corrected split._

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
