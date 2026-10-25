# Independent audit, second pass (2026-10-26)

Scope: claims C-21 to C-30 of `research/CLAIM_EVIDENCE_MATRIX.csv`, the CHANGED notes of C-02, C-10, C-13, C-18,
C-19, C-22 and C-23, `research/DEMOGRAPHICS.md`, `research/LABEL_MAPPING.md`, the 7 figures, the Holm adjustment,
the Clopper-Pearson intervals quoted in `research/*.md` and `CLAUDE.md`, and the `CLAUDE.md` §6 reproduction claim.
Plus a methodological read of `backend/experiments/loso.py`, `backend/experiments/learning_curve.py` and
`research/tools/source_baseline.py`.

Method: every number was recomputed from raw files (`backend/artifacts/experiments/*.json|csv`, `oof_*.csv`,
`*_recordings.json`, `latest/split_manifest.csv`, `backend/data/*.csv`, the KAUH audio re-hashed, the ICBHI
demographics file), not from the ledger or the tools' own summaries. Bootstraps were re-run with different seeds
and more draws, so the recomputed intervals differ from the quoted ones by sampling noise only (listed where
relevant). Nothing was trained, served or loaded (no model, no pickle); the blind-listening answer key was not
opened and `listening_score.py` was not run. The only file written in the repository is this report; scratch
scripts are in `/tmp/claude-1000/.../scratchpad/audit2/`.

## Summary

| | Count |
|---|---:|
| Checks (rows of §1; many rows cover several numbers, about 190 individual values) | 82 |
| Match (3 of them with a wording or axis note: rows 13, 51, 73) | 69 |
| Mismatch | 6 (rows 23, 37, 38, 39, 47, 67) |
| Status not justified | 2 (rows 40, 53) |
| Unverifiable from files | 5 (rows 36, 76, 77, 81, 82) |

Mismatches (details in §2; rows 37-39 are all C-25): C-25 "10 of 12 cells" is 9 of 12 and the exceptions are three, not two (also copied into
the LOSO ledger row, `FINAL_READINESS_REPORT.md` and `MANUSCRIPT_OUTLINE.md`); C-25 within-cohort maximum 0.97 is
0.96; C-23 note says "No CIs for the merged-cohort comparisons" but gives one in the next sentence; the
`LABEL_MAPPING.md` sentence "ICBHI diagnoses not listed under a class are excluded upstream" describes nothing (all 8
map; 126 of 126 patients are used); `DEMOGRAPHICS.md` and `LABEL_MAPPING.md` §3 still describe the v1 KAUH holdout
that C-21's fix replaced by v2 (stated nowhere in those files).
Status not justified: C-25 ("verified", should be "partly supported"); C-29's interpretive half ("strongest source
signature") holds for one probe only.
Every other number in C-21 to C-30 and in the changed notes reproduced. Point estimates reproduced exactly;
intervals within about 0.02.

## 1. Verification table

Abbreviations: `X/` = `backend/artifacts/experiments/`, `L/` = `backend/artifacts/latest/`, `D/` = `backend/data/`.

