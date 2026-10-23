# Independent novelty review: leakage, source shortcuts and cross-site generalization in lung-sound disease classification

Reviewer stance: a skeptical journal referee. Written 2026-10-23 from web sources only. `research/LITERATURE_REVIEW.md` and the team's other research files were not read. No code was run.

The team's statements are treated as **claims to scrutinize**, not facts. Every source cited in sections 1 to 6 was opened during this review; section 8 records what was verified in each one. Anything only seen in search snippets, or not opened, is under **UNVERIFIED leads** (section 9) and is not relied on.

Note on coverage: a session limit on web fetching was hit near the end of the search. Some leads therefore could not be opened (listed in section 9), and a few likely relevant areas (heart-sound and COVID-cough audits beyond Coppock et al.) were only searched lightly. A full literature search before submission is still needed.

---

## 0. Verdict in one paragraph

The research question as framed ("how much of reported accuracy comes from leakage and source shortcuts, and does mixing sources restore cross-site generalization?") is **not novel as a headline**. Each of its parts has published precedent:

- patient-overlap inflation on ICBHI (Pham et al. 2020; Nguyen & Pernkopf 2021);
- a replication that corrects patient leakage in lung-sound disease classification (Pessoa et al., BIOSIGNALS 2026: 83.5% to 64.5%);
- device-as-domain bias in ICBHI (Kim et al., ICASSP 2024);
- ICBHI to KAUH external failure attributed to acquisition bias (Ong Ly et al., npj Digit Med 2024: AUROC 0.97 to 0.60);
- cross-dataset collapse (Lungmix, 2024);
- site shortcuts in medical AI generally (Zech 2018; Howard 2021; DeGrave 2021; Coppock 2024).

What **is** new and publishable is narrower:

- **(a) the quantitative provenance audit of the Kaggle "Asthma Detection Dataset Version 2"**: how many clips are cuts of ICBHI and KAUH recordings, which source patients they map to, and the consequence that published "external ICBHI" evaluations of models trained on it are contaminated;
- **(b) a decomposed, uncertainty-quantified leakage ladder** for one heavily cited, leaderboard-listed protocol;
- **(c) evidence that disease labels in the commonly merged lung-sound corpora are confounded with source and device**, so that a merged-corpus classifier assigns a whole external site to one class.

A journal paper is worthwhile if it is **reframed as a dataset-audit and evaluation-validity paper**, with the mitigation experiment presented as a small, exploratory secondary analysis. As now framed it promises a causal answer ("does mixing restore generalization?") that one site, about 24 test patients and 9 KAUH COPD subjects in total cannot deliver.

---

## 1. Novelty by element

