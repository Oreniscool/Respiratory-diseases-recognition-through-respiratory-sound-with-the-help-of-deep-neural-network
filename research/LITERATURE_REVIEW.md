# Literature Review: Evaluation Leakage, Recording-Source Shortcuts and Cross-Site Generalization in Lung-Sound Disease Classification

Compiled 2026-10-23 (IST) by the literature-review agent. Every reference in §9.1 was opened during
this task. Reported numbers are quoted only from pages that were read. Where the split protocol of a
cited result is unclear, the text says "protocol not stated".

---

## 1. Scope and search method

**Research question.** How much of the accuracy reported for public lung-sound disease classification
comes from evaluation leakage and recording-source shortcuts? Does mixing recording sources in
training restore cross-site generalization?

**Sources consulted**
- Web search (general engine), arXiv abstract pages and the arXiv export API, ar5iv HTML renderings
- Crossref REST API, OpenAlex (for the "cited by" list), Europe PMC REST API, PubMed Central full text
- Semantic Scholar API (one successful call; others were rate-limited with HTTP 429)
- Publisher pages (IOP, PLOS, MDPI via PMC, JMIR), Mendeley Data, the Kaggle dataset API, GitHub

**Queries used**
- "Basu Rana Respiratory diseases recognition through respiratory sound…"
- "ICBHI 2017 official split 60% 40% patients…"
- "respiratory sound classification ICBHI data leakage random split patient-level inflated accuracy"
- "cross-dataset generalization lung sound classification trained on ICBHI tested on another dataset"
- "lung sound domain adaptation ICBHI SPRSound HF_Lung cross-corpus"
- "respiratory sound classifier learns recording device or site instead of disease shortcut"
- "Kaggle Asthma Detection Dataset Version 2"
- "ICBHI disease classification patient-independent … compared to random split"
- Title lookups for each candidate reference (Crossref and arXiv)

**Method notes**
- Partway through the task, the WebFetch and WebSearch tools hit a usage limit. The remaining
  verification fetched the same public, authoritative pages directly over HTTP: the arXiv export
  API, the Crossref API, arXiv PDFs converted with `pdftotext`, and the GitHub API and raw README.
  No repository code was run.
- IEEE Xplore (paywalled and script-rendered), Nature and MDPI article pages, and the ICBHI challenge
  website (expired TLS certificate) could not be read directly. For those works the bibliographic
  record was verified through Crossref, OpenAlex or Europe PMC, and their content was read from an
  open copy (PMC or arXiv) where one exists.

**Date accessed:** 2026-10-23 for every entry unless noted otherwise.

---

## 2. The original paper

**Verified record.** V. Basu and S. Rana, "Respiratory diseases recognition through respiratory sound
with the help of deep neural network," *2020 4th International Conference on Computational
Intelligence and Networks (CINE)*, Kolkata, India, 27–29 Feb 2020, pp. 1–6, IEEE.
- DOI: 10.1109/CINE48825.2020.234388
- IEEE Xplore document 9080747
- Sources: Crossref record [R1]; OpenAlex record W3022095039 (publication date 2020-02-01; both
  authors at Jalpaiguri Government Engineering College) [R2]
- Note: some aggregators list the author order as "Srinibas Rana, Victor Basu" [R3]. Crossref and
  OpenAlex list Basu first.

**Citation footprint.** OpenAlex reports 70 citing works (Crossref "is-referenced-by" count: 60) [R2].
The citing works are mostly:
- surveys and reviews (e.g., Sensors 2024 10.3390/s24041173; J. Big Data 2023 10.1186/s40537-023-00762-z;
  Bioengineering 2023 10.3390/bioengineering10101155)
- follow-up ICBHI classifiers (e.g., Shuvo et al. JBHI 2021 [R13]; Fraiwan et al. BBE 2021 [R16];
  RDLINet, TIM 2023)

No citing work in the OpenAlex list has a title that indicates a replication or critique of the
paper's evaluation protocol. That judgement is based on titles only; the 70 papers were not read.

