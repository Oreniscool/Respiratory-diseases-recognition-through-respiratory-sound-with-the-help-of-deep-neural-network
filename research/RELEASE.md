# Release package (data and code availability)

What the paper releases, and what it does not. `RELEASE_MANIFEST.csv` lists every file with its
SHA-256 (`python research/tools/release_manifest.py`; `--check` detects drift).

## Released: derived metadata and code, no audio

| Group | Files | Purpose |
|---|---|---|
| Evidence | `backend/data/kaggle_icbhi_overlap.csv`, `kaggle_kauh_overlap.csv`, `kauh_icbhi_overlap.csv` (+ `.summary.json`) | Every Kaggle clip with its best-matching ICBHI/KAUH recording, offset and NCC score; the KAUH ↔ ICBHI negative control |
| Evidence | `backend/data/kauh_internal_duplicates.csv` (+ summary) | Byte-identical KAUH files and their conflicting diagnoses (C-21) |
| Manifests | `backend/data/kauh_cohort_manifest.csv`, `kauh_external_holdout_manifest.csv` (v1, as used for X3), `kauh_external_holdout_manifest_v2.csv` (audio-linked patients removed), `kauh_external_manifest.csv` | Which KAUH patients were trained on or held out |
| Second external set | `backend/data/sprsound_manifest.csv` (+ `.summary.json`), `sprsound_overlap.csv` is absent because no overlap exists | Which SPRSound files were evaluated or excluded, and why (the audio and summaries come from the SPRSound repository, CC-BY-4.0) |
| Splits | `research/splits/v0`–`v3` | Frozen split manifests with SHA-256 (v0 = the contaminated one, kept for the record) |
| Governance | `research/*.md`, `EXPERIMENT_LEDGER.csv`, `CLAIM_EVIDENCE_MATRIX.csv` | Plan, frozen protocol, decisions, claims, audit, label mapping, demographics |
| Tools | `backend/cross_dataset_overlap.py`, `backend/kauh.py`, `backend/experiments/*.py`, `research/tools/*.py` | Re-derive every number from the original datasets |

## Not released
- **Audio.** Obtain it from the original sources:
  - ICBHI 2017 from the challenge database;
  - KAUH from Mendeley Data, doi:10.17632/jwyy9np4gv.3 (CC BY 4.0);
  - the Kaggle "Asthma Detection Dataset Version 2" from Kaggle.

  The evidence files reference recordings by file name only.
- **Trained models.** The research prototype's artifact (about 1.3 GB, including HeAR, which is
  gated on Hugging Face) is not part of the scientific release.
- **The ICBHI demographics file.** It is a public challenge file, re-downloadable from the Kaggle
  mirror `vbookshelf/respiratory-sound-database`. Its SHA-256 is recorded in `DEMOGRAPHICS.md`.

## Re-deriving the headline numbers
1. Download the three datasets into `backend/dataset/` (`backend/download_dataset.sh`, plus KAUH
   from Mendeley).
2. Run `python cross_dataset_overlap.py …` to reproduce the evidence CSVs, and compare them with the
   released ones.
3. Run `python research/tools/collect_evidence.py --check` to confirm the ledger matches the
   artifacts.
4. For each experiment, the ledger row's `artifact_location` and `code_version` say what to run.
