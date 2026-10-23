# Independent audit of quoted numbers (2026-10-23)

Scope: `research/CLAIM_EVIDENCE_MATRIX.csv` (C-01 to C-20), `CLAUDE.md` §6, `documentation/ROUND2_EXPERIMENTS_REPORT.md` §9.2,
and the ledger rows EXP-012, EXP-015, EXP-016, X1, X2, X3, X5, C4, EXP-R2B-probes (plus EXP-003, EXP-010, EXP-011,
EXP-013, EXP-017, EXP-R2A-probes, EXP-R2A-D0/D3, which the claims cite).

Method: every value was recomputed from the raw artifact files, not from the ledger. External KAUH metrics were
re-aggregated from the `*_recordings.json` files (mean probability per patient, argmax). Clopper–Pearson intervals
were recomputed with `scipy.stats.beta`. Patient-cluster bootstraps were re-run with different seeds (X5: seed 12345,
20,000 draws; C4: seed 7, 20,000 draws). Cohort and device tables were rebuilt from
`backend/artifacts/latest/split_manifest.csv` and the overlap CSVs, and the leakage-ladder statistics from
`leakage_ladder/results.csv`. Nothing was trained, served or written apart from this file. Scratch scripts are in the
session scratchpad (`audit/`).

## Summary