**What the record pages confirm**
- The abstract (via the aggregator page [R3] and the authors' GitHub README [R4]) states that the
  model classifies COPD, URTI, bronchiectasis, pneumonia and bronchiolitis, plus healthy vs
  unhealthy, "with higher accuracy and precision". It gives no numbers.
- The README [R4] (linked to the IEEE DOI) adds:
  - Results: accuracy 95.67% ± 0.77%, precision 95.89% ± 0.8%, sensitivity 95.65% ± 0.753%,
    F1 95.66% ± 0.79%, Cohen's κ 94.74% ± 0.96%, MCC 94.79% ± 0.96%.
  - Classes: asthma (1 case) and LRTI (2 cases) were removed, leaving 6 classes.
  - Augmentation: "random noise", shift and librosa time-stretch were applied to the non-COPD classes,
    and at most three chest locations per COPD patient were kept.
  - Features: 40 MFCC features per recording.
  - Training: Adamax with categorical cross-entropy, 1000 iterations.
  - Runs: the experiment was run twenty times and "selected unique readings" were reported in
    Table 1.
  - Checkpointing: "We validated our model performance with the best model weight concerning the
    validation score during training".

**Protocol facts not confirmed by literature pages.** The full IEEE text was not accessible. These
three facts come from this project's audit of the original code, not from a page I read:
- the 75/25 random recording-level split
- augmentation applied before the split
- the validation split being the same 25% used for testing

The README is consistent with them: it describes augmentation in preprocessing, before the model
section, and checkpoint selection on a "validation score" with no separate test set described.
However, it does not state the split ratio or order explicitly.

---

## 3. Evaluation protocols and reported results on ICBHI (and related) classification

### 3.1 The official ICBHI protocol

- **Database contents.** Rocha et al. 2019 [R5] (abstract, IOP page): 920 recordings from 126
  participants, 6,898 annotated respiratory cycles and 10,775 crackle/wheeze events. The best
  challenge system scored 52.5% on the cycle task. The paywalled full text could not be checked for
  the split definition.
- **Official 60/40 patient-disjoint split.** Bae et al. 2023 [R6] describe it: the data "are
  officially split into a train set (60%) and a test set (40%)". The train set has 539 recordings
  from 79 patients and the test set has 381 recordings from 49 patients, and "the patients are
  divided into either the train or test set without overlap".
- **Patient-count discrepancy.** These counts sum to 128 patients, while Rocha et al. [R5] report
  126 participants. Pham et al. [R12] also say 128 patients.
- **Disease tasks are author-defined.** The official challenge task is cycle-level
  (crackle/wheeze). Disease-level tasks were defined by later authors, for example
  healthy/chronic/non-chronic by Pham et al. [R11, R12] and Perna & Tagarelli [R8].

### 3.2 Reported results by split type

"Score" means the ICBHI score, i.e., the mean of sensitivity and specificity, unless stated
otherwise.

| Paper | Task | Split type | Reported metric | DOI / URL |
|---|---|---|---|---|
| Basu & Rana 2020 [R1, R4] | 6-class disease, per recording (mean MFCC) | Random recording-level; augmentation before split (per project audit, see §2) | Acc 95.67% ± 0.77% (README) | 10.1109/CINE48825.2020.234388 |
| Perna & Tagarelli 2019 [R8] | Ternary healthy / chronic / non-chronic | 80/20; random vs patient-level not stated | LSTM: acc 0.98, Sp 0.82, Se 0.98, Score 0.90 | arXiv:1907.05708 |
| Pham thesis 2021 [R11], Table 37 (CNN-MoE) | Task 2-1: 3-class disease, per recording | 5-fold CV over 920 recordings (no patient grouping) **vs** official 60/40 | Score **0.91 (5-fold) vs 0.84 (official)** | arXiv:2107.09268 |
| Same, Task 1-1 | 4-class cycles | 5-fold vs official | Score **0.79 vs 0.47** | arXiv:2107.09268 |
| Same, Task 2-2 | Healthy vs unhealthy | 5-fold vs official | Score 0.92 vs 0.84 | arXiv:2107.09268 |
| Pham et al. 2020 (Inception) [R12] | 3-class disease, per recording | Official 60/40, "a subject is not presented in both training and test sets" | AS/HS **0.87/0.85** | arXiv:2012.13699 |
| Pham et al. 2020 (CNN-MoE) [R9] | 3-class and 2-class disease | 5-fold CV; patient grouping not described | 3-class Sp 0.86, Se 0.96, Score 0.91 (tables disagree: 0.83 / 0.96 / 0.90) | arXiv:2002.03894 |
| Shuvo et al. 2021 [R13] | 6-class pathology; 3-class chronic | Journal abstract: "patient independent train-validation-test set". arXiv text: augmented image sets split 80/20 into train/validation with "patient uniqueness" kept; no separate test set; augmentation appears to precede the split | Weighted acc 98.70% (6-class) and 98.92% (3-class), journal. arXiv: 99.05% and 99.20% on the validation split | 10.1109/JBHI.2020.3048006; arXiv:2009.04402 |
| García-Ordás et al. 2020 [R14] | 3-class; 6-class | 80/20 split plus 10-fold CV; patient grouping not stated; VAE oversampling probably before split (not stated) | F-score 0.993 (3-class), 0.990 (6-class) | 10.3390/s20041214 |
| Saldanha et al. 2022 [R15] | 7-class (healthy plus 6 diseases) | About 70% of segments per class for training; patient overlap not addressed; VAE trained on the training portion only | Sp/Se/F1 tables (values not quoted here) | 10.1371/journal.pone.0266467 |
| Fraiwan et al. 2021 [R16] | 6 classes, KAUH clinical recordings plus ICBHI recordings | Protocol not stated in the abstract | Boosted DT acc 98.27%, Se 95.28%, Sp 98.9% | 10.1016/j.bbe.2020.11.003 |
| Gairola et al. (RespireNet) [R7] | 4-class cycles | Official 60/40 vs 80/20; footnote says both are patient-wise disjoint | Score **56.2% (official) vs 68.5% (80/20)** | arXiv:2011.00196 |
| Bae et al. 2023 [R6] | 4-class cycles | Official 60/40 | Patch-Mix CL: Sp 81.66%, Se 43.07%, Score 62.37% | 10.21437/Interspeech.2023-1426 |
| Kim et al. 2024 (SG-SCL) [R18] | 4-class cycles | Official 60/40 | Score 61.71% (2-class: 68.93%) | arXiv:2312.09603 |
| Jeong & Kim 2025 (PAFA) [R19] | 4-class / 2-class cycles | Split not stated in the abstract | Score 64.84% / 72.08% | arXiv:2505.23834 |
| Zhang et al. 2024 (OPERA), task T7 [R45] | ICBHI COPD vs healthy (793 vs 35 recordings, 90 subjects) | Random participant-independent | AUROC: CLAP 0.933, AudioMAE 0.886, OPERA-CE 0.872 | arXiv:2406.16148 |
| Zhang et al. 2024 (OPERA), task T10 [R45] | KAUH obstructive vs healthy (234 recordings, 79 subjects) | Random participant-independent | AUROC: OPERA-CE 0.741, CLAP 0.697, VGGish 0.605 | arXiv:2406.16148 |
| Saky et al. 2025 (preprint) [R27] | Kaggle Asthma V2, 5-class | Claims "Partitioning was performed at the patient level" (70/15/15); does not say how patients were identified | Acc 91.21%, macro F1 0.899, AUROC 0.9866 | arXiv:2512.00563 |
| Saky et al. 2026 (Life) [R26] | Kaggle Asthma V2, 5-class; external evaluation on ICBHI | Stratified recording-level 70/15/15; "patient-level separation could not be confirmed" | Internal acc 0.910, balanced acc 0.894. ICBHI 4-class: acc 0.880 but **balanced acc 0.305**. ICBHI healthy vs disease: balanced acc 0.500, healthy specificity 0.000 | 10.3390/life16071108 |
| Hota et al. 2025 (ILD-VIT) [R44] | ILD vs other, BRACETS plus KAUH | "subject-independent blind testing" | Acc 84.86%, Se 82.67%, Sp 86.91% | arXiv:2510.11458 |

### 3.3 Take-aways for the research question

1. **The literature already reports that random splits inflate ICBHI results.**
   - Pham's thesis: "systems following the ICBHI data split (i.e. recordings from the same patient
     are never found in both train/test subsets) exhibit considerably lower performance over all
     tasks than those following random splitting".
   - It attributes this to "very high dependence on patient characteristics" [R11].
   - Its own paired comparison for recording-level 3-class disease is 0.91 vs 0.84 Score. That is a
     7-point gap on a metric dominated by the COPD majority, much smaller than the gap on cycle
     classification (0.79 vs 0.47).
   - Pham et al. [R12] explicitly flag earlier works that "randomly separate ICBHI dataset … regardless
     this patient independency".
2. **Disease-level ICBHI scores stay high even under the official split** (0.84–0.87 Score) [R11, R12].
   The ICBHI score and plain accuracy are dominated by COPD (793 of 828 recordings in OPERA's COPD
   vs healthy task [R45]). So a high disease-level number on ICBHI is weak evidence of disease
   discrimination even without leakage. Saky et al. [R26] show the same pattern on external ICBHI:
   accuracy 0.88 against balanced accuracy 0.30.
