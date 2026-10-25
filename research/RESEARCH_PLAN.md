# Research plan

Status: v2, 2026-10-23 (v1 the same day; reframed per D-22). Owner: research coordinator. Companion files: `EVALUATION_PROTOCOL.md`
(frozen v1), `DATASET_AUDIT.md`, `EXPERIMENT_LEDGER.csv`, `DECISION_LOG.md`,
`CLAIM_EVIDENCE_MATRIX.csv`, `LITERATURE_REVIEW.md` and `NOVELTY_REVIEW.md` (independent agents).

## 1. Starting point

- **Original contribution** (Basu & Rana, IEEE 2020, Xplore 9080747; PDF and code in git at
  `3ec7dc6`): a GRU network over one 40-dim mean-MFCC vector per ICBHI recording, 6 classes,
  reported 95.67% ± 0.77% accuracy over 20 random 75/25 recording-level splits. Augmentation was
  applied before splitting, and the checkpoint was selected on the same split used for testing.
- **Changes since** (chronicle §8.4–8.9): patient-disjoint splitting, full-recording windowing, a
  new architecture (RespiNet-Attention v3), calibration and abstention, a merged ICBHI + Kaggle V2
  cohort, removal of 631 duplicated ICBHI clips, real KAUH identities for 316 Kaggle clips,
  pretrained-embedding fusion, a KAUH external test, and source mixing (round 2b).
- **Experiments already completed:** `EXPERIMENT_LEDGER.csv`. Nothing is deleted; superseded runs
  are labeled.

## 2. Primary research question (v2, 2026-10-23 — reframed after the literature and novelty reviews, D-22)

**RQ (v2).** How large and how consequential is the under-documented audio duplication between public
lung-sound datasets (Kaggle Asthma Detection V2 ↔ ICBHI 2017 ↔ KAUH)? And how much do evaluation
leakage and recording-source confounding inflate disease-classification results built on them?

Sub-questions:
- **(a) Audit:** what fraction of Kaggle V2 is copied, from which source patients, and how does that
  compare with what the uploader discloses?
- **(b) Consequence:** how much does the copying inflate a published-style "train on Kaggle V2, test
  on ICBHI" external evaluation? (control C4)
- **(c) Leakage:** how much does each leak of one published protocol contribute, measured against
  constant-guess baselines? (X1 + factorial)
- **(d) Source confound:** is the recording source decodable within a single diagnosis, and does a
  model trained on confounded data fail on an external site for reasons other than bandwidth?
  (probes, EXP-011/013, X2)
- **(e) Exploratory only:** does adding external-site patients of the confounded classes help on
  other patients from that site? Once KAUH patients are in training, this is a *within-site* test.
  It is never claimed as restored cross-site generalization.

**Why reframed.** Patient-overlap inflation on ICBHI, a leak-corrected reproduction of a lung-sound
classifier (Pessoa et al., BIOSIGNALS 2026), device effects in ICBHI and an ICBHI → KAUH external drop
(Ong Ly et al., npj Digit Med 2024) are already published. The reframed contributions are (a) and
(b), the per-leak decomposition with baselines (c), and the within-diagnosis evidence (d).
See `LITERATURE_REVIEW.md` §8 and `NOVELTY_REVIEW.md`.

v1 (2026-10-23, superseded): "how much of reported accuracy comes from leakage and recording-source
shortcuts, and does mixing recording sources restore cross-site generalization?"

## 3. Hypotheses (with what would support and what would falsify each)

| ID | Hypothesis | Supported if | Falsified if | Evidence / status |
|---|---|---|---|---|
| **H0 (audit)** | Kaggle V2 contains far more ICBHI/KAUH audio than its description discloses | detector with validated recall finds copies well above the disclosed ~212/~170 | counts consistent with the disclosure | **rejected as worded (D-25, C-20):** 631 clips come from 187 ICBHI recordings (disclosed "212 samples") and 316 from 115 KAUH recordings ("about 170 samples"); more clips but fewer source recordings than disclosed. What is undocumented: the splitting into several clips per recording with non-patient identifiers, and that all of Kaggle's COPD is ICBHI audio |
| **H6 (consequence)** | A Kaggle-trained model scores higher on ICBHI recordings copied into Kaggle than on clean ICBHI recordings of the same class | accuracy(copied) − accuracy(clean) clearly > 0 within one model, with patient-level CIs | no difference | **supported (C-18, C-19):** within one model COPD copied 81.1% vs clean 41.5% (+39.5, CI 26.9–50.9); healthy copied recordings 96.2% → 15.4% without the copies |
| **H1 (leakage)** | Each leak of the 2021 protocol inflates balanced accuracy | balanced accuracy L0 − L3 ≥ 15 pts; the factorial shows the share of each leak | drop < 5 pts | X1: **supported** (0.872 → 0.385). Reproduction of 0.957 not met. Factorial running |
| **H2 (source confound)** | Labels are confounded with source, the source is decodable within a diagnosis, and the external failure is not explained by sample rate alone | within-label probes ≫ chance; external failure; X2 rules out bandwidth as the full cause | probes at chance within diagnosis; ICBHI at 4 kHz also flips to asthma | **supported** (C-07, C-08, C-09, C-15), with power caveats |
| H3 (exploratory) | Within-site exposure helps other patients from that site | KAUH-holdout healthy/COPD accuracy clearly above EXP-013's 0% | holdout ≈ 0% | **partly supported (X3, C-10):** 17/24 vs 0/24, but healthy 17/18 and COPD 0/5; balanced 31.5%. Out-of-label KAUH predictions moved from asthma to healthy, i.e. the site's dominant training label. Within-site only |
| H4, H5 (secondary) | representation robustness; abstention on out-of-label audio (H5: X5 done; see C-12) | as before | as before | descriptive |