| | Count |
|---|---:|
| Checks (rows in the tables below; most rows cover several numbers, about 400 individual values in total) | 120 |
| Match | 113 |
| Mismatch | 2 (C-06 wording "all COPD from ICBHI"; the EXP-010 limitation "252 clips match neither", which is 264 in the raw evidence) |
| Status not justified | 2 (C-13 cites the archived, no-longer-served model; C-19's criterion is met for 2 of 3 classes) |
| Unverifiable from files | 3 rows, plus 1 sub-item in the X1 ledger row (Kaggle description quotes, paper Fig. 1 class sizes, "saved files = restored models" checked only indirectly; X1 parameter count) |

Point estimates and counts in CLAUDE.md §6, ROUND2 §9.2 and the nine audited ledger rows all match the files exactly.
Every bootstrap CI I re-ran came out within about 0.01–0.02 of the stored one.

**New validity finding (not in any claim):** 3 recordings of 2 "external" KAUH holdout patients are byte-identical
to KAUH asthma recordings whose Kaggle cuts are in the served model's train and validation splits. Those 3 are exactly
the 3 holdout-healthy recordings the round-2b model calls asthma, and they account for X3's only healthy-patient
error. See §3.

## 1. Verification table

Abbreviations: `art/` = `backend/artifacts/`, `ext/` = `art/experiments/external/`, `r2a/` = `art/experiments-round2a/`.

### 1.1 Claim matrix

| Claim / location | Quoted value | Recomputed value | Source file | Verdict |
|---|---|---|---|---|
| C-01 three leaks | augmentation before split; random recording split; test-split checkpoint selection | `featureExtraction.py@3ec7dc6` appends noise/shift/stretch copies to X_ inside extraction; `train.py@3ec7dc6` fits with `validation_data=(x_test, y_test)` and `ModelCheckpoint(monitor='val_acc', save_best_only=True)`; paper text: "random split", "test data was 25%", "best model weight concerning the validation score" | `git show 3ec7dc6:…`, paper PDF (pdftotext) | match |
| C-01 / EXP-000 paper figure | 95.67% ± 0.77 (ledger sd 0.0077) | "Accuracy: 95.67 % ± 0.77 %" | paper PDF | match |
| C-02 L0 mean accuracy | 0.878 (20 seeds) | 0.8780 (n = 20) | `art/experiments/leakage_ladder/results.csv` | match |
| C-02 gap to paper | 7.9 pts | 0.9567 − 0.8780 = 0.0787 | same | match |
| C-02 status "not met" | \|L0 − 0.9567\| ≤ 0.03 | 0.0787 > 0.03 | same | match (status justified) |
| C-02 class sizes differ for two classes | Bronchiectasis/Bronchiolitis | released code: 80 / 65 samples (`features_summary.json`); paper Fig. 1 is an image | `leakage_ladder/features_summary.json` | unverifiable (paper side) |
| C-03 balanced accuracy L0 → L3 | 0.872 → 0.385 | 0.8716 → 0.3845; paired drop 0.4871 (sd 0.100) | `results.csv`, `summary.json` | match |
| C-03 accuracy L0 → L3 | 0.878 → 0.598 | 0.8780 → 0.5980; paired drop 0.2800 | same | match |
| C-03 test COPD share | 22.5% vs 59% | 0.225 / 0.5913 | `leakage_ladder/baselines.json` | match |
| C-03 always-COPD baseline at L3 | 0.591 | 0.5913; model − constant paired 0.0067 | same | match |
| C-03 status | drop ≥ 0.15 | 0.487 (balanced), 0.280 (accuracy): met on either metric | same | match (status justified) |
| C-04 copies | 631 | 631 of 1,211 rows with `is_overlap`; by class COPD 401, pneumonia 105, healthy 74, bronchial 51, asthma 0 | `backend/data/kaggle_icbhi_overlap.csv` | match |
| C-04 score gap | clean gap | min overlap NCC 0.7951, max non-overlap 0.6973 (threshold 0.75); `is_overlap` ⇔ NCC ≥ 0.75 for every row | same + `.summary.json` | match |
| C-05 KAUH cuts | 316 | 316 (asthma 262, pneumonia 39, bronchial 15); 0 clips in both overlap files | `backend/data/kaggle_kauh_overlap.csv` | match |
| C-05 mixed groups | 57 of 64 (KAUH), 35 of 98 (ICBHI) | 57/64, 35/98 (independent re-implementation) | both overlap CSVs | match |
| C-05 distinct KAUH patients | (40 in CLAUDE.md) | 40 | same; `latest/dataset_audit.json` | match |
| C-06 "all COPD from ICBHI" | all COPD from ICBHI | split v3: 793 of 805 COPD recordings (64 of 68 COPD patients) are ICBHI; 12 recordings / 4 patients are KAUH. True only for the pre-2b cohort (v2: COPD 793, all ICBHI) | `latest/split_manifest.csv`, `latest/dataset_audit.json`, `fusion-round2-split2/dataset_audit.json` | **mismatch** (see §2.1) |
| C-06 KAUH-derived training audio pre-2b | non-healthy / non-COPD | the 316 KAUH cuts: asthma 262, bronchial 15, pneumonia 39 | `kaggle_kauh_overlap.csv` | match |
| C-06 / DATASET_AUDIT §4 device × class table | all 35 cells | identical in every cell (e.g. ICBHI AKGC417L COPD 646; Kaggle unknown 252) | rebuilt from `split_manifest.csv` + overlap CSV | match |
| C-06 / DATASET_AUDIT §4 patient table | all cells | identical (ICBHI 126, Kaggle 97, KAUH 21: 4 COPD / 17 healthy) | `split_manifest.csv` | match |
| C-07 split v2 probes | dataset > disease, device > disease, all 5 reps | MFCC 0.896/0.769 > 0.590; OPERA-CE 0.989/0.885 > 0.666; OPERA-CT 0.943/0.876 > 0.691; YAMNet 0.914/0.822 > 0.715; YAMNet-bandpass 0.946/0.822 > 0.670 | `r2a/shortcut_probes.json` | match |
| C-07 split v3 probes | same, all 4 reps | MFCC 0.807/0.796 > 0.545; HeAR 0.914/0.882 > 0.694; OPERA-CE 0.931/0.881 > 0.742; YAMNet 0.804/0.791 > 0.657 | `art/experiments/shortcut_probes.json` | match |
| C-08 EXP-011 | 0/45 | 0/45; healthy → asthma 34, pneumonia 1; COPD → asthma 9; bronchial → asthma 1 | `r2a/external/previous_served_model_recordings.json` | match |
| C-08 EXP-013 | 0/45 | 0/45; healthy → asthma 32, pneumonia 3; COPD → asthma 9; bronchial → COPD 1 | `r2a/external/served_round2_recordings.json` | match |
| C-08 exact CI | 0–7.9% | CP(0, 45) = 0–7.9% | scipy | match |
| C-09 asthma share at 4 kHz, COPD | 0.040; 14/346; CI 2.2–6.7% | 14/346 = 0.0405; CP 2.2–6.7% | `art/experiments/site_vs_band/served_round2_recordings.json` | match |
| C-09 healthy | 0.083 (1 of 12); CI 0.2–38.5% | 1/12; CP 0.2–38.5% | same | match |
| C-09 bronchial | 0.045 | 1/22 = 0.0455 | same | match |
| C-09 accuracy drops | COPD 0.905 → 0.850; healthy 0.833 → 0.500 | 0.9046 → 0.8497; 0.8333 → 0.5000 | same | match |
| C-09 "~1.0 for KAUH patients" | ~1.0 | round-2 model on KAUH: patients predicted asthma 41/44 healthy+COPD (COPD 9/9, healthy 32/35); recordings 118/132 = 0.89 (healthy 91/105 = 0.87, COPD 27/27) | `r2a/external/served_round2_recordings.json` | match (approximate; see §4) |
| C-10 holdout accuracy | 17/24 (70.8%), CI 48.9–87.4% | 17/24, CP 48.9–87.4% | `ext/served_round2b_final_recordings.json` | match |
| C-10 healthy / COPD | 17/18; 0/5 (CI 0–52%) | 17/18 (CP 72.7–99.9%); 0/5 (CP 0–52.2%); bronchial 0/1 | same | match |
| C-10 balanced accuracy | 31.5% | 0.3148 over the 3 labels present | same | match |
| C-10 comparison arm | 0/24 | 0/24 (CP 0–14.2%) | `ext/previous_round2_on_holdout_recordings.json` | match |
| C-10 out-of-label moved to healthy | asthma → healthy | before: asthma 63, pneumonia 17, COPD 1; after: healthy 52, asthma 26, COPD 2, bronchial 1 (of 81) | both files | match |
| C-10 status "partly supported" | ≥ +0.30 | +0.708 on accuracy; COPD and balanced accuracy not | same | match (status justified) |
| C-11 OPERA-CE worse on off-device COPD | worse | OOF off-device COPD sensitivity: OPERA-CE 0.345 vs D3 0.672, D0 0.638 | `art/experiments/results.json` | match |
| C-11 HeAR better | better | HeAR 0.698 vs D3 0.672 (small) | same | match |
| C-11 status "unsupported" | non-overlapping CIs | no CIs exist for these | same | match (status justified) |
| C-12 pre-2b Δ range | +0.3 to +9.4 pts | EXP-017 +0.31, EXP-013 +7.90, EXP-011 +9.38 | `art/experiments/x5_abstention.json`, recordings files | match |
| C-12 pre-2b CIs include 0 | all include 0 | stored [−6.7, 25.4], [−8.6, 24.2], [−18.5, 19.8]; my re-run [−6.7, 25.7], [−8.2, 24.0], [−18.7, 19.3] | same | match |
| C-12 "about two thirds" of wrong in-label calls not abstained | ~2/3 | EXP-011 91/135 = 67.4%, EXP-013 89/135 = 65.9%, EXP-017 42/72 = 58.3% (all in-label calls wrong) | recordings files | match (58% for EXP-017) |
| C-12 round 2b rates | 64.2% vs 45.8% | 52/81 = 0.642; 33/72 = 0.458 | `ext/served_round2b_final_recordings.json` | match |
| C-12 round 2b Δ | +18.4 [2.8, 33.6] | +18.36; stored CI [2.78, 33.64]; my re-run [3.1, 34.0] | same | match |
| C-12 selective accuracy | 69.4% → 79.5% | 50/72 = 0.694 → 31/39 = 0.795 | same | match |
| C-12 status | CI excludes 0 | met only for the site-exposed model | same | match (status justified) |
| C-13 numbers (EXP-012) | patient acc 73.33% [60.0, 86.7], 45 patients | 0.7333 [0.600, 0.8667], 45 | `art/fusion-round2-split2/test_metrics.json` | match |
| C-13 "of the served model" | served model | the served model is EXP-016 (`latest/`): 75.51% [63.3, 87.8], 49 patients. EXP-012's metrics also describe the epoch-64 restored weights, not its own saved epoch-67 file (val_acc history: min_delta best 64, best raw 67) | `latest/test_metrics.json`, `fusion-round2-split2/training_history.json` | **status not justified** (see §2.2) |
| C-14 speed | ~2× | split v2 CV: D0 75.1 min / 215 epochs vs D3 33.8 / 198 (2.22× total, 2.04× per epoch); split v3: 71.1/193 vs 38.6/191 (1.84×, 1.82×) | `r2a/run_D0.json`, `r2a/run_D3.json`, `art/experiments/run_D*.json` | match |
| C-14 similar accuracy | similar | OOF patient balanced 0.6579 (D0) vs 0.6638 (D3) on v2; 0.6385 vs 0.6573 on v3 | `r2a/results.json`, `art/experiments/results.json` | match |
| C-15 healthy within-label source probe | 19/11/15 pts; 0.82 MFCC, 0.91–0.96 embeddings; chance 0.33 | patients 19/11/15; MFCC 0.822; YAMNet 0.913, OPERA-CE 0.959, HeAR 0.959; chance 0.333 | `art/experiments/shortcut_probes.json` | match |
| C-15 COPD ICBHI vs KAUH | 3 KAUH patients; MFCC at chance 0.50 | 51 ICBHI / 3 KAUH; MFCC 0.499 | same | match |
| C-16 synthetic recall | 99 of 100 | 99/100 above 0.75 with correct source | `art/experiments/match_validation/synthetic_results.json` | match |
| C-16 the miss | score 0.621, correct source | `synthetic_035`: best NCC 0.621, best reference = true source | same | match |
| C-16 no KAUH ↔ ICBHI match | 0 | 0 of 336 (max NCC 0.5513) | `backend/data/kauh_icbhi_overlap.csv` | match |
| C-16 listening check prepared, awaiting user | 20 pairs | 40 wav files + `answer_sheet.csv` with empty answers | `match_validation/listening/` | match |
| C-17 balanced accuracy, validation-selected | 0.799 → 0.511 → 0.384 | 0.7985 → 0.5112 → 0.3845 | `results.csv` | match |
| C-17 drops | −0.287, −0.127 | paired 0.2873 (sd 0.092), 0.1267 (sd 0.142) | same | match |
| C-17 test-selection inflation | +0.073 / +0.075 / +0.107 | L0−L1 0.0730; L2T−L2 0.0754; L3T−L3 0.1071 | same | match |
| C-17 20 seeds per cell | 20 | 20 rows for each of the 6 rungs | same | match |
| C-18 COPD within model | 81.1% (26) vs 41.5% (38), +39.5 [26.9, 50.9] | 90/111 = 0.811 (26 pts) vs 157/378 = 0.415 (38 pts); +0.3955; stored CI [0.269, 0.509]; my re-run [0.269, 0.513] | `contamination/kaggle_all_recordings.json`, `analysis.json` | match |
| C-18 bronchial within model | 62.5% (7) vs 13.2% (22), +49.3 [23.4, 82.1] | 10/16 (7 pts) vs 5/38 (22 pts); +0.4934; re-run [0.233, 0.811] | same | match |
| C-18 status | CI excludes 0 | both CIs exclude 0 | same | match (status justified) |
| C-19 healthy | 96.2% → 15.4%, 21 pts, +80.8 [65.4, 93.6] | 25/26 → 4/26 (21 pts); +0.8077; re-run [0.654, 0.957] | both recordings files (paired by recording) | match |
| C-19 pneumonia | 85.3% → 32.4%, 6 pts, CI 27.3–71.4 | 29/34 → 11/34 (6 pts); +0.5294; re-run [0.273, 0.708]. The CI is for the difference | same | match |
| C-19 bronchial | 62.5% → 43.8%, CI −25.0 to 61.5 | 10/16 → 7/16; +0.1875; re-run [−0.267, 0.625] | same | match |
| C-19 status "verified" | paired difference > 0, CI excludes 0 | met for healthy and pneumonia, **not** for bronchial | same | **status not justified** (see §2.3) |
| C-19 / C4 training size | 715 → 338 | 715 → 338 train recordings | `contamination/model_kaggle_{all,clean}/split_summary.json` | match |
| C-20 ICBHI material | 631 clips from 187 recordings | 631 clips, 187 distinct references (60 ICBHI patients) | `kaggle_icbhi_overlap.csv` | match |
| C-20 KAUH material | 316 clips from 115 recordings | 316 clips, 115 distinct references (40 patients) | `kaggle_kauh_overlap.csv` | match |
| C-20 Kaggle description "212 samples", "about 170 samples" | quoted | only present in `research/LITERATURE_REVIEW.md`; the web page cannot be checked from files | — | unverifiable |

### 1.2 CLAUDE.md §6 (current file on disk)

| Row | Quoted value | Recomputed value | Source file | Verdict |
|---|---|---|---|---|
| Classes | asthma, bronchial, copd, healthy, pneumonia | same order | `latest/model_metadata.json` | match |
| RespiNet members | 3 seeds (42/43/44), 458,701 params each | 3 files, SHA-256 match `fusion.members[0]`; 458,701 in all 3 `model_summary.txt` | metadata, `model_summary.txt`, `ensemble/seed4*/` | match |
| Heads | YAMNet C 0.01, OPERA-CE C 0.1, HeAR C 0.01; equal weights | same; weights [1, 1, 1, 1]; head SHA-256 match files | metadata | match |
| Cohort | 1,551 / 244 | 1,551 / 244 | `latest/dataset_audit.json`, `split_manifest.csv` | match |
| ICBHI / Kaggle / KAUH | 920/126; 568/97 (40 KAUH + 57 groups); 63/21 (17 healthy, 4 COPD) | 920/126; 568/97 (40 IDs in 900001–900107, 57 others); 63/21 (17 healthy, 4 COPD) | same | match |
| Split v3 patients | 146 / 49 / 49 | 146 / 49 / 49 | `split_summary.json`, manifest | match |
| Split v3 recordings | 837 / 325 / 389 | 837 / 325 / 389 | same | match |
| Split SHA-256 | `8bdc97ff…` | `sha256sum split_manifest.csv` = 8bdc97ff…c97c; same in metadata | manifest | match |
| Restored epochs | 45 / 46 / 78 | EarlyStopping rule (min_delta 0.003) on val_accuracy: 45, 46, 78 (seed 44's raw max is epoch 79, +0.0017 over 78, below min_delta) | `training_history.json`, `ensemble/seed4*/training_history.json` | match |
| Saved files = restored models | yes (D-24) | not checked directly (models not loaded). Indirect: GPU served-file re-scoring reproduces `test_metrics.json` exactly | `deployment_checks/round2b_final_gpu.json` | unverifiable directly |
| Member temperatures | 0.9099, 1.0570, 1.5085, 1.0973 | 0.90993, 1.05697, 1.50854, 1.09730 | metadata | match |
| Fused temperature | 0.5489 | 0.54886 | `calibration.json` | match |
| Abstention | 0.6629, 0.5060, 80% | 0.66293, 0.50601, 0.8 | `calibration.json` | match |
| Test accuracy rec / pat | 82.01% / 75.51% (49) | 0.82005 / 0.75510 (37/49) | `latest/test_metrics.json` | match |
| Balanced accuracy | 73.47% / 74.87% | 0.73469 / 0.74870 | same | match |
| Macro F1 | 0.704 / 0.739 | 0.7039 / 0.7386 | same | match |
| ECE | 0.0743 / 0.0853 | 0.07430 / 0.08533 | same | match |
| AUROC | 0.9190 / 0.9394 | 0.91895 / 0.93939 | same | match |
| Patient-bootstrap CI | 63.3–87.8% (1,000) | 0.6327–0.8776, 1,000 samples (plausible: CP for 37/49 is 61.1–86.7%) | same | match |
| By source | ICBHI (29) 87.55/75.86; Kaggle (17) 71.54/76.47; KAUH (3) 66.67/66.67 | identical | `test_metrics.json["by_source"]` | match |
| KAUH holdout | 24 in-label of 51; 17/24 (70.8, CI 48.9–87.4); healthy 17/18; COPD 0/5 (CI 0–52); bronchial 0/1; balanced 31.5; previous 0/24 | identical (51 patients = 24 in-label + 27 out-of-label) | `ext/served_round2b_final*.json`, `ext/previous_round2_on_holdout*.json` | match (but see §3 on "never in training") |
| Reproduction | GPU exact; CPU 1 of 389 flips; patient identical | GPU: every metric equal, max diff 0; CPU: accuracy 0.81748 vs 0.82005 (= 1/389), patient metrics equal | `deployment_checks/round2b_final{_gpu,}.json` | match |
| Code revision | `724c52c` | 724c52cc7750… | metadata | match |
| "not comparable with … 73.33% on 45 patients" | 73.33%, 45 | 0.7333, 45 | `fusion-round2-split2/test_metrics.json` | match |

### 1.3 ROUND2_EXPERIMENTS_REPORT.md §9.2

| Item | Quoted value | Recomputed value | Source file | Verdict |
|---|---|---|---|---|
| Run #2 epochs | checkpoint 56/44 vs restored 50/42 | seed 43: restored 50, last raw best 56; seed 44: 42, 44 | `superseded-prod2b-ckpt-mismatch-2026-10-23/ensemble/seed4*/training_history.json` | match |
| Test split size | 49 patients, 389 recordings | 49, 389 | `latest/test_metrics.json`, `split_summary.json` | match |
| Accuracy | 82.01% / 75.51% (CI 63.3–87.8) | see §1.2 | same | match |
| Balanced accuracy | 73.47% / 74.87% (CI 63.4–86.6) | 0.7347 / 0.7487 (CI 0.6336–0.8659) | same | match |
| Macro F1 / AUROC / ECE | 0.704/0.739; 0.919/0.939; 0.074/0.085 | 0.7039/0.7386; 0.9190/0.9394; 0.0743/0.0853 | same | match |
| Patient sensitivity | asthma 8/8, COPD 12/14, healthy 7/11, bronchial 5/8, pneumonia 5/8 | 1.0 (8), 0.857 (14), 0.636 (11), 0.625 (8), 0.625 (8); sums to 37/49 | `patient_level.per_class` | match |
| By source (patient) | ICBHI 75.9% (29), Kaggle 76.5% (17), KAUH 2/3 | 22/29, 13/17, 2/3 | `by_source` | match |
| Holdout, previous model | 0/24 (CI 0–14.2); 0/18; 0/5; 0/1; 0.0%; OOL asthma 63, pneumonia 17, COPD 1 | identical | `ext/previous_round2_on_holdout_recordings.json` | match |
| Holdout, round 2b | 17/24 (70.8, CI 48.9–87.4); 17/18; 0/5 (CI 0–52); 0/1; 31.5%; OOL healthy 52, asthma 26, COPD 2, bronchial 1 | identical | `ext/served_round2b_final_recordings.json` | match |
| 18 of 24 healthy; 4 KAUH COPD in training | 18; 4 | 18 healthy holdout patients; KAUH COPD patients in v3 cohort: 4 | holdout file; `split_manifest.csv` | match |
| Abstention OOL vs in-label | 64% vs 46% | 0.642 vs 0.458 | same | match |
| Parity | 4.7e-5 on 12, 12/12 | 4.75e-5 (CPU run), 12/12; GPU run 5.66e-5 | `deployment_checks/round2b_final*.json` | match |
| Gate | rejects tone, noise, silence; accepts a test recording | 422/422/422/200 | same | match |
| CPU reproduction | 1 flip; recording balanced 72.3% vs 73.5% | 0.7229 vs 0.7347; patient metrics identical | `round2b_final.json` | match |
| Artifact size | ~1.3 GB, HeAR 1.2 GB | 1.32 GB; `hear/` 1.22 GB | `du` on `latest/` | match |

### 1.4 Ledger spot checks (values against raw files)

| Row | Fields checked | Verdict |
|---|---|---|
| EXP-012 | patient balanced 0.7192; by-source 0.7037/0.7778; patient acc 0.7333 [0.6, 0.8667]; AUROC 0.9053; macro F1 0.6729; 45 patients; recording acc 0.8125, balanced 0.7049, ECE 0.0455; code `b1698e9`; split SHA `1dc93397…` (= `sha256sum`); epoch 64 restored vs 67 saved | match |
| EXP-015 | patient balanced 0.7669; by-source 0.7931/0.7647/0.6667; acc 0.7755 [0.6531, 0.8776]; AUROC 0.9382; F1 0.7588; 49; recording 0.8252/0.7507/0.0723; epochs 50/42 vs 56/44; GPU re-scoring 0.8226 / 0.7427 (1 recording); CPU 0.8201 (2 recordings); holdout 17/24, 17/18, 0/5 (`ext/served_round2b.json`) | match |
| EXP-016 | patient balanced 0.7487; by-source 0.7586/0.7647/0.6667; acc 0.7551 [0.6327, 0.8776]; AUROC 0.9394; F1 0.7386; 49; recording 0.8201/0.7347/0.0743; KAUH test patients 3; GPU exact, CPU 1/389 | match |
| X1 | every rung mean/sd/min/max, all `drop_*` and `balanced_drop_*`, `constant_baselines` | match (recomputed from `results.csv`); "328,726 parameters" not checked (would need the model built) |
| X2 | all 6 condition × class cells (recordings, accuracy, predicted_asthma, prediction counts, 1 gate rejection) | match |
| X3 | 0.7083; 24 in-label; OOL abstention 0.642; OOL predictions; patient predictions; sensitivities; in-label abstention 0.4583; CIs 72.7–99.9, 0–52.2 | match |
| X5 | all four evaluations: rates, differences, CIs (re-run within ±0.005), selective accuracy, accepted counts | match |
| C4 | primary 0.3955; within-model and between-model accuracies, patient counts and CIs (re-run within ±0.02); 715 → 338 | match |
| EXP-R2B-probes | all 4 representations × 3 probes + 8 within-label values | match |
| EXP-003 / EXP-010 / EXP-011 / EXP-013 / EXP-017 / EXP-R2A-probes / EXP-R2A-D0, D3 | primary and secondary values | match, except the EXP-010 limitation "252 Kaggle clips match neither" (§2.4) |

## 2. Mismatches and unjustified statuses

### 2.1 C-06 (and `research/DATASET_AUDIT.md` §4): "all COPD from ICBHI"
C-06's criterion and DATASET_AUDIT §4 ("**Confound.** All COPD audio is ICBHI (646 of 793 …)") describe the cohort
before round 2b. The table directly above that sentence, and `latest/split_manifest.csv`, show that split v3 has 805
COPD recordings: **793 ICBHI and 12 KAUH (4 KAUH COPD patients, 64 of 68 COPD patients ICBHI)**. Correct wording:
"In split v3, 793 of 805 COPD recordings (98.5%) and 64 of 68 COPD patients are ICBHI. Before round 2b all COPD was
ICBHI. 646 of the 793 ICBHI COPD recordings are AKG C417L, a device that records no other class." The status
`verified` holds for the confound itself, since every other quoted cell matches.

### 2.2 C-13: wrong model
The claim is "leak-free in-cohort test accuracy of the served model", but the evidence is EXP-012 (archived in
`fusion-round2-split2/`). Since commit 11f5d7c the served model is EXP-016 (`latest/`): **patient accuracy 75.51%
(37/49, bootstrap 95% CI 63.3–87.8%), recording accuracy 82.01%, split v3**. EXP-012's own figures (73.33%, 45 patients)
match their file. However, its ledger row says they describe the EarlyStopping-restored epoch-64 weights, not the
saved epoch-67 file (`training_history.json`: min_delta-best epoch 64, raw best 67), so they were never the metrics of a
served file. Repoint C-13 at EXP-016, or reword it as "the round-2 model".

### 2.3 C-19: status `verified`, but the criterion is met for 2 of 3 classes
The criterion is a paired difference > 0 with a CI excluding 0. That holds for healthy (+80.8 [65.4, 93.6]) and
pneumonia (+52.9 [27.3, 71.4]). It does not hold for bronchial (+18.75 [−25.0, 61.5]), and 62.5% → 43.8% is not
"most of the accuracy". Correct status: **verified for healthy and pneumonia; not shown for bronchial** (or
"partly supported"). In the notes, "pneumonia … (6 patients, CI 27.3–71.4)" reads as a CI on 32.4%. It is the CI of
the +52.9-point difference.

### 2.4 EXP-010 limitation: "252 Kaggle clips match neither ICBHI nor KAUH"
In the raw evidence it is **1,211 − 631 − 316 = 264** clips (no clip is in both overlap files). 252 is the count
after the 12 byte duplicates are removed (the cohort's "Kaggle, source unknown" row: 568 − 316 = 252). Say "252 of the
568 retained clips" or "264 of 1,211".

## 3. New validity finding: KAUH byte duplicates reach the "external" holdout

`dataset/KAUH/audio` has 336 files but only 332 distinct SHA-256 hashes. Three of the four duplicate pairs pair a
**healthy holdout recording** with a recording from a **different KAUH patient labelled asthma**:

| Holdout recording (label healthy) | Identical file (label asthma) | Kaggle cuts of it (NCC ≈ 1.0) in split v3 | Round-2b prediction |
|---|---|---|---|
| `BP100_N,N,P R M,70,F` (patient 900100) | `BP101_Asthma,…,12,F` (900101) | P52WheezingRL_259 / RS_260, **validation** | asthma |
| `DP100_N,N,P R M,70,F` (900100) | `DP101_Asthma,…,12,F` (900101) | P17WheezingIE_85, P18WheezingIU_86, **validation** | asthma |
| `EP76_N,N,A L U,31,M` (900076) | `EP77_Asthma,…,40,M` (900077) | P49WheezingRL_243 / RS_244, **train** | asthma |

(The fourth pair, BP9/DP9, is one patient under two filter names.) These are the only 3 healthy-holdout recordings the
round-2b model calls asthma. The non-duplicated recordings of the same patients (EP100, BP76, DP76) are called healthy.
Patient 900100 (mean asthma probability 0.52) is X3's only healthy error. So:
- "51 patients never in training" (CLAUDE.md §6, ROUND2 §9.2, X3) holds for patient IDs but not for audio. The
  external-set guard in `experiments/external.py` checks IDs only.
- The effect on the conclusions is small, and the duplicates do not create the result: without 900100, healthy is
  17/17, and COPD stays 0/5. In C-08 and EXP-011/013, 2 of the 35 healthy patients have audio that the model had seen
  (round-2 split v2: both 900077 and 900101 in validation).
- Which label is true cannot be decided from the files (it is a KAUH data defect). The cleanest fix is to drop or flag
  900100 and 900076 from the holdout, or dedupe KAUH by hash before cohort and holdout are formed.
- In `kaggle_kauh_overlap.csv`, the reference assignment for clips that match these files is a tie (best and second
  NCC both 1.0000), so the KAUH ID given to those Kaggle clips is arbitrary between the two patients.

## 4. Wording risks (numerically right, but they overclaim)

- **C-07 "more easily":** compares raw balanced accuracies across tasks with different chance levels (dataset 2 or 3
  classes, ICBHI device 4, disease 5). The conclusion survives chance normalisation for every representation (e.g. v3
  YAMNet: dataset (0.804 − 1/3)/(2/3) = 0.71 vs disease (0.657 − 0.2)/0.8 = 0.57), but the text should say
  "chance-normalised" or give the chance levels. Probes are linear and run on development patients only.
- **C-09 title "is a site/device shortcut":** X2 rules out one alternative (4 kHz bandwidth). It does not show the
  shortcut directly. The notes' safe wording ("not explained by sample rate alone") should be the claim. The exact CIs
  (COPD 14/346 → 2.2–6.7%) treat 346 recordings from 26 patients as independent, so they are too narrow. Healthy is 12
  recordings from 11 patients. "~1.0 for KAUH" is 0.93 of patients (0.87 of healthy recordings), and it compares a
  patient-level KAUH figure with recording-level ICBHI shares.
- **C-10 / X3:** correctly labelled within-site. Add the §3 caveat. Per-class results rest on 5 COPD and 1 bronchial
  patient.
- **C-13 "leak-free":** 252 Kaggle clips have unverified patient grouping (the model's own `limitations` say so), and
  §3 shows KAUH has cross-patient duplicates. "Free of known leaks" is safer. The KAUH test subset is 3 patients
  (CLAUDE.md "KAUH (3) 66.67%"), so it cannot support any per-source claim.
- **C-14:** D3 changes both the GRU kernel (cuDNN) and SpecAugment (batch → per-sample), so the speed-up is not
  attributable to cuDNN alone. One seed, 3 folds. Per epoch it is 2.04× (v2) and 1.82× (v3).
- **C-17 ordering "… then patient overlap, then checkpoint selection":** the patient-overlap step (0.127, paired sd
  0.142, SE ≈ 0.032) and patient-level test-selection inflation (0.107, SE ≈ 0.017) are not distinguishable. Only
  "the first step is largest" is robust. That step also mixes augmented-copy leakage with recording overlap, as the
  notes say.
- **C-03:** the metric was switched from accuracy to balanced accuracy after the first evaluation (D-19). The
  criterion is met on both (0.280 and 0.487), so it's worth saying so.
- **C-18 "largely re-tests training audio" (C4 interpretation):** the "copied" group mixes ICBHI recordings whose Kaggle
  cuts were in the Kaggle model's training split (COPD 69 recordings, 97.1% correct) with ones whose cuts were only in
  its validation/test split (COPD 42, 54.8%). This supports the memorisation reading, but the claim should say it.
  Copied and clean groups are different patients (26 vs 38).
- **C-19:** the two models were trained at different code revisions (`092d93e` vs `a21b510`), as well as with
  different class sets and training sizes. Pneumonia rests on 6 patients and bronchial on 7.
- **C-15:** within-label COPD (3 KAUH patients) and pneumonia (5 ICBHI patients) are under-powered. Only healthy,
  asthma and bronchial support "well above chance".
- **C-16 "reliably":** the recall test uses synthetic degradations of ICBHI audio, and the negative control is a single
  dataset pair (KAUH vs ICBHI). The listening check is still unanswered.
- **C-12:** after round 2b the out-of-label KAUH recordings are mostly *called healthy* (52/81). A higher abstention
  rate there reflects site exposure, not out-of-distribution detection. The notes already say this; the status label
  "weakly supported" should keep the qualifier.
- **ROUND2 §9.2 "On the CPU … 1 recording flips (TF32 near-tie)":** TF32 is a GPU mode. The flip happens because the
  reference metrics were computed with TF32 on the GPU. Worth one more word.
- **Per-class claims on fewer than 5 patients:** KAUH test subset (3 patients), X3 bronchial (1), C-15 COPD KAUH (3),
  C-09 healthy (12 recordings / 11 patients). None should be quoted on its own.

## 5. Not verifiable from files
- The Kaggle dataset description quotes in C-20 ("212 samples", "about 170 samples"). They exist only in
  `research/LITERATURE_REVIEW.md`.
- The paper's Fig. 1 class sizes (C-02 / X1 limitation). The figure is an image.
- X1's "328,726 parameters". Checking it would mean building the 2021 model.
- That the saved `.keras` files are the restored models (CLAUDE.md §6). I did not load the models. The GPU
  served-file reproduction of `test_metrics.json` is consistent with it.
