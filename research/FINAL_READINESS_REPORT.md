# Readiness report

**Status: not ready for submission (milestones 1 and 3 of 5 done).** Updated 2026-10-23.

## Verified so far
- The original paper's protocol has three evaluation leaks (C-01).
- Public-dataset overlaps: 631 Kaggle V2 clips cut from ICBHI, 316 from KAUH; filename patient
  groups mix real patients (C-04, C-05).
- Labels are confounded with recording source and device, and probes decode the source more easily
  than the disease (C-06, C-07).
- Models trained on the confounded data fail completely on external KAUH healthy/COPD patients (C-08).

- **H1 (X1):** removing the three leaks of the 2021 protocol lowers balanced accuracy from 0.872 to
  0.385 (chance 0.167; 20 seeds). Leak-free accuracy (0.598) equals the always-COPD baseline (0.591).
  The original protocol reached 0.878 rather than the reported 0.957 (C-02 not met), so the paper's
  exact figure is not reproduced.
- **X2 (preliminary):** ICBHI audio re-encoded in KAUH's 4 kHz format is not pushed toward "asthma",
  which points to a site/device shortcut rather than bandwidth (only 7 healthy recordings; rerun
  pending).

## Missing evidence for the central claims
- H2: the bandwidth explanation (X2) has not been excluded.
- H3: the source-mixing result on the KAUH holdout (X3) is pending; the holdout is small (23 in-label
  patients).

## Novelty (from the two independent reviews, sources spot-checked)
Leakage inflation on ICBHI, a leak-corrected reproduction of a lung-sound model, device effects and
an ICBHI → KAUH external drop are already published. Defensible contributions are narrower:
- the measured contamination of Kaggle Asthma V2: 631 ICBHI + 316 KAUH cuts, mapped to source
  patients, against ~212/~170 disclosed;
- its effect on published "external" evaluations;
- a leak-by-leak breakdown of one published protocol with constant-guess baselines;
- disease-level source confounding with a bandwidth control.

The mandatory controls the reviews list are still to do:
- a factorial (2×2×2) leak design;
- within-label source probes;
- exact or cluster confidence intervals;
- validating the cross-correlation matches (blind listening, synthetic cuts);
- re-running an Asthma V2 → ICBHI "external" evaluation with and without the copies.

## Principal risks
- **Single external site,** small holdout; KAUH and ICBHI label definitions may differ.
- **No clinical collaborators** or prospective data. The paper must be framed as a methodological and
  validity study, not clinical performance.
- **3-fold CV with one seed** for most comparisons.
- Pending the literature and novelty reviews: novelty may be partial if random-split inflation on
  ICBHI is already documented.

## Next recommended experiment
X3: the round-2b model on the KAUH holdout (after the GPU queue), then the full X2 rerun.
