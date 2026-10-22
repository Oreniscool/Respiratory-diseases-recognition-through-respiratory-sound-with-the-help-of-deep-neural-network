# research/

Governance and evidence for the paper built on this repository (research question RQ1 in
`RESEARCH_PLAN.md`). The application docs live in `documentation/`; this folder is for the study.

| File | What it is |
|---|---|
| `RESEARCH_PLAN.md` | Research question, hypotheses with support/falsification criteria, workstreams, decision checklist |
| `EVALUATION_PROTOCOL.md` | Frozen evaluation protocol (v1): splits, what may touch the test and external sets, metrics, statistics, adoption rule |
| `DATASET_AUDIT.md` | Consolidated dataset audit: sources, overlaps, identities, labels, composition, missing metadata |
| `EXPERIMENT_LEDGER.csv` | Every experiment, generated from artifact files by `tools/collect_evidence.py` (`--check` to verify) |
| `DECISION_LOG.md` | Dated decisions with alternatives and justification |
| `CLAIM_EVIDENCE_MATRIX.csv` | Candidate paper claims → evidence (ledger cells) → status |
| `LITERATURE_REVIEW.md` | Literature-review agent output (verified citations only) |
| `NOVELTY_REVIEW.md` | Independent adversarial novelty review |
| `FINAL_READINESS_REPORT.md` | Honest readiness assessment, updated at milestones |
| `splits/v0..v3/` | Frozen split manifests (+ summary, dataset audit) with their SHA-256 |
| `tools/` | Scripts that produce every number in the files above |

Rules: no number is typed by hand when a script can read it from an artifact; failed and superseded
runs stay in the ledger; claims without evidence are marked unsupported or rejected.
