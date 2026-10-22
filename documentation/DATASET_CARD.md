# Dataset usage card

## Current training cohort (2026-10-22)

| Source | Recordings | Patients | Identity quality | Notes |
|---|---:|---:|---|---|
| ICBHI 2017 Respiratory Sound Database | 920 | 126 | real patient IDs | authentic diagnoses, mapped to 5 classes (`reorganize_icbhi.py`) |
| Kaggle Asthma Detection Dataset V2 (remainder) | 568 | 97 | 316 clips: **real KAUH patient IDs** (40 patients); the other 252: unverified filename groups | after removing 631 cuts of ICBHI and 12 byte duplicates |
| **Total** | **1,488** | **223** | | patient-disjoint split 133 / 45 / 45 (since round 2) |

**External test set (never trained on):** 72 KAUH patients who contributed no clip to Kaggle,
216 recordings (`backend/data/kauh_external_manifest.csv`): 35 healthy, 9 COPD, 1 bronchial, and 27
with diagnoses outside the five labels.

**Kaggle V2 is not independent of ICBHI.** Its description says some clips were segmented from
ICBHI. Normalized cross-correlation of every Kaggle clip against every ICBHI recording found
**631 verbatim cuts (52%)**: all 401 COPD clips, 74 healthy, 51 bronchial, 105 pneumonia, and 0
asthma. They come from 60 ICBHI patients. Match scores are ≥ 0.795 for these clips and ≤ 0.697
for all others. Three of them are labeled pneumonia but come from a Healthy ICBHI patient. These
clips are dropped whenever both datasets are merged. The tracked evidence file is
`backend/data/kaggle_icbhi_overlap.csv`, produced by `backend/cross_dataset_overlap.py`.

Kaggle `P`-numbers are **not** subject identifiers: the same numbers occur in every class, and
35 of 98 (class, `P`) groups contain cuts from several different ICBHI patients.

**Kaggle V2 is also cut from KAUH** (Fraiwan et al. 2021, Mendeley Data doi:10.17632/jwyy9np4gv.3,
CC BY 4.0; downloaded into `backend/dataset/KAUH/`, archive SHA-256 verified). The same matcher
found **316 Kaggle clips cut from 40 KAUH patients** (asthma 262 of 288, pneumonia 39, bronchial
15; copies ≥ 0.772, all others ≤ 0.573; evidence `backend/data/kaggle_kauh_overlap.csv`). 57 of the
64 matching filename groups mixed several KAUH patients. Since round 2 these clips carry the real
KAUH patient ID (`main.assign_kauh_patient_ids`). The remaining 252 Kaggle clips in the cohort
(healthy 53, pneumonia 135, bronchial 38, asthma 26; 57 filename groups) match neither database;
their grouping stays unverified.
KAUH does not overlap ICBHI (0 of 336 recordings match).

**Source confounding.** All COPD recordings are ICBHI (mostly the AKG C417L stethoscope, which
records no other class), and almost all KAUH-recorded training audio is asthma. A model trained on
this cohort labels external KAUH healthy and COPD patients as asthma (round-2 report §6). Do not
expect it to transfer to other hospitals or stethoscopes.

Class mapping (ICBHI → 5 classes): COPD → copd, Healthy → healthy, Pneumonia → pneumonia,
Asthma → asthma, URTI / Bronchiectasis / Bronchiolitis / LRTI → bronchial.

## ICBHI usage

This project expects the ICBHI 2017 Respiratory Sound Database to be obtained
from its authorized source. Audio files are intentionally excluded from this
repository.

## Local layout

```text
backend/dataset/ICBHI_final_dataset/*.wav
backend/dataset/patient_diagnosis_authentic.csv
```

The diagnosis CSV must contain `patient_id` and `disease`, and its per-patient counts must equal
the published ICBHI distribution (COPD 64, Healthy 26, URTI 14, Bronchiectasis 7, Bronchiolitis 6,
Pneumonia 6, LRTI 2, Asthma 1). Both `main.py` (icbhi format) and `reorganize_icbhi.py` enforce
this, and the repository's `backend/patient_diagnosis.csv` is deliberately scrambled and rejected. Conflicting
labels, missing labels for an audio file, malformed filenames, and an empty
dataset now stop the pipeline instead of being silently ignored.

Training additionally requires a separate, untracked `dataset_provenance.json`
matching `dataset_provenance.example.json`. It records the authorized source,
download date, license, diagnosis CSV checksum, and published ICBHI patient
label distribution. Self-declared label counts are not accepted, so a provenance file cannot
vouch for a non-authentic CSV.

## Splitting policy

- Patient is the unit of partitioning.
- Train, validation, and test patients must be disjoint, **and so must their audio**: byte
  duplicates are removed, and Kaggle cuts of ICBHI recordings are dropped before splitting.
- Splitting happens before feature extraction and augmentation.
- Validation and test contain original audio only.
- The split manifest and its SHA-256 hash are retained with each run.
- Patient exclusions are opt-in and must have a documented data-quality reason.
- A three-way disease split is rejected when a class has fewer than three
  independent patients. The authentic eight-class ICBHI task is infeasible (Asthma 1 and LRTI 2
  patients), hence the 5-class merged design above.

## Bias and representativeness

Before making performance claims, document the available population, age,
sex, disease, device, chest location, recording protocol, and audio-quality
distributions. Results from this benchmark should not be assumed to generalize
to consumer microphones, other stethoscopes, other clinical settings, or other
populations.

## Licensing and privacy

Users are responsible for following the dataset's original license, citation,
access, and privacy terms. Do not redistribute audio merely because the code is
public. Do not combine benchmark patient identifiers with real-patient data.
