# Paper Chapter Plan + INSIGHT Collection

Produced 2026-11-01 in academic-paper `plan` mode (Socratic dialogue). All positions below are the
author's own words or decisions; items marked **[verify]** or **[open]** are unresolved.
Numbers come from `research/CLAIM_EVIDENCE_MATRIX.csv` and `backend/data/kaggle_icbhi_overlap.summary.json`.

**Format:** institution template (`documentation/format_example/`): IEEEtran two-column, numeric
`thebibliography`, headings Introduction, Literature Review, Methodology, Result and analysis,
Conclusion and future work. No Discussion/Limitations section: limitations go at the end of Result and
analysis. Target: 6-7 pages. English only. Venue provisional: a good journal (IEEE JBHI or similar);
**[open]** check the venue's own template and page limit. The sample paper is used for structure only.

## Thesis and research question (author's words)

Thesis: Kaggle Asthma V2 is substantially derived from ICBHI: 631 of 1,211 clips (52.1%), including all
401 COPD clips, are cuts of ICBHI recordings, and a Kaggle-trained model scores far higher on the ICBHI
recordings that were copied into the corpus than on clean ones, so ICBHI-based "external" evaluation of
Kaggle-trained models is contaminated.

RQ: How much of Kaggle Asthma V2 is derived from ICBHI recordings, and how much does this overlap
inflate the performance of Kaggle-trained models on ICBHI-based "external" evaluation?

Not claimed: merged-split inflation (unless rerun), inflation of Saky et al.'s numbers (unless their
setting is rerun), generalisation to independent sites as a finding.

Footnote: Kaggle metadata lists class counts summing to 1,181; the files matched number 1,211.

Contribution (author's words): the measured extent and class pattern of the overlap (COPD 401/401,
asthma 0/288) and evidence that a Kaggle-trained model does better on copied recordings. Practical rule:
cross-match before splitting; a clean Kaggle-to-ICBHI evaluation excludes the copied recordings and the
60 patients they belong to (at most 66 of 126 patients remain). Closest neighbour: Saky et al. 2026.

## Chapter Plan

| Chapter | Core argument | Evidence | Counter-arguments / risks | Strength | Words (proposed) |
|---|---|---|---|---|---|
| Abstract | Extent + consequence + practical rule | Results below | Do not claim merged-split inflation | n/a | 150-200 |
| 1 Introduction | Source disclosure does not reveal extent or structure of overlap; measuring it is the contribution | C-04; Saky 2026 uses ICBHI as "external"; prior work covers leakage inflation and external drops, not this extent | Tone (not blaming the uploader); "uploader disclosed sources"; literature search incomplete | Strong | ~550 (author) |
| 2 Literature Review | Thematic: (1) leakage inflation and replication (Pham/Nguyen, Pessoa); (2) site/device bias (Ong Ly; Kim first to cut); (3) dataset audits (one sentence). Missing: a measurement of how much of Asthma V2 is ICBHI and its effect on ICBHI-based external evaluation | S2-S4, S7, S13 (verified in NOVELTY_REVIEW); Dolu/Topaloglu only if space | "Convenience dataset" and "patient-level splitting solves it" (answered) | Moderate (coverage self-rated 4/10) | ~300 (half page) |
| 3 Methodology | NCC match of 1,211 clips vs ICBHI at 0.75; validate; Kaggle-only model with and without the copies | C-04, C-16, C-31; score gap 0.697 to 0.795; synthetic recall 99/100; 0 KAUH-ICBHI false matches; 19/19 blind pairs (one rater = author); fingerprint 631/631 ("a second algorithm", recall 93/100, same band) | Counts are lower bounds (one miss at 0.621); threshold sweep not run; one rater | Strong | ~900 |
| 4 Result and analysis | Fig 1 overlap by class; Fig 2 Panel A (C-18 within one model, COPD +39.5 [26.9, 50.9], bronchial +49.3 [23.4, 82.1]) and Panel B (C-19 with/without copies: healthy 96.2% to 15.4%, pneumonia 85.3% to 32.4%; bronchial inconclusive); Table 1; limitations | C-04, C-18, C-19 | Three confounds: different patients, uploader selection, class set/training size (no COPD without copies). C-19 controls recording difficulty; C-18 does not | A1-A3 Strong; A4 Moderate | ~1,300 |
| 5 Conclusion and future work | Measured extent; copied recordings and their 60 patients cannot be external test data; exclude by patient | As above | Hope that "check for overlap" becomes standard is not a claim | A5 Moderate-Strong | ~300 |