| # | Claim / location | Quoted value | Recomputed value | Source | Verdict |
|---|---|---|---|---|---|
| 1 | C-21 identical files | 4 identical groups in 336 files | 336 files, 332 distinct SHA-256, 4 groups of 2; same 4 groups on decoded PCM | re-hash of `backend/dataset/KAUH/audio` | match |
| 2 | C-21 pairing | 100↔101 (two filters), 76↔77, 9 within one patient | BP100=BP101, DP100=DP101 (healthy vs asthma), EP76=EP77 (healthy vs asthma), BP9=DP9 (same patient, asthma) | same + `D/kauh_internal_duplicates.csv` | match |
| 3 | C-21 splits of the partners | 900101 validation, 900077 train, holdout 900100 / 900076 | `L/split_manifest.csv`: 900101 validation, 900077 train; both 100 and 76 in the holdout manifest | split_manifest, holdout manifest | match |
| 4 | C-21 conflicting groups | 3 | 3 (`conflicting_diagnoses=True` rows; healthy vs asthma) | duplicates csv + summary | match |
| 5 | C-21 X3 as registered | 17/24, healthy 17/18, COPD 0/5 | 17/24; healthy 17/18; COPD 0/5; bronchial 0/1 | `X/external/served_round2b_final_recordings.json` (mean prob per patient, argmax) | match |
| 6 | C-21 / C-10 sensitivity | 18/24, healthy 18/18, COPD 0/5 after dropping BP100, DP100, EP76 | 18/24; healthy 18/18; COPD 0/5 | same | match |
| 7 | C-21 fix: manifest v2 | drops patients 76 and 100; X3 on v2 16/22, healthy 16/16, COPD 0/5 | v2 has 147 rows vs 153 (the 6 recordings of 900076 and 900100 removed); 16/22; healthy 16/16; COPD 0/5 | holdout manifests v1/v2 + recordings json | match |
| 8 | C-21 previous model unchanged | 0/24 | 0/24 as registered, 0/24 duplicates removed, 0/22 on v2 | `X/external/previous_round2_on_holdout_recordings.json` | match |
| 9 | C-10 accuracy | 17/24 (70.8%, exact CI 48.9-87.4%) | 17/24 = 70.83%; Clopper-Pearson 48.90-87.38% | scipy `beta.ppf` | match |
| 10 | C-10 per class | COPD 0/5 (CI 0-52%); bronchial 0/1; balanced 31.5% | CP(0,5) = 0-52.18%; 0/1; (0+0+17/18)/3 = 31.48% | same | match |
| 11 | C-10 previous model | 0/24 | 0/24, CP 0-14.25% (quoted 0-14.2%) | same | match |
| 12 | C-10 out-of-label shift | asthma → healthy | previous: asthma 63, pneumonia 17, COPD 1 of 81; round 2b: healthy 52, asthma 26, COPD 2, bronchial 1 | `*_recordings.json`, `*.json` | match |
| 13 | C-10 criterion "≥ 0.30 above EXP-013" | 70.8 vs 0 | the 0/24 comparator is EXP-017 (same holdout); EXP-013 is 0/45 on a different, larger set | ledger | match (reference ID in `criterion` should read EXP-017) |
| 14 | C-22 raw and Holm p | 0.048 → 0.164 (4 pre-registered); 1.0 (35) | Holm step-down on the four raw p (0.041, 0.048, 0.063, 0.523): 4×0.041 = 0.164; adopted = 0.164; over 35: 35×0.035 > 1 → 1.0 | `X/multiplicity.json`, own Holm | match |
| 15 | C-22 +4.8 balanced accuracy | +4.8 | 74.92% vs 70.13% = +4.79 (patient level, `oof_*.csv`) | recomputed from OOF files | match |
| 16 | C-22 raw p independent | 0.048 (1,000 draws) | P(Δ ≤ 0) = 0.0426 with 20,000 draws, seed 999 (D3_x3+YAMNet+HeAR 0.0427; +OPERA-CE 0.072; +YAMNet only 0.547). Holm over 4 = 0.17 | own bootstrap | match (within MC error) |
| 17 | C-22 family | 4 pre-registered fusions | plan text of ROUND2 §9 (committed 2026-10-22 22:40, OOF files dated 2026-10-23): best D3 member + YAMNet, + OPERA-CE and/or HeAR = 4 | ROUND2 report, `git log -S` | match |
| 18 | C-23 split v3 | rule 84.1% vs model 82.0% recording accuracy | rule 0.8406, model 0.8201 (GPU `test_metrics.json`) | rule recomputed from `L/split_manifest.csv` (fit on train+validation only) | match |
| 19 | C-23 split v3 patient | balanced 70.8% vs 74.9% | 0.7078 vs 0.7487 (patient accuracy 69.4% vs 75.5%) | same + `served_test_predictions.json` | match |
| 20 | C-23 split v2 | 87.8% vs 81.2%; 68.5% vs 71.9% | 0.8780 vs 0.8125; 0.6846 vs 0.7192 | `X/source_baseline.json` (split v2 manifest not re-fit) | match (file values; not re-fit) |
| 21 | C-23 X1 L3 | device rule 0.440 vs network 0.384; better in 7/20 | 0.4396 vs 0.3845; 7 of 20 (mean paired −0.055, sd 0.104) | `leakage_ladder/features.npz` + `results.csv`, rule re-fit per seed | match |
| 22 | C-23 TESTPRED | model − rule +4.1 [−6.9, +16.1], P 0.77 | +4.09, [−7.2, +15.6], P 0.76 (20,000 draws, seed 5) | `served_test_predictions.json` | match (within MC error) |
| 23 | C-23 note text | "No CIs for the merged-cohort comparisons." | the same note ends with a CI for split v3; the ledger SRC row says the same | CSV | mismatch (stale sentence; true for split v2 only) |
| 24 | C-13 addendum | without the 6 Kaggle-remainder patients: 74.4% / 68.0% | 43 patients; accuracy 0.7442; balanced 0.6798 | `served_test_predictions.json` | match |
| 25 | C-13 / CLAUDE.md §6 | 75.51% [63.3, 87.8], balanced 74.87%, 49 patients | 0.7551, 0.7487, 49; stored bootstrap 0.6327-0.8776 | `L/test_metrics.json` | match |
| 26 | C-02 fidelity grid | mean 0.79-0.88; 0 of 80 runs ≥ 0.949 | per config means 0.8800, 0.8780, 0.8323, 0.7923; max single run 0.935; 80 = 60 rows of `results_fidelity.csv` + the 20 L0 rows of `results.csv` | `leakage_ladder/*.csv` | match |
| 27 | C-02 "best 10 of 20 adds ~2 points" | ~2 | top-10 minus mean: +2.0, +1.75, +2.3, +2.4 | same | match |
| 28 | C-02 L0 | 0.878, 7.9 pts below 0.9567 | 0.8780; 0.0787 | `results.csv` | match |
| 29 | C-18 seed 42 | COPD 81.1% (26) vs 41.5% (38) +39.5 [26.9, 50.9]; bronchial 62.5% (7) vs 13.2% (22) +49.3 [23.4, 82.1] | 81.08/41.53 +39.55 [26.8, 51.1]; 62.5/13.16 +49.34 [23.2, 82.1]; same patient counts | `contamination/kaggle_all_recordings.json`, own cluster bootstrap (20,000) | match |
| 30 | C-18 seed 43 | COPD +51.4 [38.9, 63.6]; bronchial +65.5 [32.0, 85.4] | +51.40 [38.1, 63.2]; +65.46 [33.1, 85.2] | `kaggle_all_s43_recordings.json` | match |
| 31 | C-19 seed 42 | healthy 96.2 → 15.4 (21 pts) +80.8 [65.4, 93.6]; pneumonia 85.3 → 32.4 (6) CI 27.3-71.4; bronchial 62.5 → 43.8, CI −25.0 to 61.5 | 96.15 → 15.38, +80.77 [65.4, 95.2]; 85.29 → 32.35, [26.3, 70.8]; 62.5 → 43.75, [−25.0, 63.6] | `kaggle_all` vs `kaggle_clean` recordings | match (upper limit of healthy CI differs by 1.6 points, bootstrap noise) |
| 32 | C-19 seed 43 | healthy 92.3 → 34.6 (CI 36-77); pneumonia 94.1 → 38.2 (30-75); bronchial n.s. | 92.31 → 34.62 [35.7, 76.9]; 94.12 → 38.24 [30.4, 75.0]; bronchial 81.25 → 43.75, [−10.0, 70.0] | `*_s43_recordings.json` | match |
| 33 | C-24 in cohort | 0.94 [0.87, 0.99], 49 patients | AUROC 0.9426 [0.867, 0.991]; 11 normal / 38 abnormal | `served_test_predictions.json` (1 − mean P(healthy)) | match |
| 34 | C-24 external | pre-round-2 0.48 [0.35, 0.62], round-2 0.47 [0.34, 0.60], 72 patients | 0.4834 [0.348, 0.619]; 0.4695 [0.331, 0.603]; 35 normal / 37 abnormal | `experiments-round2a/external/*_recordings.json` | match |
| 35 | C-24 after 2b | 0.83 [0.71, 0.94] | 0.8333 [0.703, 0.939], 51 patients (18 / 33). The same-holdout comparator for the previous model is 0.569 [0.397, 0.734] (not quoted) | `X/external/*_recordings.json` | match |
| 36 | C-24 "Ong Ly et al. 2024 (0.97 → 0.60)" | 0.97 → 0.60 | only the repo's own `NOVELTY_REVIEW.md` carries it; the paper was not available offline | literature | unverifiable |
| 37 | C-25 held-out range | 10 of 12 cells at 0.38-0.59 | 9 of 12 (0.381, 0.416, 0.427, 0.441, 0.456, 0.490, 0.517, 0.557, 0.5875). Cells above: YAMNet/Kaggle 0.866, OPERA-CE/Kaggle 0.686, **HeAR/Kaggle 0.659** | `X/loso.json` | mismatch |
| 38 | C-25 exceptions | YAMNet 0.87 and OPERA-CE 0.69 | three exceptions; HeAR 0.66 [0.49, 0.82] is missing | same | mismatch |
| 39 | C-25 within cohort | 0.51-0.97 | 0.507-0.965 (max 0.9646 → 0.96) | same | mismatch (rounding) |
| 40 | C-25 status "verified"; criterion "held-out near 0.5 while within-cohort is high" | verified | 11 of 12 held-out CIs include 0.5 (only YAMNet/Kaggle excludes it, above); 6 of 12 within-cohort AUROCs are below 0.9; OPERA-CE/ICBHI within-cohort is 0.507 [0.34, 0.67] and MFCC/Kaggle 0.607, so there is no "drop" in those two cells | same | status not justified (partly supported) |
| 41 | C-26 quietest 10% | dataset 0.79, device 0.81, within-diagnosis 0.77-0.98 | 0.7899, 0.8074; within-diagnosis 0.769, 0.933, 0.931, 0.959, 0.978 | `X/nonbreath_probes.json` | match |
| 42 | C-26 first/last 100 ms | 0.76 / 0.83 / 0.72-0.96 | 0.7604, 0.8263; 0.718-0.963 | same | match |
| 43 | C-27 ICBHI healthy | 26 patients, age 0-16, median 5 | 26; median 5.0; range 0.25-16 (fractional years, shown as 0) | `backend/dataset/ICBHI_demographic_info.txt` + manifest | match |
| 44 | C-27 ICBHI COPD / KAUH healthy | median 69; 32 (cohort) / 42 (holdout) | COPD median 69 (n 64, range 45-93); KAUH cohort healthy 32 (n 17), holdout healthy 42 (n 18) | demographics file, file names, manifests | match |
| 45 | DEMOGRAPHICS ICBHI cells | asthma 1 (70); bronchial 29 (3 [1-73], F 15/29); COPD 64 (69 [45-93], F 15/63); healthy 26 (5 [0-16], F 13/26); pneumonia 6 (72 [4-81], F 2/6) | identical (the tool rounds the ICBHI bronchial minimum 0.58 y to 1 and the KAUH-cohort COPD median 57.5 to 58) | own parse of the 126-patient file | match |
| 46 | DEMOGRAPHICS KAUH cells | clips from KAUH: asthma 33 (46 [12-90], F 17/33), bronchial 2, pneumonia 5 (57 [36-70]); cohort COPD 4 (58 [53-63], F 0/4), healthy 17 (32 [18-75], F 3/17); holdout bronchial 1, COPD 5 (57 [42-76], F 1/5), healthy 18 (42 [18-81], F 8/18), out of label 27 (67 [24-90], F 11/27) | identical; age and sex are consistent across the 3 filters for all 112 patients; the Kaggle remainder counts (6, 9, 13, 29) match | file names, manifests, split_manifest | match |
| 47 | DEMOGRAPHICS holdout | KAUH (holdout) | table uses the v1 holdout manifest (18 healthy patients incl. 900076 and 900100, whose audio duplicates asthma patients), not the v2 manifest of the C-21 fix | tool source | mismatch (stale w.r.t. v2) |
| 48 | C-28 learning curve | healthy 0 / 0.16 / 0.67 / 0.94; COPD 0 at every k; AUROC 0.66 → 0.88; 3 COPD dev patients | 0, 0.1625, 0.66875, 0.9375; COPD 0; 0.661 → 0.884; `kauh_dev_copd_patients` 3 | `X/learning_curve.json` | match |
| 49 | C-28 training set vs holdout v2 | no overlap | v2 holdout patients ∩ (train+val+test patients) = ∅; path overlap ∅; no KAUH-cohort file byte-identical to a holdout file; no holdout patient has a Kaggle cut (`kaggle_kauh_overlap.csv`) | manifests + hashing | match |
| 50 | C-29 CV balanced accuracy | AST 78.3%, HeAR 71.6%, +6.7 [1.5, 12.6] | 0.7829, 0.7159; +6.70 [1.3, 12.3], P(AST better) 0.991 (quoted 0.995) | `oof_E_ast.csv`, `oof_E_hear.csv` | match |
| 51 | C-29 probes | dataset probe 0.94 (highest) | AST 0.9444, OPERA-CE 0.9310, HeAR 0.9142, YAMNet 0.8043; but ICBHI-device probe AST 0.871 is third (HeAR 0.882, OPERA-CE 0.881) and `source | COPD` AST 0.61 is the lowest of the five | `X/shortcut_probes.json` | match on the number; wording flagged (§4) |
| 52 | C-29 LOSO | KAUH site held-out 0.21 vs within-cohort 0.95 | 0.2104 [0.093, 0.349]; 0.9521 | `X/loso.json` | match |
| 53 | C-29 status "verified (exploratory)" | "stronger source signature" | holds for the dataset probe only, with no CI on a 1.4-point gap to OPERA-CE | see 51 | status not justified for the interpretive half |
| 54 | C-30 headline | 74.4% vs frozen AST 78.3% (−9.2 to +1.1, P 0.075) | 0.7441 vs 0.7829: −3.9 [−9.0, +1.2], P(improve) 0.067 | `oof_D_ast.csv`, `oof_E_ast.csv` | match |
| 55 | C-30 vs adopted fusion | 74.9% (−6.3 to +5.3, P 0.42) | 0.7492; −0.5 [−6.2, +5.3], P 0.43 | `oof_D3_x3`, `E_yamnet`, `E_opera_ce`, `E_hear` fused equally | match |
| 56 | C-30 off-device COPD | 62.1% (116 rec.) vs 85.3% frozen, 75.0% fusion | 0.6207, 0.8534, 0.7500; n = 116 recordings from 30 patients (recordings: 107 ICBHI, 9 KAUH). Paired patient bootstrap: D_ast − frozen −23.3 [−36.5, −10.1]; D_ast − fusion −12.9 [−28.9, +3.9] | own recomputation | match; only the first contrast is distinguishable from 0 |
| 57 | C-30 Meditron | 56.2 / 56.2 / 61.5 | 96 recordings: 0.5625, 0.5625, 0.6146 | same | match |
| 58 | C-30 epochs, time | best epochs 5/2/2; 12.6 GPU-minutes | 5/2/2; 5.1 + 3.5 + 4.0 = 12.6; inner-validation sizes 159/127/123 | `X/ast_finetune_raw.json` | match |
| 59 | C-26/C-29 fine print | "weights not kept" | no weights directory exists for D_ast | `X/` listing | match |
| 60 | CLAUDE.md §6 reproduction, GPU | exact | `round2b_final_gpu.json`: every recording and patient metric served = reported, max diff 0.0 | `X/deployment_checks/` | match |
| 61 | CLAUDE.md §6 reproduction, CPU | 1 of 389 recordings flips; patient metrics identical | `round2b_final.json`: recording accuracy 0.81748 vs 0.82005 (difference exactly 1/389), balanced 0.7229 vs 0.7347, patient metrics identical | same | match on the net change; "1 flip" is inferred (§3) |
| 62 | CLAUDE.md §6 table | ECE 0.0743 / 0.0853; AUROC 0.9190 / 0.9394; balanced 73.47 / 74.87; macro F1 0.704 / 0.739 | 0.07430 / 0.08533; 0.91895 / 0.93939; 0.73469 / 0.74870; 0.70390 / 0.73864 | `L/test_metrics.json` | match |
| 63 | Clopper-Pearson, all docs | 0-7.9% (0/45); 0-14.2% (0/24); 48.9-87.4% (17/24); 0-52(.2)% (0/5); 72.7-99.9% (17/18); 82.4-100% (19/19) | 0-7.88%; 0-14.25%; 48.90-87.38%; 0-52.18%; 72.71-99.86%; 82.35-100% | scipy | match |
| 64 | LABEL_MAPPING §2, ICBHI | Asthma 1, URTI 14, bronchiectasis 7, bronchiolitis 6, LRTI 2, COPD 64, healthy 26, pneumonia 6 | identical | `patient_diagnosis_authentic.csv`, `reorganize_icbhi.ICBHI_TO_5CLASS` | match |
| 65 | LABEL_MAPPING §2, Kaggle / KAUH | asthma 288, Bronchial 104, copd 401, healthy 133, pneumonia 285; KAUH patients 32/3/9/35/5 and out of label 28 | folder counts identical; KAUH by diagnosis string (case-folded) 32 / 3 / 9 / 35 / 5; out of label 18+2+1+4+2+1 = 28; total 112 | folder listing, file names | match |
| 66 | LABEL_MAPPING §3 | icbhi 1/54/793/35/37 (126); kaggle 288/53/0/53/174 (97); kauh 0/0/12/51/0 (21); holdout 54/81/15/3; cohort 51/12 | identical in all cells | `split_manifest.csv`, `dataset_audit.json`, manifests | match |
| 67 | LABEL_MAPPING §2 closing sentence | "ICBHI diagnoses not listed under a class are excluded upstream" | all 8 diagnoses are mapped; 920 of 920 recordings and 126 of 126 patients are used; nothing is excluded | `ICBHI_TO_5CLASS`, manifest | mismatch (vacuous/stale) |
| 68 | LABEL_MAPPING §4 asthma-and-fibrosis | clips of that patient train as asthma | Kaggle-from-KAUH asthma patients 33 vs 32 KAUH asthma diagnoses: consistent with one extra patient | counts | match (indirect) |
| 69 | Fig. 1 | asthma 262 / 26; bronchial 51 / 15 / 38; COPD 401; healthy 74 / 59; pneumonia 105 / 39 / 141; total 1211 | 262 + 26 = 288; 51 + 15 + 38 = 104; 401; 74 + 59 = 133; 105 + 39 + 141 = 285; both overlap CSVs have 1211 rows | `D/kaggle_icbhi_overlap.csv`, `kaggle_kauh_overlap.csv`, folder counts | match |
| 70 | Fig. 2 | 81/42 (26 vs 38 pts), 62/13 (7 vs 22); Δ +40 [+27, +51], +49 [+23, +82]; right: 96/15 (21), 85/32 (6), 62/44 (7) | identical (rows 29, 31) | `contamination/analysis.json` and my recomputation | match |
| 71 | Fig. 3 | 0.87, 0.80 (sample); 0.59, 0.51 (recording); 0.49, 0.38 (patient); rule 0.44; chance 0.167 | 0.8716, 0.7985; 0.5866, 0.5112; 0.4916 (L3T), 0.3845; 0.4396; 1/6 | `leakage_ladder/summary.json`, `source_baseline.json` | match |
| 72 | Fig. 4 | whole recording 0.86 0.83 0.69 0.95 0.88 0.96; quietest 0.79 0.81 0.60 0.93 0.77 0.98; edges 0.76 0.83 0.62 0.93 0.72 0.94; AST 0.94 0.87 0.76 0.98 0.61 1.00; HeAR 0.91 0.88 0.69 0.96 0.89 0.97; OPERA-CE 0.93 0.88 0.74 0.96 0.77 0.90 | all 36 displayed cells equal the JSON values rounded to 2 decimals | `nonbreath_probes.json`, `shortcut_probes.json` | match |
| 73 | Fig. 5 | AST/KAUH held-out 0.21; OPERA-CE/ICBHI within 0.51; YAMNet/Kaggle 0.95 within and 0.87 held-out; HeAR/Kaggle 0.66 | as drawn; the 15 held-out and 15 within-cohort points equal `loso.json`; AST/KAUH whisker lower limit 0.093 is cut off by the x-axis at 0.2 | `loso.json` | match; axis issue (§4) |
| 74 | Fig. 6 | 71% vs 75% (v3); 68% vs 72% (v2) | 0.7078 vs 0.7487; 0.6846 vs 0.7192 | `source_baseline.json` | match |
| 75 | Fig. 7 | healthy 0 / 0.16 / 0.67 / 0.94; AUROC 0.66 / 0.78 / 0.85 / 0.88; COPD 0 | 0, 0.1625, 0.669, 0.9375; 0.661, 0.782, 0.850, 0.884; COPD 0 | `learning_curve.json` | match |
| 76 | C-02 "class sizes differ from the paper for two classes" | as quoted | released-code sizes (Bronchiectasis 80, Bronchiolitis 65) verified in `features_summary.json`; the paper's Fig. 1 sizes were not checked (image) | first audit | unverifiable |
| 77 | C-02 "paper's lowest reported run 0.949" | 0.9486 of 10 shown runs | taken from `fidelity_summary.json`; the paper PDF was not re-read here | `fidelity_summary.json` | unverifiable (paper side) |
| 78 | C-24 BIN LIM "18-35 normal patients" | 18 and 35 | 18 (holdout), 35 (72-patient set) | `binary_external.json` | match |
| 79 | C-23 TESTPRED fallback | rule label for unseen keys | not exercised: every test (source, device) key exists in the fit table | `source_baseline.json` rule | match |
| 80 | Ledger LC/AST/AST-FT/SRC/TESTPRED/BIN/NONBREATH primary values | 0.9375; 0.7829; 0.7441; 0.8406; 0.0409; 0.4695; 0.7899 | identical to the files | `EXPERIMENT_LEDGER.csv` vs raw | match |
| 81 | C-21 "near-identical but not byte-identical audio" | not claimed | not checked: only byte/PCM identity was tested, so re-encoded or lightly processed duplicates among the 336 KAUH files, or between KAUH and the Kaggle cuts beyond `kaggle_kauh_overlap.csv`, are not excluded | n/a | unverifiable |
| 82 | CLAUDE.md §6 / C-13 "1 of 389 flips" as a per-recording statement | 1 flip | per-recording GPU predictions are not stored, so only the net accuracy change (1/389) can be checked | `served_test_predictions.json` is CPU only | unverifiable (net change verified, row 61) |