**Competing explanations for (d)** (reviewer list):
- device response and filter modes;
- room and protocol;
- population (age, severity, comorbidity);
- label-definition mismatch: KAUH "N" appears in both the diagnosis and sound-type columns; "BRON" ≠
  bronchial ≠ bronchiectasis;
- small samples (exact CIs reported).

The design cannot fully separate device from population. Claims are worded as "acquisition or site
differences", not "the stethoscope".

## 4. Workstreams (separate tasks, each with hypothesis, method, config, metrics, limitations and machine-readable outputs)

| Workstream | Experiments | Status |
|---|---|---|
| Evaluation validity (core) | X1 leakage ladder | approved; after round 2b |
| Data / shortcut (core) | EXP-003, EXP-010, probes, X2 site vs bandwidth | partly done; X2 approved |
| Robustness / generalization (core) | X3 source mixing on the KAUH holdout | running (round 2b) |
| Representation (secondary) | E_yamnet / E_opera_* / E_hear, fusions | done on v2/v3 CV; holdout pending |
| Architecture (secondary) | D0 / D3 / D3_* variants | round 2b queue running |
| Uncertainty (secondary) | X5 abstention and calibration per source | proposed |
| Audit validation (core, v2) | copy-detector recall on synthetic cuts (done: 0.99); blind listening of 20 hardest pairs (done: 19/19 decided agree, 1 unsure) | done (second rater optional) |
| Consequence (core, v2) | C4 contamination re-evaluation (Kaggle-only models scored on copied vs clean ICBHI) | queued on the GPU |
| Leak decomposition (core, v2) | X1 factorial completion (L2T, L3T) | running |
| Source confound (core, v2) | within-label probes (done), exact CIs (done) | done |

## 5. Decision checklist for proposed experiments

| Experiment | Question answered | Already answered in the literature? | Supporting outcome | Falsifying outcome | Feasible? | Needed for the paper? | Decision |
|---|---|---|---|---|---|---|---|
| X1 leakage ladder | H1 | partly (random-split inflation is known in general; the size for this protocol is not) — awaiting review | L0 ≈ 95%, L3/L4 ≥ 15 pts lower | drop < 5 pts | yes (tiny model, CPU/GPU minutes per repeat) | yes, central | **run** |
| X2 site vs bandwidth | H2 competing explanation | no | ICBHI audio at 4 kHz still classified correctly | ICBHI at 4 kHz → "asthma" | yes (inference only) | yes | **run** |
| X3 source mixing | H3 | awaiting review | holdout healthy/COPD ≥ +30 pts | ≤ 20% holdout accuracy | running | yes | **run** |
| X5 abstention | H5 | partly | out-of-label abstention ≫ in-label | equal rates | yes (existing outputs) | supporting | **run (descriptive)** |
| Round-2b D3 variants | H4 / engineering | n/a | meets the adoption rule | does not | running | supporting only | **finish, report** |
| More architecture tuning | engineering | n/a | — | — | yes | no (does not answer RQ1) | **defer** |
| Foundation-model fine-tuning | H4 | partly (OPERA/HeAR papers) | — | — | heavy | no | **defer** |
| Synthetic device perturbations as primary evidence | H2 | — | — | — | yes | no: synthetic shifts do not stand in for a real site | **reject as primary; allowed as an ablation** |

## 6. Governance

- **Ledger:** `EXPERIMENT_LEDGER.csv` is regenerated from artifacts by
  `research/tools/collect_evidence.py`. The prose lives in its registry and the numbers come from
  files. `--check` fails if the ledger is stale.
- **Concurrency:** only the coordinator edits shared training/evaluation code (`backend/*.py`,
  `backend/experiments/*`), and only when no queued GPU run will import it. Agents write only their
  own `research/*.md` file.
- **Claims:** every candidate paper claim is listed in `CLAIM_EVIDENCE_MATRIX.csv` with its evidence
  and status. Unsupported claims are rejected, and citations need a URL or DOI that was actually
  fetched.
- **Audit:** an independent audit agent re-derives the matrix numbers before the readiness report.
- **Engineering vs science:** application features (UI, the lung-sound gate, serving contracts) are
  engineering. They support reproducibility but are not research contributions.

## 7. Milestones

**2026-10-25:** all milestones below are done, plus the Tier-1/2 controls listed in
`FINAL_READINESS_REPORT.md`: fidelity grid, multiplicity, no-audio baselines, label mapping, the
KAUH-linkage fix, non-breath probes, LOSO, external AUROC, demographics, the C4 second seed, the
learning curve and frozen AST. Next: writing (`MANUSCRIPT_OUTLINE.md`).

### Original milestone list

1. Governance files plus the literature and novelty reviews — **done**.
2. X1 leakage ladder — **done**; factorial completion running.
3. Round-2b adoption — decided (D-21); production run and KAUH-holdout evaluation (X3) running.
4. v2 controls — within-label probes and exact CIs **done**; copy-detector recall **done**, listening
   check pending; C4 queued.
5. Independent audit → `FINAL_READINESS_REPORT.md` → manuscript outline.