3. **Many very high accuracies come from protocols where patient grouping or augmentation order is
   unstated or questionable:** 98–99% in [R13, R14, R16], and 95.67% in the original paper.
   - Saldanha et al. [R15] call out one such leak explicitly: "Inclusion of test set data for
     training the generative model (data leakage)".
4. **No paper read here gives a per-leak ablation of a published protocol.** Specifically, none
   removes augmentation-before-split, patient overlap and test-set checkpoint selection one at a
   time.

---

## 4. Leakage, shortcut and confounding literature

### 4.1 Respiratory and lung sound

- **Pham 2021 thesis [R11].**
  - Direct statement that patient-disjoint ICBHI splits score "considerably lower" than random
    splits, with paired numbers (§3.2).
- **Gairola et al., RespireNet [R7].**
  - "the AKGC417L Microphone alone contributes to 63% of the samples". The authors argue "the DNN
    may fail to generalize across devices" and propose device-specific fine-tuning.
  - Reports 56.2% (official) vs 68.5% (80/20) Score, but says both splits are patient-disjoint and
    that "there is lack of standardization in the 80-20 split". So this gap cannot be attributed
    purely to patient overlap.
- **Kim et al. 2024, SG-SCL [R18].**
  - ICBHI device imbalance: LittC2SE has 594 recordings, all in training; Litt3200 has 41 training
    and 461 test recordings.
  - AST-baseline embeddings "are clustered according to the stethoscopes" (t-SNE, qualitative).
  - Treats the device as a domain.
- **Koo et al. 2026 [R20].**
  - "stethoscope-induced style and disease-relevant content are partially entangled, making
    deterministic style removal unreliable".
  - Under simulated held-out-device evaluation, their method improves out-of-distribution ICBHI
    Score by 3.69 points over five held-out devices.
  - This is direct, recent evidence of stethoscope shortcuts. Note that it is cycle-level ICBHI,
    not disease-level.
- **Rocha et al. 2021 [R17].**
  - Adventitious-sound classification drops from 96.9% to 81.8% accuracy when event durations are
    realistic. "a robust experimental design is lacking in many studies, leading to overestimated
    results".
  - Uses the patient-based split "suggested by the RSD authors".
- **Saldanha et al. 2022 [R15].** Names generative-augmentation leakage, i.e., training the VAE on
  test data, in prior work.
- **Heitmann et al. 2023, DeepBreath [R25].**
  - "the model can learn to distinguish recording locations with relatively high accuracy" and
    could learn "spurious features". The authors used balanced sampling across centres. No
    quantitative site-probe result is reported.
  - Motivates external validation by noting that ICBHI acquisition biases can let models
    discriminate classes by background noise (paraphrased from the introduction).
  - All data come from a single stethoscope brand.
- **Saky et al. 2026 [R26].**
  - Audit of the Kaggle Asthma V2 set: 12 exact duplicate audio pairs and 171 clipped recordings.
    "clipped or duplicated recordings may inflate apparent performance if distributed across
    different data partitions".
  - Filename identifiers "are reused across disease folders".
- **Seidaliyeva et al. 2026, scoping review [R28]** (89 included reports; Crossref abstract).
  - Acquisition and annotation practices introduce "device-, site-, and label-related confounding".
  - Lists "inconsistent data splitting" and "limited external validation" as persistent
    limitations, and calls for patient-independent evaluation and validation across independent
    devices, datasets and populations.

### 4.2 Medical audio more broadly

- **Coppock et al. 2024 [R33].** Audio COVID-19 classifiers had ROC-AUC 0.846 unadjusted but 0.619
  after matching on age, gender and self-reported symptoms, and did not beat a symptom checker. This
  is the closest large-scale audio analogue of label confounded with recruitment source.
- **Baur et al. 2024, HeAR [R46].** TRILL and FRILL embeddings showed "up to 12% drop between best
  and worst recording devices" on cough tasks (phones, not stethoscopes).

### 4.3 General ML and medical imaging analogues

- **Geirhos et al. 2020 [R29].** Shortcut learning: decision rules that "perform well on standard
  benchmarks" but fail under harder real-world tests.
- **Zech et al. 2018 [R30].**
  - CNNs identified the source hospital system from chest radiographs with 99.95% (NIH) and 99.98%
    (MSH) accuracy.
  - A pneumonia model had internal AUC 0.931 but external AUC 0.815.
  - The hospital system "may confound predictions". This is the direct imaging analogue of our
    finding that probes recover dataset and device more easily than disease.
- **DeGrave et al. 2021 [R31].** COVID-19 radiograph models "rely on confounding factors rather than
  medical pathology" (preprint abstract via Crossref) and are likely to perform poorly at other
  hospitals.
- **Roberts et al. 2021 [R32].** Systematic review of pitfalls in COVID-19 imaging ML. Only the
  record was verified; the content was not read.
- **Kapoor & Narayanan 2023 [R34].** Leakage found in 329 papers across 17 fields; a taxonomy of 8
  leakage types; proposes model info sheets.
- **Yagis et al. 2021 [R35].** Slice-level instead of subject-level splitting inflated brain-MRI
  accuracy by roughly 26–55 points across four datasets. With random labels, slice-level splits gave
  about 94–96% accuracy vs about 50% for subject-level splits. This is the clearest quantitative
  analogue of "same patient across split".
- **Wen et al. 2020 [R36].** "more than half of the surveyed papers may have suffered from data
  leakage" (Alzheimer's CNNs). The authors locked the test set "until the end of the peer-review
  process". Models "generalized well to similar populations but not to datasets with different
  inclusion criteria".

---

## 5. Datasets and provenance

