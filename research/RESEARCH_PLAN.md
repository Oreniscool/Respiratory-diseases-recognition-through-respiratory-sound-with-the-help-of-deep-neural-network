# Research plan

Status: v1, 2026-10-23. Owner: research coordinator. Companion files: `EVALUATION_PROTOCOL.md`
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

## 2. Primary research question

**RQ1.** On public lung-sound disease classification, how much of reported accuracy comes from
evaluation leakage and recording-source shortcuts, and does mixing recording sources in training
restore cross-site generalization?

This is a validity / reproducibility question. Model improvements are secondary. They are reported
only when they meet the adoption rule, and they are not the paper's contribution.

## 3. Hypotheses (with what would support and what would falsify each)

| ID | Hypothesis | Supported if | Falsified if | Evidence |
|---|---|---|---|---|
| **H1** | The original protocol's accuracy is mostly an artifact of leakage | X1 reproduces ≈ 95% under the original protocol (L0), and accuracy drops ≥ 15 pts by the leak-free rungs (L3/L4) | the drop L0 → L3 is < 5 pts | X1 (pending) |
| **H2** | Disease labels in the merged public data are confounded with recording source, and models exploit it | probes decode dataset/device better than disease, **and** a model trained on confounded data fails on an external site where the class–site pairing differs, **and** X2 rules out a pure bandwidth artifact | external accuracy close to in-cohort accuracy, or X2 shows ICBHI audio at 4 kHz flips to "asthma" too (then it is a preprocessing artifact, not a site shortcut) | EXP-003, EXP-010, probes, EXP-011/013 (0%), X2 pending |
| **H3** | Adding a minority of external-site patients of the confounded classes to training restores cross-site accuracy | KAUH-holdout healthy/COPD accuracy rises ≥ 30 pts after round 2b, with in-cohort test performance within its CI | holdout accuracy stays near 0–20% | X3 (round 2b, pending) |
| H4 (secondary) | Frozen pretrained embeddings (YAMNet, OPERA, HeAR) are more site-robust than MFCC RespiNet | their shortcut-robustness and holdout metrics beat RespiNet with non-overlapping CIs | CIs overlap (report descriptively) | round 2a/2b CV, X3 |
| H5 (secondary) | The abstention rule flags out-of-site / out-of-label audio | abstention on out-of-label KAUH patients clearly exceeds the in-label rate | abstention ≈ in-label rate | EXP-011/013 (42% vs 33–34%), X5 |

**Competing explanations for the external failure** (each needs a test before H2 is claimed):
1. a site/device shortcut (H2);
2. a bandwidth/sample-rate artifact (KAUH is 4 kHz) → X2;
3. label-definition mismatch (KAUH "N" vs ICBHI "Healthy") → report as a limitation; check per-class
   behavior (the KAUH COPD patients fail the same way, which a healthy-label mismatch alone would not
   explain);
4. small-sample variance → bootstrap CIs on the holdout; the 0% result spans 45 patients.

## 4. Workstreams (separate tasks, each with hypothesis, method, config, metrics, limitations and machine-readable outputs)

| Workstream | Experiments | Status |
|---|---|---|
| Evaluation validity (core) | X1 leakage ladder | approved; after round 2b |
| Data / shortcut (core) | EXP-003, EXP-010, probes, X2 site vs bandwidth | partly done; X2 approved |
| Robustness / generalization (core) | X3 source mixing on the KAUH holdout | running (round 2b) |
| Representation (secondary) | E_yamnet / E_opera_* / E_hear, fusions | done on v2/v3 CV; holdout pending |
| Architecture (secondary) | D0 / D3 / D3_* variants | round 2b queue running |
| Uncertainty (secondary) | X5 abstention and calibration per source | proposed |

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

1. Governance files plus the literature and novelty reviews (in progress).
2. Round-2b adoption, plus X3 on the KAUH holdout.
3. X1 leakage ladder.
4. X2 and X5.
5. Independent audit → `FINAL_READINESS_REPORT.md` → manuscript outline.
