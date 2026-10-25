# Readiness report

**Status: evidence complete for a first draft; not yet submitted.** Every Tier-1 and Tier-2 item is
done. The remaining work is writing, plus the optional items at the end. Updated 2026-10-25.

All claims below cite `CLAIM_EVIDENCE_MATRIX.csv`. Every number there is generated from artifact files
(`EXPERIMENT_LEDGER.csv`, `collect_evidence.py --check`) and was independently re-derived for C-01…C-20
(`AUDIT_REPORT.md`).

## Verified findings, by contribution

**(a) Audit of the Kaggle corpus**
- 631 clips are cuts of 187 ICBHI recordings, including all 401 COPD clips; 316 are cuts of 115 KAUH
  recordings; 264 have no traced origin; 12 are byte duplicates (C-04, C-05).
- Validation (C-16): synthetic recall 99/100; zero KAUH ↔ ICBHI false matches; a blind human check of
  the 20 hardest real cases agreed on all 19 decided pairs (exact CI 82.4–100%).
- The sources are disclosed by the uploader. Undisclosed: one recording became several clips with
  non-patient identifiers, and all of Kaggle's COPD is ICBHI audio. The earlier claim "more than
  disclosed" is withdrawn (C-20).
- KAUH itself has byte-identical files under conflicting diagnoses (C-21). The holdout is fixed (v2).

**(b) Consequence**
- Within one Kaggle-trained model, copied ICBHI COPD recordings score 81.1% vs clean 41.5% (+39.5
  [26.9, 50.9]). With a second training seed: +51.4 [38.9, 63.6] (C-18).
- Removing the copies from training drops copied healthy recordings from 96% to 15% (seed 43: 92% →
  35%) (C-19).

**(c) Leak decomposition of the 2020 protocol**
- The published code cannot run as released. Under every plausible reading of its undocumented
  choices, 0 of 80 runs reach the paper's lowest reported run, so 95.67% is not reproducible (C-02).
- Leak by leak, balanced accuracy goes 0.872 → 0.385 (chance 0.167). Augmented copies are the largest
  leak; test-set selection adds 7–11 points at every split unit (C-03, C-17).
- Leak-free, the 2020 network (0.384) does no better than a device-only rule (0.440) (C-23).

**(d) Source confounding**
- The source is decodable from every representation (C-07), even within one diagnosis (C-15), and
  from audio without breath sounds (C-26): an acquisition signature exists.
- A no-audio source + stethoscope rule reaches 84.1% recording accuracy against the model's 82.0%.
  Paired at patient level: model − rule +4.1 [−6.9, +16.1] (C-23).
- Normal vs abnormal: 0.94 in cohort, but 0.47–0.48 at the external KAUH site for models with no KAUH
  healthy or COPD patients in training (C-24).
- A source left out of training gives held-out AUROC of 0.38–0.59 in 9 of 12 cells (10 of 15 with AST;
  C-25, partly supported). The KAUH-site and ICBHI cells are confounded by construction (see risks).
  Leave-one-device-out is impossible (healthy ICBHI = Meditron only).
- The external failure is not explained by sample rate alone (C-09).
- Age is confounded with source and label: ICBHI healthy are all children, KAUH healthy are adults
  (C-27). Wording must be "site/acquisition/population confounding".
- A stronger model (frozen AST) is the best in cohort (78.3%) and has the highest dataset-of-origin probe
  (0.94); its unseen-source cell (KAUH site, AUROC 0.21) is confounded with file origin (C-29,
  exploratory, partly supported).
- Fine-tuning it did not help: 74.4% vs 78.3% frozen and 74.9% for the adopted fusion, with off-device
  COPD sensitivity 23 points below frozen AST (62.1% vs 85.3%, CI −37 to −10) but not distinguishable
  from the fusion (C-30, one seed, rules fixed in advance).

**(d2) Second independent external site (SPRSound, D-32/D-33/D-34; C-32…C-37)**
- 718 labelled children from a Shanghai hospital, different country, stethoscope and age group, audited for
  overlap (0 matches with ICBHI, KAUH or Kaggle V2). Rules and hypotheses were fixed before any model ran.
- The round-2b model scores balanced accuracy **0.19** over four classes (chance 0.25) and healthy-vs-diseased
  AUROC **0.47**; the previous model 0.26 and 0.55. H7 (no transfer) is supported for both.
- Round 2b is **worse** than the model before it at this site (−7.2 points, CI −11.3 to −3.3).
- Frozen YAMNet, OPERA-CE, HeAR and AST heads reach AUROC 0.50–0.55 here (0.82–0.96 within their own
  sources): H9 supported. This is a cleaner version of the leave-one-source-out result (C-25).