| Dataset | Content and diagnoses | Device and site | Licence | Source |
|---|---|---|---|---|
| **ICBHI 2017** | 920 recordings, 126 participants (or 128 per [R6, R12]), 6,898 cycles. Per-patient diagnoses: COPD, URTI, bronchiectasis, pneumonia, bronchiolitis, LRTI, asthma, healthy | 4 devices: AKG C417L, Meditron, Littmann 3200, Littmann C2SE [R18]. AKG C417L accounts for 63% of samples [R7]. Author affiliations in Portugal and Greece [R5] | Not verified (challenge site unreachable) | [R5], [R50 = Rocha 2018 IFMBE record] |
| **KAUH (Fraiwan et al.)** | 112 subjects, one recording each, 5–30 s, three filter modes (bell, diaphragm, extended). Normal 35, asthma 32, heart failure 21, COPD 9, pneumonia 5, lung fibrosis 5, BRON 3, pleural effusion 2 | 3M Littmann 3200; King Abdullah University Hospital, Irbid, Jordan | Dataset CC BY 4.0 (Mendeley); data article CC BY-NC-ND 4.0 | [R37], [R38], [R16] |
| **Kaggle Asthma Detection Dataset V2** | 1,211 clips (the per-class counts sum to 1,181: asthma 288, bronchial 104, COPD 401, healthy 133, pneumonia 255). Description says "Approximately 170 samples" came from a "Respiratory Sound Database" citing DOI 10.1016/j.bbe.2020.11.003 (the KAUH paper) and "212 samples" from ICBHI, plus 22 or 18 individual patients (internally inconsistent). Processed in WavePad | Inherits from its sources | "Open Database / Database Contents" | [R39]; associated chapter [R40] |
| **SPRSound** | Paediatric, 2,683 records and 9,089 events from 292 participants (paper). Sound-event and record-level labels (Normal / CAS / DAS / Poor Quality). The repository page shows **no disease diagnoses**. The 2022 test set is split into inter-subject and intra-subject parts | Yunting model II stethoscope; Shanghai Children's Medical Center | CC BY 4.0 | [R41] |
| **HF_Lung_V1** | 9,765 × 15 s recordings. Labels are breath phases, CAS and DAS. Diagnoses only for 18 ward residents; TSECC patient information "missing" | Littmann 3200 plus HF-Type-1 recorder, 4 kHz; Taiwan | Article CC BY 4.0; TSECC source CC BY 4.0 | [R42] |
| **RespiratoryDatabase@TR** | 12-channel recordings per patient, COPD0–COPD4 severity labels, at least 17 s | Iskenderun Technical University (Turkey); device not stated on the page | CC BY 4.0 | [R43] |
| **BRACETS** | Used with KAUH for ILD detection with subject-independent testing [R44] | (not verified) | (not verified) | See unverified leads |

### 5.1 Provenance observations relevant to the research question

- **The Kaggle V2 description admits ICBHI and KAUH-paper sources** [R39], but the stated counts
  (about 170 and 212 samples) are far smaller than the number of derived clips our audit found
  (631 ICBHI-derived and 316 KAUH-derived). The likely cause is segmentation of each source recording
  into several clips; the Kaggle page mentions segmentation. The page gives no per-clip source
  mapping.
- **At least one 2026 peer-reviewed paper missed this provenance.** Saky et al. [R26] train on Kaggle
  V2 and then use ICBHI as an "external" domain-shift test set, treating the two as separate
  datasets. Their data-availability statement cites Kaggle only, and no provenance limitation is
  stated. Because Kaggle V2 contains ICBHI-sourced audio by its own description, that external
  evaluation is not independent of the training data.
- **The same group's preprint [R27] contradicts the journal version on patient-level partitioning.**
  The preprint claims patient-level partitioning; the journal version [R26] says patient-level
  separation "could not be confirmed". This shows that the Kaggle "patient" identifiers are not
  reliable patient IDs.
- **No source read here documents the clip-level overlap between Kaggle V2 and ICBHI/KAUH.** This
  includes verbatim cuts and filename groups that mix real patients.
- **Only ICBHI, KAUH and RespiratoryDatabase@TR (COPD severity only) carry disease diagnoses.** Of
  the public auscultation datasets verified here, these are the ones usable for external disease
  validation. SPRSound and HF_Lung_V1 are labelled for sound events, not diagnoses.

---

## 6. Cross-dataset and device-shift studies

- **DeepBreath [R25]** is the strongest disease-level cross-site study found.
  - Trained on Geneva and Porto Alegre; externally validated in Senegal, Morocco and Cameroon.
  - AUROC internal vs external: controls 0.931 vs 0.887; pneumonia 0.749 vs 0.739; wheezing disorder
    0.912 vs 0.743; bronchiolitis 0.939 vs 0.870.
  - The multi-class model "was significantly reduced in external validation". The authors attribute
    this mainly to imbalance by diagnosis and recording centre.
  - Shows that multi-site training with balanced sampling gives partial, not full, transfer.
  - Single stethoscope brand, so device shift was not tested.
- **Saky et al. 2026 [R26].** Kaggle V2 → ICBHI: internal balanced accuracy 0.894 fell to 0.305
  (4-class), and "the model failed to identify Healthy cases". Train/test independence is
  compromised (see §5.1).
- **Device shift within ICBHI** (cycle-level tasks):
  - SG-SCL [R18] and Koo et al. [R20], the latter with leave-device-out-style evaluation.
  - RespireNet device-specific fine-tuning [R7].
  - Nguyen & Pernkopf [R24] apply "spectrum correction to consider the variations of the recording
    device properties".
- **ICBHI → SPRSound out-of-distribution:** QLung [R21] reports the strongest OOD performance on
  SPRSound (cycle/event level). APRIL [R22] builds device- and temporal-incremental benchmarks on
  ICBHI and SPRSound (final Scores 64.4/65.4% ICBHI and 83.1/82.2% SPRSound).
- **Noise shift.** Tzeng et al. [R23]: adding an audio-enhancement front-end gave a 21.9% increase
  in ICBHI score and 4.1% on FABS in noisy multi-class scenarios.
- **OPERA [R45]** reports generalization to datasets not seen in pretraining, including KAUH. These
  are linear-probe results within each dataset, not train-on-A/test-on-B disease transfer.

**Gap in this literature.** No study read here trains a disease classifier on one public auscultation
dataset and tests it on a different public auscultation dataset with matched diagnoses, except Saky
et al., whose external set is contaminated. The device-shift work is almost entirely about
cycle-level crackle and wheeze labels on ICBHI and SPRSound.

---

## 7. Pretrained audio representations for respiratory tasks

- **OPERA (Zhang et al., NeurIPS 2024 D&B) [R45].**
  - Pretrained on about 136K samples (more than 400 hours) from COVID-19 Sounds, UK COVID-19,
    COUGHVID, ICBHI and HF_Lung.
  - 19-task benchmark; OPERA beats general-audio models on 16 of 19 tasks.
  - On KAUH, the best AUROC is 0.741 (OPERA-CE). On ICBHI COPD vs healthy, the best is general-audio
    CLAP at 0.933.
  - YAMNet and PANNs were not evaluated.
- **HeAR (Baur et al., 2024) [R46].**
  - MAE pretrained on about 313M two-second clips; 33 tasks across 6 datasets.
  - No auscultation datasets. Cough tasks only, with stable performance across held-out phone
    devices.