## 2. Mismatches and unjustified statuses, with the correct values

**C-25 (rows 37-40).** From `X/loso.json`, four representations × three sources:
- Held-out AUROC: 9 of 12 cells lie in 0.38-0.59. The three above are all on the Kaggle remainder: YAMNet 0.866
  [0.74, 0.97], OPERA-CE 0.686 [0.45, 0.89], HeAR 0.659 [0.49, 0.82]. Correct text: "9 of 12 representation × source
  cells at 0.38-0.59 when held out; exceptions YAMNet 0.87, OPERA-CE 0.69 and HeAR 0.66, all on the Kaggle remainder".
- Within-cohort range is 0.51-0.96, not 0.97 (maximum 0.9646, OPERA-CE on the KAUH site).
- Only one of the 12 held-out CIs excludes 0.5 (YAMNet/Kaggle remainder, above 0.5). So the data show "no
  detectable transfer to ICBHI or to the KAUH site, but YAMNet does transfer to the Kaggle remainder", which is weaker
  than "does not transfer". Two within-cohort cells (OPERA-CE/ICBHI 0.507, MFCC/Kaggle remainder 0.607) are not high,
  so the stated criterion ("within-cohort is high") is not met for them. Suggested status: **partly supported**.
- The same wrong figures appear in the LOSO ledger row (`interpretation`), `FINAL_READINESS_REPORT.md` (d) and
  `MANUSCRIPT_OUTLINE.md` §6 ("10 of 12"). The first two also say "each source ... drops", which is not true of the
  Kaggle remainder for YAMNet.

