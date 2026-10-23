# Readiness report

**Status: not ready for submission (milestones 1 and 3 of 5 done).** Updated 2026-10-23.

## Verified so far
- The original paper's protocol has three evaluation leaks (C-01).
- Public-dataset overlaps: 631 Kaggle V2 clips cut from ICBHI, 316 from KAUH; filename patient
  groups mix real patients (C-04, C-05).
- Labels are confounded with recording source and device, and probes decode the source more easily
  than the disease (C-06, C-07).
- Models trained on the confounded data fail completely on external KAUH healthy/COPD patients (C-08).

- **H1 (X1):** removing the three leaks of the 2021 protocol lowers mean accuracy from 0.878 to
  0.598 (paired drop 0.280, 20 seeds; balanced accuracy 0.872 → 0.385). However, the original protocol
  reached 0.878 rather than the reported 0.957 in our re-implementation (C-02 not met), so the paper's
  exact figure is not reproduced. The ladder measures the leaks' effect, not the paper's specific run.
- **X2 (preliminary):** ICBHI audio re-encoded in KAUH's 4 kHz format is not pushed toward "asthma",
  which points to a site/device shortcut rather than bandwidth (only 7 healthy recordings; rerun
  pending).

## Missing evidence for the central claims
- H2: the bandwidth explanation (X2) has not been excluded.
- H3: the source-mixing result on the KAUH holdout (X3) is pending; the holdout is small (23 in-label
  patients).

## Principal risks
- **Single external site,** small holdout; KAUH and ICBHI label definitions may differ.
- **No clinical collaborators** or prospective data. The paper must be framed as a methodological and
  validity study, not clinical performance.
- **3-fold CV with one seed** for most comparisons.
- Pending the literature and novelty reviews: novelty may be partial if random-split inflation on
  ICBHI is already documented.

## Next recommended experiment
X3: the round-2b model on the KAUH holdout (after the GPU queue), then the full X2 rerun.
