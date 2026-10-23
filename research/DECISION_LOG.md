# Decision log

Dated decisions that shaped the evidence. Each entry names who decided (user or coordinator), the
alternatives considered, the evidence, and its consequence. Newest last. Experiment IDs refer to
`EXPERIMENT_LEDGER.csv`.

| # | Date | Decision | By | Alternatives | Evidence / justification | Consequence |
|---|---|---|---|---|---|---|
| D-01 | 2026-10-21 | Retrain with patient-disjoint, leak-free data; archive the old model rather than delete it | user | keep the 2026-08-14 model | Audit: byte duplicates across splits; later EXP-003 | EXP-004; EXP-002 marked contaminated |
| D-02 | 2026-10-21 | Drop the 631 Kaggle clips that are cuts of ICBHI; keep the full ICBHI recordings with real IDs | user | keep and regroup; drop ICBHI instead | EXP-003 (NCC ≥ 0.795 vs ≤ 0.697) | Split v1 (243 patients) |
| D-03 | 2026-10-21 | Report the Kaggle remainder's unverified identities as a limitation, not download KAUH yet | user | download KAUH immediately | time; later reversed by D-08 | Limitation stated until round 2 |
| D-04 | 2026-10-22 | Compare variants only by 3-fold patient-grouped CV on development patients; the test set is used once per adopted model; adoption rule fixed in advance | coordinator (accepted) | pick by test score | 49-patient test, ±12-pt CI | `experiments/cv.py`; rule in the round-1 report |
| D-05 | 2026-10-22 | Adopt RespiNet + YAMNet fusion (round 1) | rule | keep RespiNet | EXP-R1-F1: +4.6 balanced acc, P = 0.97 | EXP-005 (later superseded) |
| D-06 | 2026-10-22 | Reject log-mel (D2), MFCC statistics (C1) and learned stacking | rule | — | EXP-R1-D2, -C1, EXP-R2A-stack (all worse) | Kept as negative results |
| D-07 | 2026-10-22 | Relax the exported-head check to 1e-3 + identical argmax; repeat the production run from a clean tree | coordinator | patch the failed run | EXP-006 (TF32 differences up to 3.3e-4) | EXP-005 rerun |
| D-08 | 2026-10-22 | Download KAUH; use it as an external test only; give KAUH-derived Kaggle clips real IDs | user | no external data | brief: "prefer real over high" | EXP-010; split v2 |
| D-09 | 2026-10-22 | Pair cuDNN GRUs with per-sample SpecAugment (D3) | coordinator | cuDNN alone | cuDNN rejects masks that are not right-padded; batch SpecAugment zeroes whole frames | D3 definition |
| D-10 | 2026-10-22 | Stop round 2a early for the user's deadline; keep R and retrain it on split v2 | user (deadline) + rule | adopt D3 + YAMNet (+1.4, P = 0.81) | no candidate met the rule | EXP-012; unfinished variants logged |
| D-11 | 2026-10-22 | Move ~50% of the in-label KAUH patients into training; keep the rest as the external holdout | user | keep KAUH external-only | EXP-011/013: 0% external; the confound is in the training data | Split v3; X3; adoption rules in round-2 report §9, written before 2b results |
| D-12 | 2026-10-22 | Include HeAR (gated), PyTorch CPU build for OPERA | user | TensorFlow-only | — | E_hear, E_opera_* |
| D-13 | 2026-10-23 | Primary paper question = shortcut & generalization study (RQ1); model comparisons secondary | user | method paper; let the review decide | strongest verified evidence concerns validity | `RESEARCH_PLAN.md` |
| D-14 | 2026-10-23 | Finish round 2b before new paper experiments | user | paper experiments first | — | X1/X2 after the queue |
| D-15 | 2026-10-23 | Freeze evaluation protocol v1 and split manifests v0–v3 in git | coordinator | — | brief: frozen protocol before accepting comparisons | `EVALUATION_PROTOCOL.md`, `research/splits/` |
| D-17 | 2026-10-23 | Report X1 as supporting H1 (drop 0.280 ≥ 0.15) but **not** as reproducing the paper's 95.67% (L0 = 0.878 ± 0.024) | rule | tune L0 toward 95.67% | pre-registered criteria C-02/C-03; tuning to match a reported figure would be result-chasing | C-02 "not met", C-03 "verified" |
| D-16 | 2026-10-23 | Generate the ledger from artifact files by script | coordinator | hand-typed ledger | a hand-typed SHA-256 in a draft protocol had an invented tail (caught and replaced) | `research/tools/collect_evidence.py` |