**C-23 note (row 23).** The sentence "No CIs for the merged-cohort comparisons." is followed, after the TESTPRED
addition, by a CI for split v3. Correct: "No CIs for the split-v2 and X1 comparisons; split v3: model − rule +4.1
[−6.9, +16.1]". The ledger SRC `limitations` field has the same stale phrase.

**LABEL_MAPPING.md §2 (row 67).** "ICBHI diagnoses not listed under a class are excluded upstream": all eight ICBHI
diagnoses are mapped and all 126 patients are in the cohort, so nothing is excluded. Delete the sentence or say so.

**DEMOGRAPHICS.md / LABEL_MAPPING.md §3 (row 47).** Both use `kauh_external_holdout_manifest.csv` (v1, 51 patients,
including 900076 and 900100). The C-21 fix introduced the v2 manifest (49 patients). The files should say "v1" or be
regenerated for v2 (healthy n = 16, holdout recordings 147). No number is wrong for v1.

**C-29 status (row 53).** "Carries a stronger source signature" is supported by the dataset-of-origin probe
(AST 0.944 vs OPERA-CE 0.931 vs HeAR 0.914; differences of 1.4-3.0 points, no CI) but not by the ICBHI-device probe
(AST 0.871, third of four embeddings) or by `source | COPD` (AST 0.61, lowest). The numbers themselves reproduce.

