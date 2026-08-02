# ICBHI dataset usage card

This project expects the ICBHI 2017 Respiratory Sound Database to be obtained
from its authorized source. Audio files are intentionally excluded from this
repository.

## Local layout

```text
dataset/ICBHI_final_dataset/*.wav
patient_diagnosis.csv
```

`patient_diagnosis.csv` must contain `patient_id` and `disease`. Conflicting
labels, missing labels for an audio file, malformed filenames, and an empty
dataset now stop the pipeline instead of being silently ignored.

Training additionally requires a separate, untracked `dataset_provenance.json`
matching `dataset_provenance.example.json`. It records the authorized source,
download date, license, diagnosis CSV checksum, and published ICBHI patient
label distribution. This intentionally blocks the historical CSV retained in
this repository because it does not have authentic ICBHI label counts.

## Splitting policy

- Patient is the unit of partitioning.
- Train, validation, and test patients must be disjoint.
- Splitting happens before feature extraction and augmentation.
- Validation and test contain original audio only.
- The split manifest and its SHA-256 hash are retained with each run.
- Patient exclusions are opt-in and must have a documented data-quality reason.
- A three-way disease split is rejected when a class has fewer than three
  independent patients. The authentic eight-class ICBHI task therefore needs a
  documented redesign before training because Asthma and LRTI are too rare.

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