- The age-shortcut hypothesis is not supported (H8 inconclusive / refuted): the models do not simply call
  children healthy.
- The abstention rule fires on 96% (round 2b) of this site's recordings but cannot separate in-label from
  out-of-label patients (C-35).

**(e) Exploratory: within-site adaptation**
- With 21 KAUH patients in training: holdout v1 17/24, v2 16/22. Healthy 16/16, COPD 0/5 (C-10).
- Learning curve: healthy recall 0 → 0.94 as k goes 0 → 18; COPD stays at 0 (C-28).
- Out-of-label predictions moved from "asthma" to "healthy". This is site-dominant labelling, not
  cross-site generalization.

**Secondary / engineering**
- Abstention carries no out-of-label signal for models with no KAUH healthy/COPD training patients (C-12).
- The round-2b fusion was adopted under its fixed rule, but its gain over the reference is not
  significant after Holm (C-22).
- Served-model test result: 75.5% patient accuracy [63.3, 87.8] (C-13). Without the Kaggle remainder
  the balanced accuracy is 68.0%.

## Principal risks for reviewers
- **Small samples:**
  - 49 test patients;
  - 22–24 in-label holdout patients, only 5 with COPD;
  - C4 pneumonia rests on 6 patients;
  - per-class claims are kept to classes with ≥ 5 patients.
- **Two external sites** now (KAUH and SPRSound). KAUH is also the adaptation site, and SPRSound is
  paediatric only, without COPD and with a pneumonia-heavy inpatient population (62% of patients).
- **Re-used evaluation data:** the test split and the holdout were used twice for the round-2b
  configuration (D-24); the holdout was used diagnostically for X5 and the learning curve. Nothing was
  chosen on them; this is disclosed.
- **Leave-one-source-out cells are confounded by construction:** the KAUH-site group's normals are raw
  KAUH files while 29 of its 32 abnormal patients are Kaggle clips cut from KAUH; the ICBHI normals are
  Meditron-recorded children; the Kaggle remainder's filename-group "patients" may inflate within-cohort
  AUROCs (second audit).
- **Population confound (age)** cannot be separated from site/device with this data.
- **No clinical collaborators or prospective data.** The paper is a validity study.
- **The strong-model checks** are one frozen and one fine-tuned AST with a single seed and a fixed
  6-epoch budget (D-28); a longer or tuned fine-tune was not tried.

## Optional before submission
- A **second blind human rater** for the listening check, to report inter-rater agreement. The package is
  ready (`backend/artifacts/experiments/match_validation/listening_rater2.zip`: pairs, images, blank
  sheet, instructions, no first-rater answers); `listening_score.py` then reports agreement and kappa.
  A model cannot serve as this rater (it cannot hear, and the first scoring run printed the key).
  The fingerprint cross-check (C-31) is a second *method*, not a second rater.
- A **third external site** (adult, with COPD) if one becomes available; SPSC-HCM-16C has no public download.
- A fine-tune on **SPRSound** itself is deliberately not planned: it would turn the external set into a training set.

## Writing (next)
- `MANUSCRIPT_OUTLINE.md`: section plan with claim IDs for every result.
- `research/figures/`: figures 1–7, generated by `research/tools/figures.py`.
- `RELEASE.md` + `RELEASE_MANIFEST.csv`: data and code availability, with no audio.
- Candidate venues: *Scientific Data* (Analysis), NeurIPS Datasets & Benchmarks, *Physiological
  Measurement*; optionally a comment to *Life*.

## Independent audit (`AUDIT_REPORT.md`, D-26)
- 120 checks covering about 400 values, re-derived from the raw files (C-01…C-20).
- 113 matched, 2 mismatched and were corrected, and 2 statuses were corrected.
- It also found C-21.
- **Second pass** (`AUDIT_REPORT_2.md`, D-31): 82 checks over about 190 values for C-21…C-30, the changed
  notes, the new tables and the figures: 69 matched, 6 mismatched, 2 statuses not justified, 5 not
  checkable. All were corrected or qualified; the main ones were C-25 ("10 of 12" is 9 of 12 and its
  status is partly supported), the "without KAUH data" wording, C-29, C-30 and several figure problems.
  The coordinator re-derived the key numbers before changing anything.
- It also raised methodological risks for loso.py, learning_curve.py and source_baseline.py: the
  learning curve and the no-audio rule are clean (checked by patient, path and byte hash); the LOSO cells
  are confounded by construction (recorded under the principal risks).
- Claim C-31 (the fingerprint cross-check) was added after this pass.
