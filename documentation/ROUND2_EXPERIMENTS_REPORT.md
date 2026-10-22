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

## 5. Results

_Pending._
