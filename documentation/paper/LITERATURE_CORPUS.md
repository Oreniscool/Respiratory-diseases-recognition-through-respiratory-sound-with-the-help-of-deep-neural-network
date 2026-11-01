# Phase 1 literature corpus (strict verification, 2026-11-01)

Citation policy: strict. Only entries in `references.bib`. "Opened" = full text or abstract page read this session;
"Crossref" = bibliographic metadata matched. Anything not listed here is NOT cited.

| Key | Role in paper | Opened | Crossref | What was verified (exact usable statement) | Caution |
|---|---|---|---|---|---|
| rocha2019 | ICBHI database | Yes (accepted manuscript) | Yes | 920 recordings from 126 participants; "largest publicly available" at the time | The CC BY-NC-ND 3.0 text in the PDF is the paper's licence, NOT the dataset's licence. 2026-11-02: no named dataset licence found; 2018 release announcement says "freely available for the research community" and asks for a citation; challenge site certificate expired (not bypassed). Ask the maintainers |
| fraiwan2021data | KAUH dataset | Metadata + Mendeley page | Yes | Dataset paper; dataset on Mendeley is CC BY 4.0 (10.17632/jwyy9np4gv.3) | Site notice mentions text/data-mining and AI-training reservations; read before redistribution |
| kaggleasthmav2 + tawfik2022 | The corpus audited | Kaggle API metadata | Yes (chapter) | Description lists 1,211 samples; lists sources "Respiratory Sound Database about 170", "ICBHI dataset 212", "individual patients"; class counts as listed sum to 1,181 because pneumonia is listed as 255 while the files contain 285 (`kaggle_icbhi_overlap.summary.json`); licence: Open Database / Database Contents | Description also inconsistent on patients (22 vs 18) and clip length |
| pham2021 | Patient-overlap inflation | Full text (arXiv v2) | Yes (JBHI 25(8)) | Quote (arXiv): systems following the ICBHI splitting recommendation (recordings from the same patient never in both subsets) "show considerably lower performance over all tasks than those following random splitting" | Recheck wording in the published JBHI version before quoting |
| nguyen2022 | Same | Full text (arXiv v1) | Yes (TBME 69(9)) | Quote (arXiv): performance on the official 60/40 ICBHI split without common patients is "significantly lower" than random 80/20 / 5-fold with patient overlap | Same: recheck in published version |
| pessoa2026 | Replication collapse | Full text | Yes | Replicates a published CNN+BDLSTM model; accuracy 83.5% without patient isolation vs 64.5% with patient-isolated folds (Tables 2, 3); names patient-overlap leakage | Pessoa et al. is about the 6-class ICBHI+KAUH protocol, not Asthma V2 |
| onglyi2024 | Site/device bias | Opened | Yes | ICBHI to JUST (KAUH), normal vs abnormal: source AUROC 0.97 [0.90, 1.00], external 0.60 [0.38, 0.81] | Different task (binary), not Asthma V2 |
| saky2026 | Closest neighbour | Full text (2026-11-02, via fetch-tool summary) | Yes | Trains on Asthma V2 (1,211 recordings, stratified recording-level split 847/182/182); ICBHI as external cohort; 12 exact duplicate audio pairs found within Asthma V2 and retained; no cross-dataset overlap analysis reported; states patient-level separation could not be confirmed | Read via a summary: search the PDF for "overlap", "duplicate", "ICBHI" before printing. Do NOT say their numbers were inflated |
| topaloglu2025 | Provenance confusion | Opened | Yes | External validation on a Kaggle copy cited as "Asthma Detection Dataset Version 2 (ICBHI 2017)"; 444 asthma + 250 control samples from 47 + 27 subjects; reports 98.3% (text) vs 98.13% (Table 6) | Their model was not trained on Kaggle V2, so this is a labelling/provenance example, not a Kaggle-to-ICBHI contamination example |
| dolu2026 | Provenance question | Opened | Yes | Says the data availability statement refers to a Kaggle-hosted dataset and creates "ambiguity regarding the provenance and exact version of the external validation data" | Comment only; no overlap analysis |
| shatat2026 | Timeliness | Full text (2026-11-02, via fetch-tool summary) | n/a (DOI from page) | Uses Asthma V2 as the only data source; stratified 5-fold CV formed before segmentation, so recording level (inferred); 98.6% +/- 0.14; no overlap or duplicate check; its literature review notes the dataset includes recordings from sources "such as ICBHI" | Reports 852 recordings in text vs Table 2 summing to 1,211; no patient ids described. Do not write that nobody noted ICBHI as a source |
| tawfik2025erespinet | Timeliness | Full text (2026-11-02, via fetch-tool summary) | n/a | Asthma V2 (1,211 recordings) and KAUH; stratified 60/20/20 split, split unit not stated; 98.9% / 98.8% with augmentation; 75.7% average (23.3-point gap) in bidirectional cross-dataset tests with KAUH, which it calls "independent"; no overlap check |  Same author as the corpus's first publication (Tawfik); split unit still not stated. 262/288 Kaggle asthma clips are KAUH cuts, so its asthma-side cross-dataset test is likely same-hospital audio; word as "likely", not re-run |
| kapoor2023 | Leakage across fields | Published version (Patterns 4(9) 100804, CC BY), 2026-11-02 | Yes | 17 fields, 294 papers, 8 leakage types | arXiv preprint says 329 papers; cite the published 294 |
| abhishek2025 | Dataset-audit genre | Abstract | Yes | Audits DermaMNIST, HAM10000, Fitzpatrick17k: duplicates, train-test leakage, mislabelled images; releases pipeline | Abstract only; no counts claimed |

## Dropped (not verified this session, not cited)
Kim et al. (ICASSP 2024; cut by author anyway), Copycats (NeurIPS D&B 2024), Zech 2018, Howard 2021, Kapoor and
Narayanan 2022, OPERA, HeAR, SPRSound, arXiv:2512.00563 (opened, but its abstract claims patient-level partitioning
for the same work that the published Saky version describes as recording-level; not cited because it adds a
version-discrepancy the paper doesn't need).

## Findings that change the plan
1. Shatat et al. (Sci Rep 2026) and Tawfik et al. (PLoS ONE 2025) are fresh examples of high accuracies (98.6%, 98.9%)
   on Asthma V2 with recording-level or unstated split units and no overlap check. They can anchor the
   Introduction's timeliness claim, phrased as "report ... without an overlap check", never as "inflated".
2. Topaloglu et al. labelled the Kaggle copy "ICBHI 2017". The provenance confusion is documented, not hypothetical.
3. The 1,181 vs 1,211 discrepancy is explained exactly: pneumonia 255 (description) vs 285 (files).
4. Dataset licences: KAUH CC BY 4.0 (verified); Kaggle V2 Open Database / Database Contents (verified metadata;
   page not reloaded 2026-11-02); ICBHI: no named licence found, only "freely available for the research community".
   The uploader's label does not change the ICBHI/KAUH owners' terms. Release of `kaggle_icbhi_overlap.csv` stays "available on request" until it is.
5. Done 2026-11-02: Saky, Shatat and Tawfik 2025 read in full (via a summary); none checks overlap. Before submission,
   search each PDF for "overlap", "duplicate" and "ICBHI" to confirm.
6. pham2021 / nguyen2022 wording not yet rechecked against the journal versions.
