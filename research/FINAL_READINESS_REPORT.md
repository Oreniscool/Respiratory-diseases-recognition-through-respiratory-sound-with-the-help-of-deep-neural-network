# Readiness report

**Status: not ready for submission (milestone 1 of 5).** Updated 2026-10-23.

## Verified so far
- The original paper's protocol has three evaluation leaks (C-01).
- Public-dataset overlaps: 631 Kaggle V2 clips cut from ICBHI, 316 from KAUH; filename patient
  groups mix real patients (C-04, C-05).
- Labels are confounded with recording source and device, and probes decode the source more easily
  than the disease (C-06, C-07).
- Models trained on the confounded data fail completely on external KAUH healthy/COPD patients (C-08).

## Missing evidence for the central claims
- H1: the leakage ladder (X1) has not been run, so the size of the inflation is unmeasured.
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
X1 (leakage ladder), once the round-2b GPU queue finishes.