## 3. What could not be checked

- The Ong Ly et al. (2024) figures 0.97 / 0.60 (only the repo's own summary of them exists offline).
- The paper's Fig. 1 class sizes and its "lowest of 10 shown runs" (0.9486); the paper PDF was not re-read.
- That "1 of 389 recordings flips" is one recording and not two offsetting flips: only the CPU predictions are stored
  (`served_test_predictions.json`); the deployment-check JSON files give aggregates only and do not state the device
  inside the file (CPU/GPU is taken from the file names `round2b_final.json` and `round2b_final_gpu.json`; the CPU
  file's accuracy deficit equals 1/389 exactly).
- Whether any KAUH audio, or any Kaggle clip, is a re-encoded or lightly processed copy of another KAUH recording.
  Only exact byte/PCM identity (4 groups) was re-derived; the NCC detector was not re-run.
- The split-v2 rule numbers (row 20) were read from `source_baseline.json`; the v2 split manifest in
  `backend/artifacts/fusion-round2-split2/` was not re-fit.
- Whether the Kaggle remainder's pseudo-patient IDs (57 filename groups) correspond to real patients (see §5).

## 4. Wording risks (numerically right, but stronger than the evidence)

1. **"Models trained without KAUH data" (C-24, BIN ledger row, `FINAL_READINESS_REPORT.md`, `MANUSCRIPT_OUTLINE.md`
   §6).** The pre-round-2 and round-2 models were trained on 316 Kaggle clips cut from 40 KAUH patients (262 asthma,
   39 pneumonia, 15 bronchial; `kaggle_kauh_overlap.csv`). The 72 external patients are disjoint from those 40 (checked),
   but "without KAUH data" is wrong; say "without KAUH healthy or COPD patients (only KAUH-derived asthma, pneumonia
   and bronchial clips)".
2. **C-24 "0.47 → 0.83 after 2b".** The like-for-like comparator on the same 51-patient holdout is the previous model's
   0.57 [0.40, 0.73] (`binary_external.json`, EXP-017). Quote that, not the 72-patient 0.47. The gain is within-site.
3. **C-28 "in proportion to the number added".** The curve is 0 / 0.16 / 0.67 / 0.94 at k = 0 / 4 / 9 / 18: monotone, not
   proportional (convex then concave), and k counts patients of which about 83% (15 of 18) are healthy, so k is
   confounded with the number of healthy patients. The error bars in Fig. 7 are SDs over 10 random draws that are
   all subsets of the same 18 patients (not independent); k = 0 and 18 have one run each.
4. **C-29 / AST ledger decision "a stronger model exploits the source confound more, not less".** Probes show
   decodability, not use (C-26's own caveat). One frozen embedding with the highest dataset probe also has the highest
   disease probe (0.76). "Exploits" is causal; "carries" is what was measured. The "worst" held-out AUROC (0.21) is a
   single cell (§5, point 4).
5. **C-26 within-diagnosis range 0.77-0.98** includes `source | COPD` (3 KAUH patients vs 51 ICBHI) and
   `source | pneumonia` (5 ICBHI patients vs 25 Kaggle); Fig. 4 shows 1.00 for AST on the latter. These contradict
   the stated rule "per-class claims only with ≥ 5 patients" (`MANUSCRIPT_OUTLINE.md` R1). Also, the "edges" probe
   is called "recording start and end", which is not true of Kaggle clips (cut segments).
6. **C-23 "rivals".** Recording accuracy: rule 84.1 vs model 82.0. Patient level: rule 69.4% accuracy / 70.8%
   balanced vs model 75.5% / 74.9%, paired difference +4.1 [−7.2, +15.6], P 0.76. The recording-level gap favouring
   the rule is driven by 227 ICBHI COPD recordings of 389. "Rivals" is fair; "not distinguishable" (ledger decision)
   is fair; "no better than" would not be. The rule also needs the `kaggle_from_kauh` / `kaggle_unknown` split, which
   was itself recovered by audio matching, so "no audio" means "no audio at inference, with provenance metadata".
7. **C-30 "loses off-device COPD sensitivity".** True against frozen AST (−23.3 points, patient-cluster CI −36.5 to
   −10.1, 30 patients), not against the adopted fusion (−12.9, CI −28.9 to +3.9). The matrix gives no CI for either.
8. **C-10 / C-28 within-site.** Wording is right in C-10; Fig. 7's title says "adaptation" but the plotted AUROC mixes
   27 out-of-label diagnoses (heart failure etc.) into "abnormal", classes no model was trained on.
9. **C-13 "In-cohort only".** Fine; but `FINAL_READINESS_REPORT.md` quotes "75.5% patient accuracy [63.3, 87.8]" without
   saying that 11 of 49 test patients are healthy and 6 are untraceable Kaggle-remainder patients (74.4% / 68.0%
   without them).
10. **C-22.** The text "The adoption followed its fixed rule (P ≥ 0.90), so it stands" is accurate, but P ≥ 0.90 is
    a one-sided p ≤ 0.10 threshold, twice the conventional one-sided 0.05.

## 5. Methodological risks (findings only, nothing fixed)

### 5.1 Holm adjustment (`research/tools/multiplicity.py`)
- **Implementation:** correct step-down Holm (sorted ascending, multiplier m − rank, running maximum, cap at 1). I
  reproduced 0.164 and 1.0 by hand.
- **"1 − P(Δ > 0)" as a one-sided p:** defensible as the bootstrap "achieved significance level" of H0: Δ ≤ 0
  (percentile bootstrap; it counts ties as non-improvement, which is the conservative side; ties are negligible
  here: P(Δ < 0) and P(Δ ≤ 0) differ by < 0.001). The floor 1/(B + 1) = 1/1001 is the standard one. Caveats:
  (i) it is not a null-distribution p-value (the bootstrap is centred on the observed Δ, not on 0), so it is only
  approximately calibrated at small p; (ii) with B = 1,000 its Monte-Carlo standard error is about 0.007 at p = 0.05,
  so the Holm value 0.164 has an error of about ±0.03 (my 20,000-draw rerun gives 0.043 raw, about 0.17 Holm; the
  conclusion cannot change); (iii) resampling patients with fixed out-of-fold predictions ignores training
  variance (one CV partition, one seed per member), so the p-values are anti-conservative; (iv) the 3-fold CV
  folds are shared across all candidates, which is the right pairing, but the Kaggle remainder's "patients" are
  filename groups (see 5.2), so the resampling unit is partly not a patient.
- **Family definition:** the 4-member "pre-registered" family conditions on D3_x3 having been picked as best of six D3
  variants on the same OOF predictions (winner's curse). The selection step is not in the family. The honest
  family is larger (the 35-comparison family gives 1.0). The reported "p 0.164" is therefore optimistic, not
  pessimistic.

### 5.2 `backend/experiments/loso.py` (held-out-source AUROC)
1. **Well defined?** Yes mechanically: each held-out source has both classes (ICBHI 19 normal / 78 abnormal patients;
   Kaggle remainder 11 / 40; KAUH site 15 / 32; `loso.json`), patient-level AUROC, 2,000-draw patient bootstrap
   that skips one-class draws. But the intervals are wide (normal-group sizes 11-19), the classifier is a single
   logistic regression with one fixed C = 0.1 for all four representations (the served heads use 0.01 / 0.1 / 0.01), one
   seed and one CV partition. AUROC far **below** 0.5 (AST 0.21, OPERA-CE/ICBHI 0.38) is systematic inversion, not
   "chance"; the text calls both "near 0.5".
2. **Group "kauh_site" mixes two pipelines with the label perfectly confounded.** Development patients in this group:
   normals 15, all from the raw KAUH recordings; abnormals 32, of which 29 are Kaggle clips cut from KAUH (asthma 25,
   bronchial 2, pneumonia 2) and 3 are raw KAUH COPD. So held-out "KAUH site" AUROC largely measures raw KAUH file vs
   Kaggle-processed clip, not normal vs abnormal at a new hospital. This affects the 0.21 of C-29 and the KAUH-site
   cells of C-25.
3. **ICBHI held-out:** all 19 normals are Meditron-recorded children (aged 0-16) and abnormal ICBHI patients are
   mostly adult AKG C417L COPD, so the ICBHI cell tests age/device transfer as much as disease.
4. **Within-cohort comparator is not a clean reference.** (a) Kaggle remainder patient IDs are filename groups
   (CLAUDE.md: P-numbers are not patient IDs), so `StratifiedGroupKFold` may place the same real patient in different
   folds, inflating within-cohort AUROC for that source (0.92-0.95 for the three embeddings); (b) KAUH duplicates with
   conflicting labels (100↔101, 76↔77) can sit in different folds; (c) the held-out model is trained on two sources, the
   within-cohort model on two thirds of all three, so training size and composition differ.
5. **Leakage between training sources:** none found by construction: 631 ICBHI-copy clips are excluded; the
   detector's score gap is clean (KAUH matches ≥ 0.772, non-matches ≤ 0.573; ICBHI matches ≥ 0.795, non-matches ≤
   0.697), and the Kaggle clips cut from KAUH carry real KAUH IDs, so they sit with their site. Residual: the Kaggle
   remainder is defined as "no traced origin", i.e. clips whose source recordings are not in ICBHI or the public KAUH
   set; such clips could still be cuts of undisclosed recordings. AST is added to the figure and C-29 post hoc
   (not a pre-registered cell).

### 5.3 `backend/experiments/learning_curve.py`
- **Training on holdout patients or linked audio?** No. Verified: v2 holdout patients ∩ development patients = ∅ and
  ∩ test = ∅; no path overlap; no cohort KAUH file is byte-identical to a holdout file; no holdout patient has a
  Kaggle cut. v2 already drops 900076 and 900100, whose audio duplicates patients 77 and 101 (whose Kaggle cuts are
  in `base` for every k). Residual risks: near-duplicates (not byte-identical) were not tested; and the duplicate
  pairs show KAUH metadata is unreliable (patient 100 is "70 F", its twin 101 is "12 F").
- **Design limits:** 18 development KAUH patients only (15 healthy, 3 COPD), so the COPD arm cannot rise; draws at
  k = 4 and 9 are overlapping subsets of the same 18; evaluation reuses the v2 holdout that X3 already used (disclosed
  as diagnostic; it chose nothing); AUROC includes out-of-label patients as "abnormal"; the model is the three
  embedding heads, not the served fusion.

### 5.4 `research/tools/source_baseline.py`
- **Fitted without test labels?** Yes. `rule_scores` fits on rows with split in {train, validation}; unseen keys
  would fall back to the training majority; every test key was seen. I re-fit independently and reproduced 0.8406 /
  0.7078 exactly. For X1 L3 the rule is fit on each seed's training indices only. The paired comparison with the
  network uses the same `split_indices("L3", data, seed)` for both.
- **Post-hoc choice of rule:** two rule definitions are computed (`source`, `source+device`) and the ledger and
  figure use the better one on the test split. `source` alone gives 81.0% recording accuracy but only 52.2% patient
  balanced accuracy. Report both next to the model.
- **Source key derived from audio matching:** `kaggle_from_kauh` (patient ID ≥ 900,000) and `kaggle_unknown` are
  outputs of the copy detector; the Kaggle part of the rule is asthma / pneumonia by that key.
  The rule is a description of the dataset's structure, not a deployable baseline.
- **Composition:** 227 of 389 test recordings (13 of 49 test patients) are ICBHI COPD; recording accuracy is dominated
  by that block. Patient-balanced numbers (70.8 vs 74.9) are the informative ones, and carry the CI [−7.2, +15.6].
- `test_prediction_analyses.py` falls back to the globally most common rule label (COPD) rather than re-deriving the
  training majority; unused, since all keys are seen.

### 5.5 Fine-tuned AST (C-30), for completeness
- Early stopping on inner-validation recording accuracy over 123-159 recordings picked epochs 5/2/2, while inner NLL
  kept improving in fold 1 (epoch 4: 0.623 vs epoch 2: 0.674); the negative result is conditional on that noisy
  rule, one seed and a 6-epoch cap (disclosed as D-28/D-29). No variance estimate across seeds exists.

## 6. Figures: visual review

All 7 PNGs were opened. Values drawn equal the artifacts (rows 69-75; at least 60 plotted values compared).
Issues:
- **Fig. 3:** the label "chance (6 classes)" collides with the y-tick label 0.2 and the axis; the value labels 0.80, 0.59
  and 0.49 sit on top of the lines. The dotted "no-audio device rule (0.44)" line runs across the sample- and
  recording-level splits although it is valid only for the patient split; error bars are ±1 SD, not CIs.
- **Fig. 5:** the x-axis starts at 0.2, so the AST/KAUH-site point (0.21) touches the axis and its interval (lower
  limit 0.09) is cut off. Set the lower limit to 0.0. Panel titles use raw identifiers (`icbhi`, `kauh site`).
- **Fig. 4:** one colour scale (0.3-1.0) for columns whose chance levels differ (0.25 for disease within ICBHI/Kaggle,
  0.33 for source | healthy, 0.5 for source | COPD/pneumonia); `source | COPD` and `source | pneumonia` rest on 3 and
  5 patients per group with no indication.
- **Fig. 7:** no y-axis label; recalls and an AUROC (chance 0.5) share one axis; the error bars are not explained (SD of
  10 random draws; none at k = 0 and 18).
- **Fig. 6:** bars without intervals suggest a clear model advantage; the paired CI is [−7.2, +15.6] (v3) and none
  exists for v2. No chance line.
- **Fig. 2:** the right panel has no intervals (pneumonia: 6 patients, bronchial: 7). Fig. 1 had no issue.