- **General audio models:**
  - YAMNet [R47]: MobileNet-v1, AudioSet, 521 classes, 16 kHz, 1024-d embedding.
  - PANNs [R48]: AudioSet mAP 0.439.
  - AST [R49]: AudioSet mAP 0.485.
  - BEATs [R50b]: AudioSet-2M mAP 50.6%.
- **Respiratory uses of these models:**
  - AST fine-tuning on ICBHI (Bae et al. [R6]).
  - BEATs backbone (APRIL [R22]).
  - CLAP plus metadata text including **recording device** and chest location (BTS [R51]; used again
    by Koo et al. [R20]).
  - Metadata-supervised contrastive pretraining on sex and age (Moummad & Farrugia [R52]).
  - Pretrained speech models with representation-level augmentation (RepAugment [R53]).
- **Relevance.** BTS feeds device metadata into the model to improve ICBHI scores [R51]. This is the
  same device information our research question treats as a confounder, so pretrained and
  metadata-aware gains on ICBHI may partly reflect source information.

---

## 8. Gap analysis

### 8.1 Already established (the gap here is small)

1. **Patient-disjoint evaluation lowers ICBHI results.** This has been stated with paired numbers
   since at least 2020–2021 (Pham [R11, R12]). The official 60/40 split exists to prevent the
   overlap [R6]. Medical imaging has quantified the same leak type much more sharply: 26–55 points
   in Yagis et al. [R35], and over half of AD papers possibly leaky in Wen et al. [R36].
2. **Device and stethoscope information is entangled with disease content on ICBHI**
   [R7, R18, R20]. Recording site can be learned by auscultation models [R25]. The general shortcut
   and site-confounding phenomenon is textbook [R29, R30, R31, R33].
3. **Cross-site external validation degrades disease-level performance** [R25, R26]. The
   reviews call for patient-independent, cross-device validation [R28].

### 8.2 Apparently not yet in the literature (what our research question would add)

1. **A protocol-faithful re-implementation and per-leak ablation of a specific, cited, high-accuracy
   ICBHI disease paper.** Our internal numbers (project experiments, not literature):
   - The faithful re-run reached 0.878 accuracy, not the reported 0.957.
   - Removing the three leaks one at a time, with 20 seeds per step, lowered accuracy to 0.598 under
     a patient-disjoint split. Balanced accuracy fell from 0.872 to 0.385.
   - No paper read here decomposes the inflation into augmentation-before-split, patient overlap and
     test-set checkpoint selection. The Pham comparison mixes model, split ratio and fold structure,
     and the RespireNet comparison is between two patient-disjoint splits.
2. **Documented clip-level provenance of the Kaggle Asthma V2 dataset.** Specifically, that 631 clips
   are verbatim ICBHI cuts and 316 are KAUH cuts, with "patient" filename groups that mix real
   patients. The Kaggle page only lists sources loosely [R39]. A 2026 peer-reviewed paper [R26] used
   ICBHI as an external test for a Kaggle-V2-trained model without noticing the overlap. This is a
   concrete, checkable contribution with an immediate corrective value.
3. **Disease-level (not cycle-level) source confounding across public datasets.** Specifically:
   - all COPD from ICBHI on mostly one device
   - almost all KAUH-recorded training audio is asthma
   - linear probes recover dataset/device more easily than disease
   - the resulting 0% external accuracy on held-out KAUH healthy and COPD patients
   Existing device-shift papers [R18, R20, R21, R22] work on crackle/wheeze cycle labels.
   DeepBreath [R25] is disease-level but private and single-device.
4. **A bandwidth control for the source attribution.** In our experiments, ICBHI audio re-encoded at
   4 kHz is rarely predicted as asthma, so the KAUH failure is attributed to site/device rather than
   bandwidth. No paper read here separates sampling-rate and bandwidth artifacts from device/site
   identity in lung-sound disease models.

### 8.3 Second half of the research question (does mixing sources restore generalization?)

- **Partial evidence exists.** DeepBreath [R25] trained on two sites with balanced sampling and
  transferred moderately (external AUROC 0.74–0.89), but its multi-class performance dropped
  "significantly". Zech et al. [R30] show that jointly training on two hospital systems still left
  an external gap and enabled hospital identification.
- **Our results suggest that mixing alone does not help when the label is confounded with the
  source.** In our data, each source contributes mainly one class, and the 0% KAUH result is
  consistent with that.
- **Implication for the claim.** The literature does not show that naive source mixing restores
  generalization. The claim should be framed as "mixing sources without balancing diagnoses within
  each source does not restore generalization". The positive form, "balanced multi-source training
  restores it", is only weakly supported (DeepBreath) and is not tested on public auscultation data.

### 8.4 Candid assessment

