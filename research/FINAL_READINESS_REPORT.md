# Readiness report

**Status: not ready for submission.** The core evidence for the dataset-audit and evaluation-validity
paper (RQ v2, D-22) is in place. Tier-1 gaps remain (below). Updated 2026-10-23, 18:40.

Milestones (RESEARCH_PLAN §7):
1. Governance and reviews: done.
2. X1 and the factorial: done.
3. Round 2b: done (served model EXP-016, X3).
4. v2 controls: done (listening check 19/19, 2026-10-23).
5. Independent audit: done (D-26), see the last section.

## Verified (claim IDs in `CLAIM_EVIDENCE_MATRIX.csv`)

**(a) Audit**
- 631 Kaggle V2 clips are cuts of 187 ICBHI recordings, including all 401 Kaggle COPD clips.
  316 clips are cuts of 115 KAUH recordings. Filename "patients" mix real patients (C-04, C-05).
- The detector found 99 of 100 synthetic degraded cuts, so these counts are lower bounds. A blind
  human listening check of the 20 hardest real cases agreed with the detector on all 19 decided pairs
  (exact CI 82.4–100%, one rater, 1 unsure) (C-16).
- The uploader discloses the sources ("212 samples", "about 170 samples"). The claim that the copying
  exceeds the disclosure is withdrawn because it depends on the unit (C-20, D-25). What is
  undocumented: recordings cut into several clips presented as separate samples with non-patient
  identifiers, and all of Kaggle's COPD being ICBHI audio.

**(b) Consequence (C4)**
- Within one Kaggle-V2-trained model, ICBHI COPD recordings that were copied into Kaggle are
  classified correctly 81.1% of the time (26 patients), clean ones 41.5% (38 patients): +39.5 points,
  patient-bootstrap CI 26.9–50.9 (C-18). Bronchial: +49.3 [23.4, 82.1].
- Trained without the copies, accuracy on copied healthy recordings falls from 96.2% to 15.4% (C-19).
- A "train on Kaggle V2, test on ICBHI" evaluation largely re-tests training audio.

**(c) Leakage decomposition (X1 + factorial)**
- The 2021 protocol re-implemented: balanced accuracy 0.872 with its leaks, 0.385 leak-free (chance
  0.167, 20 seeds each; C-03). Leak-free accuracy equals the always-COPD baseline.
- Factorial (C-17), balanced accuracy selected on validation:
  - sample-level split 0.799 → recording-level 0.511 (−0.287) → patient-level 0.384 (−0.127);
  - test-set checkpoint selection adds +0.07 to +0.11 at every split unit.
- The reported 0.957 is **not** reproduced: the faithful re-implementation reaches 0.878 (C-02 not
  met).

**(d) Source confounding**
- Labels are confounded with source and device (C-06). Probes decode the source more easily than the
  disease (C-07).
- Even within a single diagnosis, the source is predictable: healthy ICBHI vs Kaggle vs KAUH 0.82–0.96
  against chance 0.33 (C-15).
- Models trained without KAUH audio fail on external KAUH patients: 0/45, exact CI 0–7.9% (C-08).
- Not explained by sample rate alone: ICBHI audio re-encoded at 4 kHz is called asthma for COPD only
  4.0% of the time, CI 2.2–6.7% (C-09).

**(e) Exploratory: within-site adaptation (X3, EXP-017)**
- With 21 KAUH patients in training, the held-out KAUH patients score 17/24 vs 0/24 before.
- Only healthy improves (17/18); COPD stays 0/5, and balanced accuracy is 31.5%.
- Out-of-label KAUH predictions moved from "asthma" to "healthy". The model follows the site's
  dominant training label, not the disease.
- H3 is partly supported (C-10). It is never to be presented as cross-site generalization.

**Secondary**
- Abstention does not flag out-of-label audio without site exposure. After round 2b the gap is
  +18.4 points [2.8, 33.6] (X5, C-12).
- In-cohort test result of the served model: 75.5% patient accuracy (CI 63.3–87.8%), in-cohort only
  (EXP-016, C-13).

## Tier-1 gaps (not submittable without these)
1. **The original 2020 code run verbatim** at `3ec7dc6`, over all 20 runs (the README reports 10
   selected runs). Needed to explain 0.957 vs 0.878: run selection, test-set checkpointing, or a
   difference in the re-implementation.
2. **Source-only baseline** on every test set, and **multiplicity control** over the probes and
   variants.
3. ~~Blind listening check~~ **done** (19/19 decided pairs agree). A second independent rater is
   optional but would allow inter-rater agreement.
4. **Label-mapping table** with the field each label comes from (KAUH "N" appears in both the
   diagnosis and sound-type columns; BRON ≠ bronchial ≠ bronchiectasis).
5. **Audio-linked KAUH patients on one side of every split** (C-21). `kauh.split_for_training`
   groups by patient ID only. The next split version must merge patients that share identical audio
   and report how the KAUH duplicates are handled.

## Tier-2 gaps (strongly expected by referees)
- Probes on non-breath segments. These decide "shortcut" vs "acquisition/site confounding" wording.
- Leave-one-source-out / leave-one-device-out evaluation.
- A binary normal-vs-abnormal analysis comparable to Ong Ly et al. 2024.
- Sensitivity analysis excluding the Kaggle remainder (unknown provenance).
- One more seed for the C4 models.

## Principal risks
- **Small samples everywhere:**
  - 49 test patients (±12 points);
  - 24 in-label KAUH holdout patients with only 5 COPD;
  - C4 pneumonia rests on 6 patients.
- **A single external site.** KAUH is also the only site with in-label adaptation data.
- **Re-used evaluation data:**
  - The test split and the KAUH holdout were each used twice for the round-2b configuration, once
    for the superseded artifact (EXP-015, D-24). The configuration was fixed, so nothing was chosen.
  - The KAUH set was consulted before round 2b (EXP-011/013).
- **Engineering defects found late, both fixed and recorded:**
  - TF32 in exported heads (EXP-014, D-23);
  - served weights ≠ evaluated weights (EXP-015, D-24), which also affects the previously served
    model's file.
  - The paper's methods section must describe the final pipeline, not the earlier runs.
- **No clinical collaborators** or prospective data. The paper is a methodological and validity
  study.

## Recommended next steps
1. Run the 2020 code verbatim (CPU, overnight).
2. Add the source-only baselines and multiplicity control.
3. Collect the listening-check answers, then write the label-mapping table.
4. Draft the manuscript outline (working title in `NOVELTY_REVIEW.md` §6).

## Independent audit (done; `AUDIT_REPORT.md`, D-26)
- 120 checks covering about 400 values, re-derived from raw artifact files.
- 113 matched, 2 mismatched, 2 had statuses their criteria did not support, and 3 could not be
  checked from files.
- All of CLAUDE.md §6, report §9.2 and the nine spot-checked ledger rows matched exactly.
- All corrections are applied (C-06, C-13, C-17, C-19, EXP-010), together with wording notes on C-07,
  C-09 and C-14.
- The audit also found **C-21**: byte-identical KAUH files filed under conflicting diagnoses. It
  leaks 3 recordings into the holdout. The sensitivity result is 18/24 vs 17/24 registered, and COPD
  stays 0/5.
- The coordinator verified each point.
