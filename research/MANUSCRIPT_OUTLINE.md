# Manuscript outline

Working title: **Provenance, leakage and source confounding in public lung-sound disease
benchmarks: an audit of a widely used Kaggle corpus and its consequences**

Status: outline, 2026-10-25. Every result sentence cites a claim ID in `CLAIM_EVIDENCE_MATRIX.csv`;
write nothing that has no claim ID. Numbers come from the matrix, not from memory. Safe wording for
each claim is in its `notes` column.

Candidate venues (from `NOVELTY_REVIEW.md` §5; fit only):
- *Scientific Data*, Analysis article;
- NeurIPS Datasets & Benchmarks;
- *Physiological Measurement*;
- optionally a short comment to *Life* on Kaggle → ICBHI "external" evaluations.

---

## Abstract (≈250 words)
Problem (public lung-sound corpora are merged and re-uploaded without provenance) → what we did
(cross-correlation audit, controlled re-evaluations, a leak decomposition of one published
protocol, source probes) → key numbers:
- 631/316 copied clips, all Kaggle COPD from ICBHI (C-04/05);
- copied vs clean +39.5 points (C-18);
- 0.957 not reproducible, leak-free balanced accuracy 0.385 (C-02/03);
- a no-audio rule rivals the models (C-23);
- external AUROC at chance (C-24).

→ recommendations.

## 1. Introduction
- Lung-sound classification and the role of public corpora: ICBHI 2017, KAUH (Fraiwan et al.),
  and the Kaggle "Asthma Detection Dataset V2" that redistributes both.
- Known issues, cited from `LITERATURE_REVIEW.md`:
  - patient-overlap inflation on ICBHI;
  - Pessoa et al. 2026 (replication collapse);
  - Ong Ly et al. 2024 (ICBHI → KAUH AUROC 0.60);
  - shortcut learning in medical AI.
- Gap: no quantified provenance audit of the merged Kaggle corpus, and no measurement of what
  that does to "external" evaluations.
- Contributions:
  - (a) audit;
  - (b) consequence;
  - (c) leak decomposition;
  - (d) source confounding;
  - (e) exploratory within-site adaptation.

## 2. Data
- Three sources. Label mapping: `LABEL_MAPPING.md`; units and definition mismatches: §4 there.
- Demographics (`DEMOGRAPHICS.md`): the ICBHI healthy class is entirely children, while KAUH
  healthy patients are adults. Age is confounded with source and label.
- The deployed research prototype and its pipeline go in a short methods appendix (engineering,
  not a contribution).

## 3. Audit of the Kaggle corpus (contribution a)
- **Method.** Band-limited normalized cross-correlation against every ICBHI/KAUH recording.
  Threshold 0.75, from the observed score gap (≥ 0.795 vs ≤ 0.697).
- **Validation (C-16):**
  - synthetic degraded cuts: recall 99/100;
  - zero KAUH ↔ ICBHI false matches;
  - blind human check of the 20 hardest real cases: 19/19 decided pairs agree.
- **Results:**
  - C-04: 631 clips from 187 ICBHI recordings, including all 401 COPD clips;
  - C-05: 316 clips from 115 KAUH recordings; filename "patients" mix real patients;
  - 264 clips of unknown provenance;
  - 12 byte duplicates.
- **What the uploader disclosed (C-20, wording!).** The sources are disclosed ("212 samples",
  "about 170 samples"). Not disclosed: one recording became several clips with non-patient
  identifiers, and all of Kaggle's COPD is ICBHI audio.
- **KAUH internal duplicates (C-21).** Byte-identical files under conflicting diagnoses.
- **Figure 1:** a Sankey/bar diagram of Kaggle clips by origin and class.

## 4. Consequence: "external ICBHI" evaluations re-test training audio (contribution b)
- **Design (C4):**
  - a Kaggle-only model, trained with and without the 631 copies;
  - all 920 ICBHI recordings scored and split into copied recording / copied patient / clean.
- **Results:**
  - C-18: within one model, COPD copied 81.1% vs clean 41.5% (+39.5 [26.9, 50.9]);
  - C-19: copied healthy recordings 96.2% → 15.4% without the copies;
  - replicated with a second seed: COPD +51.4 [38.9, 63.6].
- **Figure 2:** accuracy by copy status and class, with patient-bootstrap CIs.
- **Limitations:** uploader selection; class-set and training-size differences between the two
  models.