| # | Element | Rating | Basis (verified sources, section 8) |
|---|---|---|---|
| 1a | Random or recording-level splits inflate ICBHI results relative to patient-disjoint splits | **Already established** | Pham et al. 2020 [S2]: systems using the patient-disjoint ICBHI split "show considerably lower performance over all tasks than those following random splitting". Nguyen & Pernkopf 2021 [S3]: the official 60/40 split without common patients is "significantly lower" than random 80/20 with patient overlap. Official split defined in Rocha et al. 2019 [S1]. |
| 1b | Replicating a published lung-sound disease classifier and showing that patient-level separation collapses it | **Already established** | Pessoa et al., BIOSIGNALS 2026 [S4] replicate Fraiwan et al. 2021 (CNN+BDLSTM, ICBHI+KAUH, 6 classes). Accuracy is 83.5% with patient overlap and 64.5% with patient-isolated folds. They also name augmentation applied to the test set as a further leak (citing García-Ordás et al. 2020). |
| 1c | Stepwise "ladder" isolating (i) checkpoint selection on test, (ii) augmentation before the split, (iii) patient overlap, (iv) patient-level metrics with bootstrap CIs, applied to Basu & Rana 2020 | **Partially established (incremental)** | Each leak type is known (S2–S4, and Kapoor & Narayanan's leakage taxonomy [S16]). Decomposing them on one protocol, with seeds and CIs, is a modest methodological increment. It is not new knowledge. The original repository README [S5] itself says the best weights were chosen by "validation score", that 20 runs were made and 10 selected runs are shown (95.67% ± 0.77%), and that class supports are inconsistent (253 vs 256). These facts strengthen a reproducibility note but are not a research contribution in themselves. |
| 2a | 12 byte duplicates; filename "patient" IDs in Kaggle Asthma V2 are not real patient IDs | **Already established** | Saky et al., Life 2026 [S7] report "12 exact duplicate pairs" in Asthma V2. They say filename identifiers "are reused across disease folders and could not be verified as globally unique patient identifiers". Their identifier-aware protocol drops accuracy to 0.7136. |
| 2b | Asthma V2 contains ICBHI material and material from the KAUH/Fraiwan database | **Partially established (disclosed by the uploader)** | The Kaggle metadata [S6] lists the sources itself: "ICBHI dataset: 212 samples" and "Respiratory Sound Database: about 170 samples, DOI 10.1016/j.bbe.2020.11.003". That DOI is Fraiwan et al. 2021 (Biocybern Biomed Eng) [S8], which the KAUH Mendeley record [S9] links as its associated article. **The team must not describe the overlap as hidden.** What is new is the **extent and mapping**: the claimed 631 ICBHI-derived and 316 KAUH-derived clips, against the 212 and ~170 the description admits. |
| 2c | Consequence: published "external" evaluations using Asthma V2 are contaminated or mislabeled | **Novel (strongest contribution)** | Saky et al. [S7] train on Asthma V2 and run an "external domain-shift evaluation" on ICBHI without discussing overlap. Topaloglu et al. call the Kaggle data "ICBHI 2017", and the published comment by Dolu [S10] and the authors' reply [S11] show confusion about what the data are. None of these sources quantifies the overlap. |
| 2d | Method: normalized cross-correlation to find cross-dataset cuts | **Partially established (standard technique)** | Duplicate and leakage audits of public medical datasets are an established genre: Abhishek et al., Scientific Data 2025 [S17]; "Copycats", NeurIPS 2024 D&B, on Kaggle and HuggingFace redistribution [S18]. In lung sound I found **no** published cross-corpus audio-matching audit. |
| 3a | Lung-sound labels are confounded with recording device and site; models cluster by stethoscope | **Partially established** | Kim et al. 2024 [S12] treat each ICBHI stethoscope as a domain and report fine-tuned representations "clustered according to the stethoscopes". Rocha et al. [S1] document two sites (Portugal, Greece), several devices and three sample rates (4 kHz: 90; 10 kHz: 6; 44.1 kHz: 824). |
| 3b | ICBHI to KAUH external failure attributed to acquisition bias | **Already established** | Ong Ly et al. 2024 [S13] train on ICBHI and test on JUST/KAUH, normal vs abnormal: source AUROC 0.97, external 0.60. They estimate the external drop from a shuffled-input "data acquisition bias" score (0.91). |
| 3c | Linear probes showing dataset and device are more decodable than disease from MFCC and foundation-model embeddings (YAMNet, OPERA, HeAR) | **Partially established in method; novel in application** | The "name that dataset" logic dates to Torralba & Efros 2011 [S19]. Site detectability from features is in Zech et al. 2018 [S14] (hospital identified with 99.95% accuracy; sorting by hospital alone gives AUC 0.861) and Howard et al. 2021 [S15]. I found no lung-sound paper that probes respiratory foundation-model embeddings for dataset or device against disease. |
| 3d | A merged-corpus model predicts one class (asthma) for an entire external site | **Novel as a specific finding; expected given 3a–3b** | It follows directly from the label/source confound. A referee will see it as an illustration, not a discovery, unless it is tied to the audit (2c). |
| 4 | Adding some target-site patients to training restores cross-site performance | **Not established in lung sound (that I found); weak as designed** | Lungmix [S20] shows cross-dataset drops of more than 30% and an augmentation fix, not target-site mixing. In imaging, Zech et al. [S14] found joint MSH–NIH training did not generalize to a third site (internal 0.931, IU 0.815). Once KAUH patients are in training, testing on other KAUH patients is **within-site** evaluation, so it says nothing about cross-site generalization to an unseen site. |
| 5a | MFCC models vs frozen pretrained embeddings | **Partially established** | OPERA [S21] benchmarks foundation models, including on KAUH obstructive vs healthy (T10, AUROC around 0.60–0.74) and ICBHI COPD vs healthy (T7). Those are within-dataset, participant-independent splits, not cross-site. HeAR [S22] reports a 33-task benchmark. A cross-site comparison would be new but underpowered here. |
| 5b | Abstention or calibration on out-of-label patients | **Low novelty** | A generic OOD/selective-prediction analysis. Keep it as supplementary material. |

Relevant analogues in medical audio and AI: Coppock et al. 2024 [S23] (audio COVID classifiers: AUROC 0.846 unadjusted, 0.619 after matching on confounders) and DeGrave et al. 2021 [S24] (title: "AI for radiographic COVID-19 detection selects shortcuts over signal"; metadata only verified).

---

## 2. Baselines and comparisons a referee will demand

1. **Trivial baselines at every rung and on every test set.**
   - Majority class, and class prior by source.
   - A "source-only" classifier: predict disease from dataset/device identity alone, as with Zech's "sorting by hospital" AUC 0.861. If source alone matches the model, the model has learned nothing beyond source.
   - Note that ICBHI recordings are dominated by COPD (OPERA T7 lists 793 COPD vs 35 healthy samples [S21]). An accuracy of 0.598 must be shown against the majority rate *for the exact test composition used*.
2. **The original protocol, run verbatim.** Use the original repository at a pinned commit [S5], before the team's re-implementation (see section 4.1).
3. **Patient-disjoint baselines from the field.**
   - The official ICBHI 60/40 split [S1] with ICBHI-score reporting.
   - At least one modern strong model (an AST or BEATs-type fine-tune, as in Kim et al. [S12]) to show the conclusions do not depend on weak models.
4. **Published external-transfer numbers.**
   - Reproduce Ong Ly et al.'s ICBHI to KAUH normal/abnormal setup [S13] so the 0% result can be compared with their AUROC 0.60.
   - Reproduce the Asthma-V2-trained, ICBHI-tested setting of Saky et al. [S7] **with and without the overlapping clips**. This is the single most persuasive way to show the audit matters.
5. **Foundation-model baselines under the OPERA protocol.** Report YAMNet, OPERA and HeAR on OPERA's KAUH T10 split [S21] so the embedding numbers can be anchored. Note that OPERA was pretrained on ICBHI and HF Lung [S21]: OPERA embeddings evaluated on ICBHI test audio may be contaminated by pretraining.
6. **Domain-generalization baselines for the mitigation claim.**
   - Lungmix-style augmentation [S20].
   - Stethoscope-guided or adversarial domain training [S12].
   - Simple per-recording spectral normalization.
   - Leave-one-source-out training, so that "mixing sources" is compared with cheaper alternatives.

---

## 3. Likely referee objections and the analysis that answers each

| # | Objection | Control or analysis that answers it |
|---|---|---|
| R1 | **Statistical power.** Test sets of about 45 patients; external in-label holdout of 23 patients; KAUH contains only 9 COPD subjects in total (Fraiwan et al. [S9a]: Normal 35, Asthma 32, HF 21, COPD 9, Pneumonia 5, fibrosis 5, BRON 3, effusion 2). With around 100 samples, CV error bars are about ±10% (Varoquaux [S25]). | Report patient-level counts per class for every test set. Use exact (Clopper–Pearson) CIs. 0/45 still has an upper 95% bound of about 8%, so state it that way rather than as "0%". Use patient-cluster bootstrap. Avoid per-class claims for classes with fewer than about 5 test patients. Do a power or precision calculation for the mitigation comparison **before** looking at the pending results. |
| R2 | **Single external site.** Everything external is KAUH (one hospital, one device). | Narrow the claim to "fails on the one external site available". Use leave-one-source-out across the sources you do have: ICBHI-Portugal, ICBHI-Greece (both in Rocha et al. [S1]), KAUH and the Kaggle remainder. Also use leave-one-device-out within ICBHI. Name an additional public corpus (SPRSound, HF_Lung) as future work, or as an extra test if labels can be mapped. |
| R3 | **Label-definition mismatch.** KAUH filename "N" codes a *sound type*, while its diagnosis field is separate (Mendeley record [S9]: sound types I/E/W/C/N). "BRON" in KAUH, "bronchial" in Kaggle, and bronchiectasis/bronchiolitis in ICBHI are different entities. ICBHI "Healthy" and KAUH "Normal" may differ in age, setting and selection. Asthma is essentially absent from ICBHI. | Publish an explicit label-mapping table with the field each label comes from. Run a sensitivity analysis that drops ambiguous classes ("bronchial"/BRON). Run a binary normal-vs-abnormal analysis comparable to Ong Ly [S13]. Report demographics (age, sex) by source and label, and match on age where possible. |
| R4 | **Sample rate and bandwidth.** ICBHI itself mixes 4, 10 and 44.1 kHz [S1]. KAUH device filters emphasise 20–200, 100–500 or 50–500 Hz depending on mode [S9a]. | See section 4.2 for why the 4 kHz re-encoding control is insufficient alone. Add: (i) common band-limiting of *all* data (for example 100–1,000 Hz) before the shortcut probes; (ii) Littmann-filter emulation of ICBHI audio; (iii) analysis restricted to ICBHI's native 4 kHz recordings. |
| R5 | **Shortcut vs genuine site difference.** A "shortcut" (non-pathological acquisition cue) cannot be separated from real population differences (severity, comorbidity, age, recording protocol) with the current design. | (a) **Within-label source prediction**: e.g. ICBHI-COPD vs KAUH-COPD, and ICBHI-healthy vs KAUH-healthy. High decodability with the label held fixed points to acquisition cues. (b) **Within-source disease prediction** (KAUH only; ICBHI only), to show disease signal exists at all. (c) **Non-respiratory segments**: probe dataset identity from silence, the noise floor, or the first and last 100 ms. If source is decodable from non-breath audio, that is an acquisition signature. (d) The prediction rate of "asthma" for **KAUH out-of-label patients** (heart failure, fibrosis, effusion). If every KAUH diagnosis is called asthma, site rather than disease is driving the output. (e) Ong Ly's shuffled-input DABIS estimate [S13] as an independent check. Use the word "acquisition/site confounding" unless (c) is positive. |
| R6 | **Cherry-picking and garden of forking paths.** Many probes (3 embeddings, MFCC, several targets) and several model variants, with the KAUH holdout already consulted once. | Pre-register or time-stamp the analysis plan for the pending mitigation result. Report **all** probes and variants run. Apply multiplicity control (Holm, or report family-wise intervals). State explicitly that the external KAUH set has been used before (the 0% result) and is therefore no longer fully untouched for the mitigation decision. |
| R7 | **Reproducibility of the original protocol.** A re-implementation is not a reproduction. The original README [S5] reports a mean over 10 of 20 runs. | Run the original code at its original commit. Report the distribution over all 20 runs (or more), not a selected subset. Reconcile any gap (section 4.1). Release code, file lists, split seeds and the overlap CSV. |
| R8 | **Audit validity.** NCC matching can produce false positives (repetitive breathing, silence, clipped audio) and false negatives (resampling, filtering, gain). | Report the threshold, lag search, resampling, and a precision estimate from blind manual listening on a random sample of matches and of near-threshold non-matches. Report recall on synthetic cuts with known offsets. Reconcile 631/316 with the uploader's own "212 ICBHI" and "~170 Fraiwan" counts [S6]: are these recordings vs clips? |
| R9 | **The Kaggle remainder (57 "filename groups") has unknown provenance.** Patient grouping there is guesswork. | Run a sensitivity analysis that excludes the Kaggle remainder entirely, and one that treats each clip as its own patient (pessimistic for leakage) vs each filename group as a patient. |
| R10 | **The mitigation is not a cross-site test.** Training on 21 KAUH patients and testing on other KAUH patients measures within-site performance. | Reframe it as "target-site calibration/adaptation with k patients". Plot a learning curve over k (0, 5, 10, 21 patients) with patient-bootstrap CIs. Compare with the baselines in section 2 item 6. The "restore cross-site generalization" wording must go. |
| R11 | **KAUH filter replicas.** Each KAUH recording is exported three times with different filters [S9a]. | Confirm that all three replicas of a subject always sit on the same side of every split. Confirm the Kaggle KAUH-derived clips are mapped back to the subject, not the file. |
| R12 | **Is the ICBHI reference split itself clean?** Rocha et al. [S1] report 79 training and 49 test participants (128) against 126 participants in total. | Check whether any participant appears in both official partitions before using it as a "leak-free" reference. |

---

## 4. Scrutiny of the two new results

### 4.1 "Re-implementation reached 0.878, not 0.957; removing leaks one at a time gives 0.598 accuracy and balanced accuracy 0.872 → 0.385 (20 seeds per step)"

What a referee will still object to:

1. **The first rung does not reproduce the paper.** A 7.9-point gap at step 0 means the ladder starts from the team's protocol, not Basu & Rana's. The paper cannot then say how much of *the reported 95.67%* was leakage. Possible causes:
   - The original figure is a mean over 10 *selected* of 20 runs [S5]. The team should apply the same selection to its own runs to show whether selection explains the gap.
   - Different feature details (the README says "40 features" per file but does not say they were averaged [S5]).
   - Library versions.
   - The COPD subsampling ("at most three recording locations per patient" [S5]).

   Required: run the original code verbatim, or show line-by-line equivalence, and report the 20-run distribution including the selected-10 statistic.
2. **One ordering of a non-additive ladder.** Leaks interact. Augmentation-before-split matters more when the split is recording-level than when it is patient-level. A single sequence attributes the interaction to whichever step comes last. Required: a 2×2×2 factorial (or Shapley-style attribution) over the three leaks, with the same 20 seeds per cell.
3. **What do the 20 seeds vary?** If they vary only initialization and not the patient split, the spread understates the uncertainty. With 6 ICBHI classes and very few patients in the rare classes, a 25% patient-disjoint test set can contain 1–2 patients for some classes. Balanced accuracy then becomes extremely variable, and some classes may be missing from some splits. Required: seeds vary the split; report patient counts per class per split, the distribution (not just means), and paired differences between rungs.
4. **Compare with chance and majority.** Balanced accuracy 0.385 against a 6-class chance of 0.167, and accuracy 0.598 against the majority-class rate of the specific test composition. Without this, "0.598" cannot be judged.
5. **Was the "patient-level metrics with bootstrap CIs" rung reported?** The brief lists four rungs; the new result reports three. Patient-level aggregation and its CI should be included, or its omission explained.
6. **Novelty framing.** Given Pessoa et al. [S4] (83.5% → 64.5% on a closely related protocol), present this as confirmation plus a finer decomposition, not as a discovery.

### 4.2 "ICBHI re-encoded as 4 kHz WAV is rarely predicted asthma (COPD 0.9% → 4.0%, n=346; healthy 1/12), while KAUH healthy/COPD are nearly all predicted asthma, so the failure is site/device, not bandwidth"

What a referee will still object to:

1. **Sample rate is only one property of the device.** The Littmann 3200 exports bell, diaphragm or extended filter modes with different emphasis bands [S9a]. It also has its own transducer response and gain processing, and a Bluetooth export path. Downsampling ICBHI to 4 kHz removes content above 2 kHz but leaves its spectral tilt, noise floor and transducer response intact. The control rules out "Nyquist bandwidth" only. Required: Littmann-filter emulation (apply the bell, diaphragm and extended responses to ICBHI), plus spectral-tilt and noise-floor matching. Then repeat the test.
2. **The training set already contains native 4 kHz audio.** Rocha et al. [S1] report 90 ICBHI recordings at 4 kHz, and AUTH used a Littmann 3200 among other devices [S1]. If those COPD recordings were in training, the model has *already* learned that "4 kHz ICBHI-like audio is not asthma". The re-encoding test is then partly circular. Required: report the asthma rate separately for ICBHI's native 4 kHz / Littmann 3200 recordings vs re-encoded ones, and show where those recordings sat in the split.
3. **The healthy result is anecdotal.** 1 of 12 healthy recordings gives a 95% interval of roughly 0.2%–38%. Is n=346 recordings or patients? Results must be at patient level with CIs.
4. **The conclusion overreaches.** "Site/device rather than bandwidth" lumps several causes together: device, room, protocol, population (age, severity, comorbidity), and annotation practice. The data support "not explained by sample rate alone". Use the controls in R5. Above all, test whether **KAUH out-of-label patients (heart failure, fibrosis) are also called asthma**, and whether KAUH asthma patients held out from Kaggle-derived training clips are called asthma for the same reason.
5. **The training asthma class is itself KAUH-derived.** If asthma training audio is mostly KAUH-device audio (the brief says so), then "KAUH audio → asthma" is the expected consequence of the confound. The paper should present it as a demonstration of the confound, built on the audit, not as an independent finding.

---

## 5. Venues and article types (fit only; no acceptance implied)

- **Dataset-quality and audit papers.** *Scientific Data* published a dermatology dataset-quality audit (duplicates, train/test leakage, corrections) [S17]. NeurIPS Datasets & Benchmarks published "Copycats" on Kaggle and HuggingFace redistribution [S18]. The Asthma-V2 provenance audit, with a corrected manifest and overlap CSV, fits this genre best.
- **Reproducibility case studies.** BIOSIGNALS published exactly this kind of lung-sound replication [S4]. A reproducibility track (the ML Reproducibility Challenge via TMLR or NeurIPS; see the unverified leads) could host the leakage-ladder part, provided the original code is run verbatim.
- **Medical-AI validity journals.** *npj Digital Medicine* published the closest methodological precedent (Ong Ly et al. [S13]). *Physiological Measurement* published the ICBHI database paper [S1] and is a natural home for an ICBHI-centred evaluation critique. *Nature Machine Intelligence* published shortcut and confounding critiques (Coppock [S23], DeGrave [S24]). Those set a high bar of multi-site evidence that this study does not meet.
- **Letters or comments.** A short comment to journals that published Asthma-V2 "external ICBHI" results (Life [S7]; Adv Respir Med [S10, S11]) is a low-cost, high-relevance outlet for finding 2c.

---

## 6. Overall verdict and what must change

**Is the RQ worth a journal paper as framed?** No. The first half ("how much accuracy comes from leakage and shortcuts") has largely been answered in general form [S2–S4, S12–S14]. The second half ("does mixing sources restore cross-site generalization") cannot be answered with one external site, about 24 held-out in-label patients and 9 KAUH COPD subjects. Moving KAUH patients into training also turns the test into a within-site evaluation.

**A publishable reframing:** *"Provenance, leakage and source confounding in public lung-sound disease benchmarks: an audit of a widely used Kaggle corpus and its consequences."*

- Primary contributions: the audit (2b–2c) and its demonstrated consequences.
- Secondary contributions:
  - the factorial leakage decomposition on a leaderboard-listed protocol;
  - the source-vs-disease decodability analysis with within-label and non-breath controls.
- Exploratory: target-site adaptation with k patients, reported with honest CIs.

**Must add:**

1. A validated audit: blind listening precision, synthetic-cut recall, and reconciliation with the uploader's disclosed counts.
2. A re-run of at least one published Asthma-V2 "external" evaluation with and without the overlapping clips.
3. Verbatim reproduction of the original code, and a factorial ladder.
4. Majority-class and source-only baselines, patient-level exact or bootstrap CIs, and multiplicity control.
5. Within-label source probes, non-breath-segment probes, and the out-of-label KAUH asthma rate.
6. A label-mapping table and demographic comparison.
7. Leave-one-source-out and leave-one-device-out analyses.

**Must narrow or drop:**

- "restores cross-site generalization" (replace with "target-site adaptation");
- "shortcut" (replace with "acquisition/site confounding" unless the non-breath controls are positive);
- "the failure is device, not bandwidth" (replace with "not explained by sample rate alone");
- any per-class external claim based on fewer than about 5 patients.

---

## 7. Mandatory controls (reviewer's top three)

1. **Decompose site from disease:**
   - within-label source decoding (same diagnosis, different source);
   - within-source disease decoding;
   - source decoding from non-breath segments;
   - the "asthma" rate on KAUH out-of-label patients;
   - leave-one-source-out / leave-one-device-out evaluation.
2. **Baselines and honest uncertainty everywhere:**
   - majority-class and source-only predictors on every test set;
   - patient-level metrics with exact or cluster-bootstrap CIs (0/45 reported as 0–8%);
   - a power statement fixed before the pending mitigation result;
   - all probes reported, with multiplicity control.
3. **Reproduction fidelity and audit consequence:**
   - the original Basu & Rana code run verbatim, reconciling 0.878 vs 0.957, including the "10 of 20 runs" selection;
   - a 2×2×2 factorial leak decomposition with splits varied across seeds;
   - a re-run of a published Asthma-V2 → ICBHI "external" evaluation with and without the 631 overlapping clips, after a validated NCC audit (manual precision, synthetic recall).

---

## 8. Verified sources (opened during this review)

- **[S1] Rocha B.M. et al., "An open access database for the evaluation of respiratory sound classification algorithms", Physiol. Meas. 2019, DOI 10.1088/1361-6579/ab03ea.** Accepted manuscript PDF: https://eden.dei.uc.pt/~ruipedro/publications/Journals/PMEA_2019_Rocha.pdf. Verified:
  - 920 recordings from 126 participants;
  - sites in Portugal (Aveiro/Porto) and Greece (Thessaloniki/Imathia);
  - devices: Littmann Classic II SE, AKG C417 microphones, WelchAllyn Meditron, Littmann 3200;
  - sample rates: 4 kHz (90 recordings), 10 kHz (6), 44.1 kHz (824);
  - challenge split of about 60/40 with 79 training and 49 test participants (sum 128 against 126).
- **[S2] Pham L. et al., "CNN-MoE based framework for classification of respiratory anomalies and lung disease detection", arXiv:2004.04072.** Verified the quote that systems following the patient-disjoint ICBHI split "show considerably lower performance over all tasks than those following random splitting", and that several papers split ICBHI randomly.
- **[S3] Nguyen T., Pernkopf F., "Lung Sound Classification Using Co-tuning and Stochastic Normalization", arXiv:2108.01991.** Verified: performance on the official 60/40 split without common patients is "significantly lower" than random 80/20 / 5-fold with patient overlap.
- **[S4] Pessoa D., Garcia J., De La Torre-Cruz J., Cañadas-Quesada F., Paiva R.P., "Automated Diagnosis of Respiratory Diseases from Respiratory Sounds: A Reproducibility Case Study", BIOSIGNALS 2026.** PDF: https://eden.dei.uc.pt/~ruipedro/publications/Conferences/BIOSIGNALS_2026_Pessoa.pdf. Verified:
  - replication of Fraiwan et al. 2021a (CNN+BDLSTM; ICBHI + KAUH; 6 classes);
  - accuracy 83.5% without patient isolation vs 64.5% with patient-isolated folds;
  - names augmentation applied to the test set (García-Ordás et al. 2020) as a further leak;
  - discusses device and recording-condition biases.
- **[S5] Original repository README**, https://github.com/victor369basu/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network. Verified:
  - ICBHI with 6 classes (asthma and LRTI removed);
  - 40 MFCC features per file (averaging not stated);
  - noise/shift/stretch augmentation to balance classes; COPD limited to three locations per patient;
  - best weights selected by "validation score"; 20 runs with 10 selected runs shown;
  - 95.67% ± 0.77% accuracy; support total 253 vs per-class sum 256;
  - citation: CINE 2020, DOI 10.1109/CINE48825.2020.234388.

  Paper listing at https://hyper.ai/en/papers/respiratory-diseases-recognition-through (verified: authors Rana and Basu, link to IEEE Xplore 9080747, abstract without numbers).
- **[S6] Kaggle API metadata for "Asthma Detection Dataset Version 2"**, https://www.kaggle.com/api/v1/datasets/view/mohammedtawfikmusaed/asthma-detection-dataset-version-2. Verified:
  - 5 classes; the description claims 1,211 samples while the listed class counts sum to 1,181;
  - sources stated as "ICBHI dataset: 212 samples", "Respiratory Sound Database: about 170 samples, DOI 10.1016/j.bbe.2020.11.003", the rest from patient recordings;
  - inconsistent descriptions (22 vs 18 patients; 1.5–5 s vs 5–6 s);
  - cites Tawfik et al. 2022 (DOI 10.1007/978-981-19-1653-3_16, metadata confirmed via https://api.crossref.org/works/10.1007/978-981-19-1653-3_16).
- **[S7] Saky S.M.A.I. et al., "Explainable Multi-Modal Deep Learning for Recording-Level Classification of Respiratory Audio Signals Under Internal and Domain-Shift Evaluation", Life 2026;16(7):1108, DOI 10.3390/life16071108**, https://pmc.ncbi.nlm.nih.gov/articles/PMC13413210/. Verified:
  - trained on Asthma V2; "external" tests on ICBHI and RespiratoryDatabase@TR;
  - 12 exact duplicate pairs and 171 clipped recordings;
  - filename identifiers not unique patient IDs; patient-level separation "could not be confirmed";
  - identifier-aware accuracy 0.7136;
  - ICBHI healthy-vs-disease balanced accuracy 0.50 with healthy specificity 0;
  - no discussion of overlap between Asthma V2 and ICBHI or KAUH.

  Related preprint: arXiv:2512.00563 (verified abstract: 91.21% accuracy on Asthma V2).
- **[S8] Fraiwan L. et al., "Automatic identification of respiratory diseases from stethoscopic lung sound signals using ensemble classifiers", Biocybern. Biomed. Eng. 41(1):1–14, 2021, DOI 10.1016/j.bbe.2020.11.003.** Bibliographic metadata only, via https://api.crossref.org/works/10.1016/j.bbe.2020.11.003. The abstract was not accessible.
- **[S9] KAUH dataset, Mendeley Data**, https://data.mendeley.com/datasets/jwyy9np4gv/3 (DOI 10.17632/jwyy9np4gv.3). Verified:
  - Littmann 3200 over Bluetooth;
  - filter modes bell, diaphragm and extended;
  - sound-type codes I/E/W/C/N; patients P1–P112; CC BY 4.0;
  - linked article DOI 10.1016/j.bbe.2020.11.003.
- **[S9a] Fraiwan M. et al., "A dataset of lung sounds recorded from the chest wall using an electronic stethoscope", Data in Brief 35:106913 (2021)**, https://pmc.ncbi.nlm.nih.gov/articles/PMC7937981/. Verified:
  - 112 subjects (35 normal; asthma 32; heart failure 21; COPD 9; pneumonia 5; lung fibrosis 5; BRON 3; pleural effusion 2);
  - recordings 5–30 s; each replicated three times with different filters;
  - King Abdullah University Hospital;
  - sample rate **not** stated.
- **[S10] Dolu K.O., "Comment on Topaloglu et al. …", Adv. Respir. Med. 2026;94(2):15, DOI 10.3390/arm94020015**, https://pmc.ncbi.nlm.nih.gov/articles/PMC13010678/. Verified: questions the provenance of an "ICBHI 2017" external set that points to Kaggle "Asthma Detection Dataset Version 2 (ICBHI 2017)", and questions non-nested preprocessing. It does not mention KAUH or overlap.
- **[S11] Topaloglu I. et al., Reply, Adv. Respir. Med. 2026 (arm-94-00016)**, https://mdpi-res.com/d_attachment/arm/arm-94-00016/article_deploy/arm-94-00016.pdf. Verified: the authors state the "ICBHI 2017" external validation used a manually selected asthma/healthy subset, "ICBHI-derived".
- **[S12] Kim J.-W., Bae S., Cho W.-Y., Lee B., Jung H.-Y., "Stethoscope-guided Supervised Contrastive Learning for Cross-domain Adaptation on Respiratory Sound Classification", ICASSP 2024, arXiv:2312.09603**, https://arxiv.org/html/2312.09603v1. Verified:
  - each stethoscope treated as a domain;
  - AKG C417L is about 63% of cycles; no LittC2SE in the test set;
  - fine-tuned representations cluster by stethoscope.
- **[S13] Ong Ly C. et al., "Shortcut learning in medical AI hinders generalization: method for estimating AI model generalization without external data", npj Digit. Med. 2024;7:124, DOI 10.1038/s41746-024-01118-4**, https://pmc.ncbi.nlm.nih.gov/articles/PMC11094145/. Verified:
  - ICBHI (source) to JUST/KAUH (external), normal vs abnormal, ResNet-34 on mel-spectrograms;
  - source AUROC 0.97, shuffled-input estimate 0.91, external 0.60 [0.38–0.81];
  - headline: performance overestimated by up to 20% on average from data-acquisition bias.
- **[S14] Zech J.R. et al., "Variable generalization performance of a deep learning model to detect pneumonia in chest radiographs", PLOS Med 2018, DOI 10.1371/journal.pmed.1002683**, https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002683. Verified:
  - hospital system identified with 99.95% accuracy (NIH);
  - joint MSH–NIH model AUC 0.931 internal vs 0.815 at IU;
  - sorting by hospital alone gives AUC 0.861.
- **[S15] Howard F.M. et al., "The impact of site-specific digital histology signatures on deep learning model accuracy and bias", Nat. Commun. 12:4423 (2021), DOI 10.1038/s41467-021-24698-1**, https://ideas.repec.org/a/nat/natcom/v12y2021i1d10.1038_s41467-021-24698-1.html. Verified: site is easily identified by deep learning, and site signatures lead to overoptimistic estimates.
- **[S16] Kapoor S., Narayanan A., "Leakage and the Reproducibility Crisis in ML-based Science", arXiv:2207.07048**, https://arxiv.org/abs/2207.07048. Verified: a taxonomy of eight leakage types; 17 fields; 329 papers affected. The published venue was not verified on that page.
- **[S17] Abhishek K., Jain A., Hamarneh G., "Investigating the Quality of DermaMNIST and Fitzpatrick17k Dermatological Image Datasets", Scientific Data 12:196 (2025), arXiv:2401.14497**, https://arxiv.org/abs/2401.14497. Verified: an audit of duplicates and train/test leakage, with proposed corrections.
- **[S18] Jiménez-Sánchez A. et al., "Copycats: the many lives of a publicly available medical imaging dataset", NeurIPS 2024 Datasets & Benchmarks**, https://neurips.cc/virtual/2024/poster/97652. Verified: duplicates and missing metadata on Kaggle and HuggingFace; criticism of platform governance.
- **[S19] Torralba A., Efros A.A., "Unbiased Look at Dataset Bias", CVPR 2011, DOI 10.1109/CVPR.2011.5995347**, https://mlanthology.org/cvpr/2011/torralba2011cvpr-unbiased. Bibliographic details and abstract verified.
- **[S20] Ge S. et al., "Lungmix: A Mixup-Based Strategy for Generalization in Respiratory Sound Classification", arXiv:2501.00064**, https://arxiv.org/pdf/2501.00064. Verified: models trained on one of ICBHI, SPR or HF "often fail to generalize", with degradation of more than 30% in some cases.
- **[S21] Zhang Y. et al., "Towards Open Respiratory Acoustic Foundation Models: Pretraining and Benchmarking" (OPERA), NeurIPS 2024 D&B**, https://proceedings.neurips.cc/paper_files/paper/2024/hash/2f803abdcad9de35b45d5a656dade45c-Abstract.html and https://arxiv.org/html/2406.16148. Verified:
  - 19 tasks; T7 ICBHI COPD vs healthy (793/35); T10 KAUH obstructive vs healthy (129/105);
  - participant-independent splits; AUROC values per model;
  - pretraining data include ICBHI and HF Lung; KAUH is unseen.
- **[S22] Baur S. et al., "HeAR – Health Acoustic Representations", arXiv:2403.02522**, https://arxiv.org/abs/2403.02522. Verified: 313M two-second clips; 33 tasks across 6 datasets. The abstract makes no device-robustness claim.
- **[S23] Coppock H. et al., "Audio-based AI classifiers show no evidence of improved COVID-19 screening over simple symptoms checkers", Nat. Mach. Intell. 2024 (arXiv:2212.08570)**, https://arxiv.org/abs/2212.08570. Verified: AUROC 0.846 unadjusted vs 0.619 after matching on confounders.
- **[S24] DeGrave A.J., Janizek J.D., Lee S.-I., "AI for radiographic COVID-19 detection selects shortcuts over signal", Nat. Mach. Intell. 3:610–619 (2021), DOI 10.1038/s42256-021-00338-7.** Metadata only, via https://api.crossref.org/works/10.1038/s42256-021-00338-7. The content was not read beyond the title.
- **[S25] Varoquaux G., "Cross-validation failure: small sample sizes lead to large error bars", arXiv:1706.07581**, https://arxiv.org/abs/1706.07581. Verified: "±10% for 100 samples".
- **Analogous leakage-review precedent (verified abstract):** Wen J. et al., "Convolutional Neural Networks for Classification of Alzheimer's Disease: Overview and Reproducible Evaluation", Medical Image Analysis 2020, arXiv:1904.07773. More than half of the surveyed papers may have suffered from data leakage.

## 9. UNVERIFIED leads (not opened or not readable; not relied on)

- A HyperAI "ICBHI" SOTA leaderboard reportedly lists the Rana & Basu GRU at 95.7 next to entries at 98.7–99.6 (search snippet; page returned HTTP 429). If confirmed, it shows that leakage-inflated numbers reach leaderboards, which is useful motivation.
- Le et al. (ML-TCN, Glasgow; eprints.gla.ac.uk/350632): a scoping review snippet says recording-level splitting exceeded patient-level splitting by up to about 12 points on ICBHI.
- A scoping review in *Technologies* 2026, DOI 10.3390/technologies14080486 (HTTP 403). Snippets mention label–device confounding (PKU dataset: healthy and patients recorded on different devices) and a systematic review in which ICBHI was used in about two-thirds of 62 studies with high risk of bias.
- Koo et al., federated domain generalization with leave-one-device-out on ICBHI and SPRSound (seen only on aggregators).
- Fraiwan et al. 2021 (BBE, [S8]): the snippet says they combined KAUH with ICBHI recordings to balance classes. The abstract was not opened.
- "Hybrid deep learning and YAMNet features for asthma diagnosis from respiratory sounds" (PMC13128869): uses Asthma V2 with YAMNet. The page was blocked by a captcha.
- Applied Sciences 15(17):9361: trained on ICBHI + KAUH (snippet only).
- MLRC 2026 as an official NeurIPS track, and MLRC papers via TMLR (NeurIPS blog seen only in search results; the fetch failed on the session limit). Verify before targeting.
- The ICBHI 2017 challenge site (bhichallenge.med.auth.gr): expired certificate, not read.
- HF_Lung V1/V2 papers (arXiv:2102.03049, 2102.04062): snippets say the Littmann 3200 records at 4,000 Hz. That is for HF_Lung, not KAUH. **The claim that KAUH is 4 kHz was not verified in any KAUH source; check it from the WAV headers.**
- A practitioner GitHub repo (pedramebd/lung-sound-classification) giving informal ICBHI ranges (random split 85–99%, official split 55–72%). Not peer-reviewed.