- **Leakage half.** The headline message ("random splits inflate ICBHI results; device/site
  shortcuts exist") is not novel by itself.
- **What is novel:**
  - the per-leak quantification on a specific published protocol
  - the Kaggle V2 provenance finding and its downstream contamination of published work
  - the disease-level, cross-public-dataset demonstration of source confounding with a bandwidth
    control
- **Framing.** Present it as a case study and an audit with quantified effects, not as the discovery
  of leakage or shortcut learning.

---

## 9. References

### 9.1 Verified references

All were accessed on 2026-10-23. "Verified" states what the opened page confirmed.

- **[R1]** V. Basu, S. Rana, "Respiratory diseases recognition through respiratory sound with the
  help of deep neural network," *Proc. 4th Int. Conf. Computational Intelligence and Networks
  (CINE)*, IEEE, 2020, pp. 1–6.
  - doi:10.1109/CINE48825.2020.234388; IEEE Xplore doc. 9080747
  - Verified: Crossref record (venue, pages, Feb 2020, Kolkata, 27–29 Feb 2020; 60 citations).
    The IEEE page itself would not render.
- **[R2]** OpenAlex work W3022095039 and its "cites" list.
  - https://api.openalex.org/works/doi:10.1109/cine48825.2020.234388
  - Verified: 70 citing works, author affiliations, publication date 2020-02-01.
- **[R3]** HyperAI paper page, "Respiratory diseases recognition through respiratory sound…".
  - https://hyper.ai/en/papers/respiratory-diseases-recognition-through
  - Verified: abstract wording, link to IEEE 9080747 and the code repository.
- **[R4]** V. Basu, GitHub repository README.
  - https://github.com/victor369basu/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network
  - Verified: 95.67% ± 0.77% accuracy; augmentation (noise, shift, time-stretch); 40 MFCC features;
    20 runs; best weights chosen by "validation score".
- **[R5]** B. M. Rocha et al., "An open access database for the evaluation of respiratory sound
  classification algorithms," *Physiol. Meas.* 40(3):035001, 2019.
  - doi:10.1088/1361-6579/ab03ea
  - Verified: Crossref record; IOP abstract (920 recordings, 126 participants, 6,898 cycles, 10,775
    events, best challenge score 52.5%). The full text is paywalled.
- **[R6]** S. Bae et al., "Patch-Mix Contrastive Learning with Audio Spectrogram Transformer on
  Respiratory Sound Classification," INTERSPEECH 2023.
  - doi:10.21437/Interspeech.2023-1426; arXiv:2305.14032
  - Verified: official 60/40 patient-disjoint split (539/79 train, 381/49 test); Score 62.37%.
- **[R7]** S. Gairola, F. Tom, N. Kwatra, M. Jain, "RespireNet: A Deep Neural Network for Accurately
  Detecting Abnormal Lung Sounds in Limited Data Setting."
  - arXiv:2011.00196
  - Verified: 56.2% (official) vs 68.5% (80/20) Score; both splits patient-disjoint; AKG C417L 63% of
    samples.
- **[R8]** D. Perna, A. Tagarelli, "Deep auscultation: Predicting respiratory anomalies and diseases
  via recurrent neural networks."
  - arXiv:1907.05708
  - Verified: 80/20 split without patient detail; ternary accuracy 0.98, Score 0.90.
- **[R9]** L. Pham et al., "Robust Deep Learning Framework For Predicting Respiratory Anomalies and
  Diseases."
  - arXiv:2002.03894
  - Verified: 5-fold CV; 3-class Sp 0.86, Se 0.96, Score 0.91; the tables are inconsistent.
- **[R10]** L. Pham et al., "CNN-MoE based framework for classification of respiratory anomalies and
  lung disease detection."
  - arXiv:2004.04072
  - Verified: abstract only (ICBHI, spectrogram front-end, teacher-student).
- **[R11]** L. Pham, "Robust Deep Learning Frameworks for Acoustic Scene and Respiratory Sound
  Classification," PhD thesis, 2021.
  - arXiv:2107.09268
  - Verified (full text): Tables 37–39; the quote on considerably lower performance with patient
    separation; definitions of 5-fold vs official splitting.
- **[R12]** L. Pham et al., "Inception-Based Network and Multi-Spectrogram Ensemble Applied For
  Predicting Respiratory Anomalies and Lung Diseases."
  - arXiv:2012.13699
  - Verified (full text): official 60/40 split, subject-disjoint; Task 2 AS/HS 0.87/0.85; criticism
    of random splits.
- **[R13]** S. B. Shuvo, S. N. Ali, S. I. Swapnil, T. Hasan, M. I. H. Bhuiyan, "A Lightweight CNN
  Model for Detecting Respiratory Diseases From Lung Auscultation Sounds Using EMD-CWT-Based Hybrid
  Scalogram," *IEEE JBHI* 25(7):2595–2603, 2021.
  - doi:10.1109/JBHI.2020.3048006; arXiv:2009.04402
  - Verified: Europe PMC abstract (98.70% / 98.92%, "patient independent"). arXiv text: 80/20
    division of augmented sets; no separate test set.
- **[R14]** M. T. García-Ordás et al., "Detecting Respiratory Pathologies Using Convolutional Neural
  Networks and Variational Autoencoders for Unbalancing Data," *Sensors* 20(4):1214, 2020.
  - doi:10.3390/s20041214; PMC7070339
  - Verified: 80/20 split plus 10-fold CV; F-scores 0.993 and 0.990; augmentation order not stated.
- **[R15]** S. Saldanha et al., "Data augmentation using Variational Autoencoders for improvement of
  respiratory disease classification," *PLoS ONE*, 2022.
  - doi:10.1371/journal.pone.0266467; PMC9374267
  - Verified: segment-level 70% split; quote naming generative-model leakage.
- **[R16]** L. Fraiwan, O. Hassanin, M. Fraiwan, B. Khassawneh, A. M. Ibnian, M. Alkhodari,
  "Automatic identification of respiratory diseases from stethoscopic lung sound signals using
  ensemble classifiers," *Biocybern. Biomed. Eng.* 41(1):1–14, 2021.
  - doi:10.1016/j.bbe.2020.11.003
  - Verified: Crossref record; Semantic Scholar abstract (KAUH plus ICBHI recordings; 98.27%
    accuracy; protocol not in the abstract).
- **[R17]** B. M. Rocha, D. Pessoa, A. Marques, P. Carvalho, R. P. Paiva, "Automatic Classification
  of Adventitious Respiratory Sounds: A (Un)Solved Problem?" *Sensors* 21(1):57, 2021.
  - doi:10.3390/s21010057; PMC7795327
  - Verified: 96.9% → 81.8%; "overestimated results" quote; patient-based split.
- **[R18]** J.-W. Kim, S. Bae, W.-Y. Cho, B. Lee, H.-Y. Jung, "Stethoscope-guided Supervised
  Contrastive Learning for Cross-domain Adaptation on Respiratory Sound Classification" (ICASSP 2024
  per the paper's tables).
  - arXiv:2312.09603
  - Verified: device distribution table; stethoscope clustering; Score 61.71%.
- **[R19]** S. G. Jeong, S. E. Kim, "Patient-Aware Feature Alignment for Robust Lung Sound
  Classification," INTERSPEECH 2025.
  - arXiv:2505.23834
  - Verified: abstract, Scores 64.84% / 72.08%.
- **[R20]** H. Koo, Y. T. Kim, M. Toikkanen, J.-W. Kim, "Mitigating Stethoscope-Induced Shortcuts in
  Respiratory Sound Classification under Federated Domain Generalization with Causality-Inspired
  Interventions," 2026.
  - arXiv:2605.29862
  - Verified: abstract (entanglement quote; +3.69 OOD Score over five held-out devices).
- **[R21]** Y. T. Kim, H. Koo, M. Toikkanen, J.-W. Kim, "Quality Adaptive Angular Margin Learning for
  Respiratory Sound Classification," INTERSPEECH 2026.
  - arXiv:2606.11915
  - Verified: abstract (ICBHI +2.46%; best OOD result on SPRSound).
- **[R22]** X. Li, W. Tu, "APRIL: Ambiguity-Aware Expert Routing for Respiratory Sound
  Domain-Incremental Learning," 2026.
  - arXiv:2610.27942
  - Verified: abstract (device- and temporal-incremental benchmarks; Scores).
- **[R23]** J.-T. Tzeng et al., "Improving the Robustness and Clinical Applicability of Automatic
  Respiratory Sound Classification Using Deep Learning-Based Audio Enhancement," *JMIR AI*, 2025.
  - doi:10.2196/67239; arXiv:2407.13895
  - Verified: arXiv abstract (+21.9% ICBHI, +4.1% FABS under noise).
- **[R24]** T. Nguyen, F. Pernkopf, "Lung Sound Classification Using Co-tuning and Stochastic
  Normalization."
  - arXiv:2108.01991
  - Verified: abstract (spectrum correction for recording-device variation).
- **[R25]** J. Heitmann et al., "DeepBreath—automated detection of respiratory pathology from lung
  auscultation in 572 pediatric outpatients across 5 countries," *npj Digit. Med.* 6:104, 2023.
  - doi:10.1038/s41746-023-00838-3; PMC10238513
  - Verified: internal vs external AUROCs; site-learning and single-stethoscope statements.
- **[R26]** S. M. A. I. Saky et al., "Explainable Multi-Modal Deep Learning for Recording-Level
  Classification of Respiratory Audio Signals Under Internal and Domain-Shift Evaluation,"
  *Life* 16(7):1108, 2026.
  - doi:10.3390/life16071108; PMC13413210
  - Verified (full text): Kaggle V2 internal split; ICBHI external results; duplicates and
    identifier-reuse quotes; no provenance limitation stated.
- **[R27]** S. M. A. I. Saky, M. R. Islam, M. S. Arefin, S. Alam, "Explainable Multi-Modal Deep
  Learning for Automatic Detection of Lung Diseases from Respiratory Audio Signals," 2025.
  - arXiv:2512.00563
  - Verified: claim of patient-level partitioning; 91.21% accuracy; only Kaggle V2 named as a source.
- **[R28]** U. Seidaliyeva et al., "Artificial Intelligence-Based Respiratory Sound Analysis: A
  Scoping Review…," *Technologies* 14(8):486, 2026.
  - doi:10.3390/technologies14080486
  - Verified: Crossref record with abstract (confounding; inconsistent splitting; limited external
    validation).
- **[R29]** R. Geirhos et al., "Shortcut learning in deep neural networks," *Nat. Mach. Intell.*
  2:665–673, 2020.
  - doi:10.1038/s42256-020-00257-z; arXiv:2004.07780
  - Verified: arXiv abstract and Crossref record.
- **[R30]** J. R. Zech et al., "Variable generalization performance of a deep learning model to detect
  pneumonia in chest radiographs: A cross-sectional study," *PLoS Med.* 15(11):e1002683, 2018.
  - doi:10.1371/journal.pmed.1002683
  - Verified: hospital-ID accuracy; AUC 0.931 vs 0.815.
- **[R31]** A. J. DeGrave, J. D. Janizek, S.-I. Lee, "AI for radiographic COVID-19 detection selects
  shortcuts over signal," *Nat. Mach. Intell.* 3(7):610–619, 2021.
  - doi:10.1038/s42256-021-00338-7 (preprint doi:10.1101/2020.09.13.20193565)
  - Verified: Crossref records; preprint abstract.
- **[R32]** M. Roberts et al., "Common pitfalls and recommendations for using machine learning to
  detect and prognosticate for COVID-19 using chest radiographs and CT scans," *Nat. Mach. Intell.*
  3:199–217, 2021.
  - doi:10.1038/s42256-021-00307-0
  - Verified: Crossref record only (content not read; cited only as existing).
- **[R33]** H. Coppock et al., "Audio-based AI classifiers show no evidence of improved COVID-19
  screening over simple symptoms checkers," *Nat. Mach. Intell.* 6(2):229–242, 2024.
  - doi:10.1038/s42256-023-00773-8; arXiv:2212.08570
  - Verified: Crossref abstract; arXiv AUCs 0.846 → 0.619.
- **[R34]** S. Kapoor, A. Narayanan, "Leakage and the reproducibility crisis in machine-learning-based
  science," *Patterns* 4(9):100804, 2023.
  - doi:10.1016/j.patter.2023.100804; arXiv:2207.07048
  - Verified: 329 papers, 17 fields, 8 leakage types.
- **[R35]** E. Yagis et al., "Effect of data leakage in brain MRI classification using 2D
  convolutional neural networks," *Sci. Rep.* 11:22544, 2021.
  - doi:10.1038/s41598-021-01681-w; PMC8604922
  - Verified: Table 4 inflation values; random-label experiment.
- **[R36]** J. Wen et al., "Convolutional neural networks for classification of Alzheimer's disease:
  Overview and reproducible evaluation," *Med. Image Anal.* 63:101694, 2020.
  - doi:10.1016/j.media.2020.101694; arXiv:1904.07773
  - Verified: abstract ("more than half … data leakage").
- **[R37]** M. Fraiwan, L. Fraiwan, B. Khassawneh, A. Ibnian, "A dataset of lung sounds recorded from
  the chest wall using an electronic stethoscope," Mendeley Data, V3, 2021.
  - doi:10.17632/jwyy9np4gv.3
  - Verified: contributors, CC BY 4.0, Littmann 3200, filter modes.
- **[R38]** M. Fraiwan, L. Fraiwan, B. Khassawneh, A. Ibnian, "A dataset of lung sounds recorded from
  the chest wall using an electronic stethoscope," *Data in Brief* 35:106913, 2021.
  - doi:10.1016/j.dib.2021.106913; PMC7937981
  - Verified: 112 subjects; per-diagnosis table; King Abdullah University Hospital; 5–30 s.
- **[R39]** M. T. Musaed, "Asthma Detection Dataset Version 2," Kaggle, last updated 2024-08-29.
  - https://www.kaggle.com/datasets/mohammedtawfikmusaed/asthma-detection-dataset-version-2
    (read through the Kaggle API `datasets/view` endpoint)
  - Verified: description, sources (≈170 samples from a "Respiratory Sound Database" citing
    10.1016/j.bbe.2020.11.003; 212 from ICBHI; 22 or 18 individual patients), class counts,
    licence.
- **[R40]** M. Tawfik, N. M. Al-Zidi, I. Fathail, S. Nimbhore, "Asthma Detection System: Machine and
  Deep Learning-Based Techniques," in *Artificial Intelligence and Sustainable Computing*
  (Algorithms for Intelligent Systems), Springer, 2022, pp. 207–218.
  - doi:10.1007/978-981-19-1653-3_16
  - Verified: Crossref record (content not read).
- **[R41]** Q. Zhang et al., "SPRSound: Open-Source SJTU Paediatric Respiratory Sound Database,"
  *IEEE TBioCAS* 16(5):867–881, 2022.
  - doi:10.1109/TBCAS.2022.3204910; https://github.com/SJTU-YONGFU-RESEARCH-GRP/SPRSound
  - Verified: Crossref record; GitHub page (labels, CC BY 4.0, inter/intra-subject test split, no
    diagnoses shown).
- **[R42]** F.-S. Hsu et al., "Benchmarking of eight recurrent neural network variants for breath
  phase and adventitious sound detection on a self-developed open-access lung sound
  database—HF_Lung_V1," *PLoS ONE* 16(7):e0254134, 2021.
  - doi:10.1371/journal.pone.0254134
  - Verified: contents, devices, 4 kHz sampling, missing TSECC patient information.
- **[R43]** G. Altan, Y. Kutlu, "RespiratoryDatabase@TR (COPD Severity Analysis)," Mendeley Data, V2,
  2020.
  - doi:10.17632/p9z4h98s6j.2
  - Verified: 12-channel recordings, COPD0–4 labels, CC BY 4.0.
- **[R44]** S. R. Hota, A. Roy, U. Satija, "ILD-VIT: A Unified Vision Transformer Architecture for
  Detection of Interstitial Lung Disease from Respiratory Sounds," 2025.
  - arXiv:2510.11458
  - Verified: abstract (BRACETS plus KAUH; subject-independent; 84.86% accuracy).
- **[R45]** Y. Zhang et al., "Towards Open Respiratory Acoustic Foundation Models: Pretraining and
  Benchmarking," NeurIPS 2024 Datasets & Benchmarks.
  - arXiv:2406.16148
  - Verified: task table; participant-independent splits for T7 and T10; AUROCs; pretraining
    datasets.
- **[R46]** S. Baur et al., "HeAR — Health Acoustic Representations," 2024.
  - arXiv:2403.02522
  - Verified: abstract; HTML (no auscultation tasks; device stability; TRILL/FRILL drop of up to
    12%).
- **[R47]** TensorFlow Model Garden, "YAMNet."
  - https://github.com/tensorflow/models/tree/master/research/audioset/yamnet
  - Verified: architecture, AudioSet, 521 classes, 16 kHz, 1024-d embedding.
- **[R48]** Q. Kong et al., "PANNs: Large-Scale Pretrained Audio Neural Networks for Audio Pattern
  Recognition."
  - arXiv:1912.10211
  - Verified: abstract (AudioSet mAP 0.439).
- **[R49]** Y. Gong, Y.-A. Chung, J. Glass, "AST: Audio Spectrogram Transformer," INTERSPEECH 2021.
  - arXiv:2104.01778
  - Verified: abstract.
- **[R50]** B. M. Rocha et al., "A Respiratory Sound Database for the Development of Automated
  Classification," *IFMBE Proceedings* (ICBHI 2017), Springer, pp. 33–37.
  - doi:10.1007/978-981-10-7419-6_6
  - Verified: Crossref record only.
- **[R50b]** S. Chen et al., "BEATs: Audio Pre-Training with Acoustic Tokenizers."
  - arXiv:2212.09058
  - Verified: abstract.
- **[R51]** J.-W. Kim, M. Toikkanen, Y. Choi, S.-E. Moon, H.-Y. Jung, "BTS: Bridging Text and Sound
  Modalities for Metadata-Aided Respiratory Sound Classification," INTERSPEECH 2024.
  - arXiv:2406.06786
  - Verified: abstract (metadata includes device type and recording location).
- **[R52]** I. Moummad, N. Farrugia, "Pretraining Respiratory Sound Representations using Metadata
  and Contrastive Learning."
  - arXiv:2210.16192
  - Verified: abstract (sex and age metadata).
- **[R53]** J.-W. Kim et al., "RepAugment: Input-Agnostic Representation-Level Augmentation for
  Respiratory Sound Classification," EMBC 2024.
  - arXiv:2405.02996
  - Verified: abstract.
- **[R54]** J. Acharya, A. Basu, "Deep Neural Network for Respiratory Sound Classification in
  Wearable Devices Enabled by Patient Specific Model Tuning," *IEEE TBioCAS*, 2020.
  - doi:10.1109/TBCAS.2020.2981172
  - Verified: Crossref record only (content not read).
- **[R55]** M. Yang et al., "A device-invariant multi-modal learning framework for respiratory disease
  classification," *npj Digit. Med.* 9:290, 2026.
  - doi:10.1038/s41746-026-02445-4
  - Verified: Crossref record only (content not read; not used to support any statement).

### 9.2 Unverified leads

None of these could be opened or confirmed during this task. None of them is used to support any
statement above.

- ICBHI 2017 Challenge website (bhichallenge.med.auth.gr): expired TLS certificate. Licence and the
  official split file could not be checked directly.
- Rocha et al. 2019 full text: the 60/40 split definition and per-device/per-diagnosis tables are
  paywalled. The split is cited here via [R6] and [R12].
- Coswara cross-dataset result in *Sci. Rep.* 2025 ("Deep Learning-Driven Early Diagnosis of
  Respiratory Diseases using CNN-RNN Fusion on Lung Sound Data", doi:10.1038/s41598-025-28832-7):
  the page could not be opened.
- BRACETS dataset (bronchiectasis/COPD auscultation database): not opened.
- Formosa Archive of Breath Sound (FABS): only mentioned via [R23].
- SPRSound inter-subject vs intra-subject leaderboard scores (BioCAS 2022 grand-challenge summary):
  not found. This would be a direct measure of the patient-overlap effect on paediatric data.
- Han et al., "Sounds of COVID-19: exploring realistic performance of audio-based digital testing"
  (npj Digit. Med. 2022): not opened.
- Altan, Kutlu & Gökçen 2020, *Turkish J. Electr. Eng. Comput. Sci.* (RespiratoryDatabase@TR source
  paper): seen only in search snippets.
- Older ICBHI baselines cited inside [R7] and [R11] (Kochetov 2018; Chambres 2018; Ma et al. 2019/2020
  LungRN+NL; Jakovljević 2017; Serbes 2017): only their numbers as tabulated by [R7] and [R11] were
  seen.
- Badgeley et al. 2019 (hip-fracture confounders) and Oakden-Rayner et al. 2020 (hidden
  stratification): known analogues, not opened.
- CLAP (Elizalde et al. / LAION): used in [R45], [R51] and [R20]; the original paper was not opened.
- Aptekarev et al. 2026, "Transformer Architectures for Respiratory Sound Analysis and Multimodal
  Diagnosis" (arXiv:2601.14227): the abstract was opened (AST about 97% accuracy for asthma), but the
  dataset and split were not stated, so it is not used.