## 5. Leak decomposition of a published protocol (contribution c)
- **The 2020 protocol (C-01):** augmentation before the split, a random recording split, and
  checkpoint selection on the test set.
- **Reproduction:**
  - the published code cannot run as released;
  - the fidelity grid over its undocumented choices gives 0.79–0.88, and 0 of 80 runs reach the
    paper's lowest reported run (C-02);
  - keeping the best 10 of 20 runs adds about 2 points.
- **Ladder and factorial (C-03, C-17):**
  - balanced accuracy 0.872 → 0.385 (chance 0.167);
  - augmented copies are the largest leak;
  - test-set selection adds 7–11 points at every split unit;
  - leak-free accuracy equals the always-COPD baseline;
  - the device-only rule beats the leak-free network (C-23).
- **Figure 3:** ladder plot with baselines.

## 6. Source confounding (contribution d)
- **Probes (C-07, C-15):** the source is decodable from every representation, even within one
  diagnosis.
- **Non-breath probes (C-26):** the source stays decodable from the quietest frames and the 100 ms
  edges, i.e. an acquisition signature. Wording: "an acquisition signature exists that models can
  exploit".
- **No-audio rule (C-23):** source + device alone reaches 84.1% recording accuracy against the
  model's 82.0%.
- **Leave-one-source-out (C-25, partly supported):** held-out AUROC is 0.38–0.59 in 9 of 12 cells
  (CIs include 0.5 in 11); report with the confounding caveats (KAUH-site cell = file origin).
- **Stronger model (C-29, C-30):** frozen AST is best in cohort and has the highest dataset-of-origin
  probe; its unseen-source cell (0.21) is confounded with file origin. Fine-tuning it did not help
  (74.4% vs 78.3%) and has lower off-device COPD sensitivity than frozen AST (62% vs 85%) but not
  than the fusion.
- **External KAUH:**
  - models with no KAUH healthy/COPD patients in training: 0/45 (CI 0–7.9%), with normal-vs-abnormal AUROC 0.47–0.48 (C-08,
    C-24);
  - not explained by sample rate alone (C-09).
- **Competing explanations:** device, room, protocol, **age** (DEMOGRAPHICS, C-27) and label
  definitions.
  The design cannot separate them, so use "site/acquisition/population confounding".
- **Figure 4:** probe heatmap (full vs non-breath; within-label). **Figure 5:** LOSO AUROC.

## 7. Exploratory: within-site adaptation (contribution e)
- **X3 (C-10):**
  - 21 KAUH patients in training;
  - holdout v1 17/24, v2 16/22;
  - healthy 16/16 but COPD 0/5;
  - out-of-label predictions moved from asthma to healthy.
- **Learning curve (C-28):** healthy recall 0 → 0.94 as k goes 0 → 18; COPD stays at 0 (Figure 7).
- **Abstention (C-12):** no out-of-label signal for models with no KAUH healthy/COPD training patients.
- **Wording:** never "restores generalization".

## 8. Discussion
- **What the field should do:**
  - provenance manifests for re-uploads;
  - patient-level splits;
  - no-audio baselines next to every reported score;
  - source-stratified reporting;
  - an external site that contributes nothing to training.
- **Limits:**
  - one external site;
  - small classes;
  - one rater;
  - frozen AST rather than fine-tuned;
  - no clinical collaborators.

## 9. Data and code availability
Release package (`RELEASE.md`): overlap CSVs, manifests, frozen splits, tools, and the ledger
generator.

---

## Reviewer-risk checklist (from `NOVELTY_REVIEW.md` §3)
| Risk | Covered by |
|---|---|
| R1 power | exact and bootstrap CIs throughout; per-class claims only with ≥ 5 patients |
| R2 single external site | LOSO across three sources; claims narrowed |
| R3 label definitions | `LABEL_MAPPING.md`; demographics |
| R5 shortcut vs site | non-breath probes; wording "confounding" |
| R6 forking paths | pre-registered rules; MULT (Holm); all variants reported in the ledger |
| R7 reproduction | fidelity grid; code non-executability documented |
| R8 audit validity | synthetic recall, blind listening |
| R10 mitigation ≠ cross-site | X3 and learning curve labelled within-site |
| R11 KAUH replicas | audio-linkage fix (v2 holdout) |