Cut from the main paper (author's decision): the Basu & Rana leak ladder (C-02/03; different dataset and
mechanism, cannot calibrate Asthma V2 inflation), the domain-generalization grid, the four-member fusion,
calibration/abstention. At most one sentence for the ladder, labelled as a separate analysis.

Figure/table order if space forces cuts: Figure 3 (cut), Panel B of Figure 2 (cut only after reading
its intervals), Figure 1 last to go.

Table 1: overlap count; C-18 and C-19 rows with intervals; labelled external rows (earlier model 0/45
KAUH, CI 0-7.9%; round-2b balanced accuracy 0.19 on SPRSound; KAUH 17/24 is within-site). **[open]**
whether the external rows stay at all, since they concern merged-cohort models and not the Kaggle-only
probe.

## Argument stress test

| Sub-argument | Rating |
|---|---|
| A1 631/1,211 clips are ICBHI cuts | Strong |
| A2 Class pattern (COPD 401/401, asthma 0/288; bronchial 51/104, healthy 74/133, pneumonia 105/285) | Strong |
| A3 Asthma V2 is not independent of ICBHI | Strong |
| A4 Higher accuracy on copied recordings | Moderate (two designs, consistent direction, different weaknesses) |
| A5 Copied recordings (187 of 920, 60 patients) cannot serve as external test data | Moderate-Strong |
| A6 Basu & Rana ladder | Removed |

Refutation conditions (author-set): copied-vs-clean gap vanishes under matching; matches are false
positives; stricter threshold shrinks the overlap to a trivial size. If 631 became 300 (24.8%): A1 weakens
to a range, A2 needs rechecking, A3 and A5 survive in weaker form, A4 intervals widen.

## INSIGHT Collection

- `thesis_statement`: above.
- `introduction_summary`: source disclosure does not reveal extent or structure; ~550 words.
- `literature_review_summary`: thematic synthesis; closing line "what is still missing is a measurement of
  how much of Asthma V2 is derived from ICBHI, and how that overlap affects ICBHI-based external
  evaluation of Kaggle-trained models"; Saky claim limited to "their test set contains audio that the
  corpus's training portion also contains".
- `methodology_summary`: four steps reduced to three after the ladder cut; counts are lower bounds.
- `results_summary`: strongest = overlap count; weakest = with/without-copies association; bronchial is
  reported as inconclusive in C-19 and is not explained.
- `conclusion_summary`: one memorable fact = COPD 401/401 vs asthma 0/288.
- `contribution_claim`: above (author's words); L5-W1 answered as a hope, not a claim.
- `self_calibration`: coverage 4/10 (accurate); first reviewer criticism named correctly; contribution 6/10.

## Open items before drafting or submission

1. Verify 401 and 631 against `kaggle_icbhi_overlap.csv` (done 2026-11-01: 631/1,211, COPD 401/401).
2. Count uncopied ICBHI recordings from the 60 affected patients (needs the ICBHI audio).
3. Check the bronchial patient count and interval in C-19 before the Figure 2 caption.
4. Run the threshold sweep with pass/fail criteria written first, or claim only the lower bound.
5. Second human rater for the listening check (package ready in `backend/artifacts/experiments/match_validation/`).
6. Re-run Saky et al.'s setting with and without the overlap, or limit the claim to "their test set
   contains audio the training portion also contains".
7. Merged-cohort rerun: future work unless run; state as a limitation.
8. Complete and verify the literature search (lit-review mode); open PMC13128869 and read
   arXiv:2512.00563 beyond the abstract. Cite nothing from memory.
9. Check licences before releasing `kaggle_icbhi_overlap.csv`.
10. Confirm the venue, its template and its page limit.
11. Per `AGENTS.md`/`CLAUDE.md` section 2: update `documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md`
    in the same change if new runs (sweep, Saky re-run, merged-cohort rerun) are added.
