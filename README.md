# RespiNet

RespiNet is a research prototype for classifying respiratory-sound recordings
with MFCC features, temporal convolutions, and bidirectional GRUs. It includes
a patient-safe training pipeline, Flask inference API, React research UI,
evaluation utilities, and optional externally generated narrative summaries.

> **Not a medical device.** RespiNet has not been clinically validated and must
> not be used to diagnose, rule out, screen for, or treat disease. A softmax
> value is a model probability, not clinical confidence.

## Current evidence status

The current model (`backend/artifacts/latest/`, trained 2026-10-22) is a 5-class classifier
(asthma, bronchial, COPD, healthy, pneumonia) that averages two members: the RespiNet
Conv1D + BiGRU network over MFCC features, and a logistic-regression head over embeddings from
Google's pretrained YAMNet audio model. It is trained on **ICBHI 2017 merged with the Kaggle
Asthma Detection Dataset V2**, after an audit removed audio that appeared twice:

- **631 of the 1,211 Kaggle clips (52%, including every Kaggle COPD clip) are verbatim cuts of
  ICBHI recordings.** In the earlier merged cohort they sat under different patient IDs, so test
  patients' audio also appeared in training. These copies, plus 12 byte-identical files, are now
  removed (evidence: `backend/data/kaggle_icbhi_overlap.csv`).
- Leakage-free cohort (round 2b): 1,551 recordings / 244 patients, including 21 patients from the
  KAUH hospital dataset (Kaggle clips cut from KAUH carry real patient IDs). Patient-disjoint split
  146 / 49 / 49.
- **Served model (round 2b):** a four-member late fusion. It combines a 3-seed RespiNet ensemble with
  logistic heads over frozen YAMNet, OPERA-CE and HeAR embeddings, chosen by pre-registered
  patient-grouped cross-validation.

| Held-out test (49 patients, round 2b, split v3) | Recording level | Patient level |
|---|---:|---:|
| Accuracy | 82.01% | 75.51% (95% CI 63.3–87.8%) |
| Balanced accuracy | 73.47% | 74.87% |
| Macro F1 | 0.704 | 0.739 |
| Macro one-vs-rest AUROC | 0.919 | 0.939 |

Split v3 has different test patients from round 2's split v2 (73.33% patient accuracy on 45
patients), so the two are not directly comparable. On 24 held-out KAUH patients, the round-2b model
gets healthy 17/18 right but COPD 0/5. That is within-site adaptation, not generalization to a new
hospital. **On a second, independent external set (SPRSound: 718 labelled children from a Shanghai
hospital) the model is at or below chance**: balanced accuracy 0.19 over four classes (guessing gives
0.25) and healthy-vs-diseased AUROC 0.47. The model before it scored 0.26 and 0.55, and frozen
YAMNet, OPERA-CE, HeAR and AST heads reach only 0.50–0.55. Five standard domain-generalization methods
did not fix it (best of 20 combinations: AUROC 0.59). Do not expect this model to work on other hospitals,
devices or children.

The round-2 numbers were on 45 test patients of a corrected split in which Kaggle clips cut from the
KAUH hospital dataset carry their real patient IDs. **On 45 external KAUH patients from another
hospital and stethoscope the model scores 0%: it calls healthy and COPD patients "asthma"**, because
almost all KAUH-recorded training audio is asthma. Treat every number here as in-cohort only; see
[`documentation/ROUND2_EXPERIMENTS_REPORT.md`](documentation/ROUND2_EXPERIMENTS_REPORT.md).
Earlier figures below are from the previous split. The YAMNet fusion was chosen by patient-grouped cross-validation on the development
patients before the test set was used, and it replaced the RespiNet-only model (75.51% patient /
77.36% recording accuracy, archived in `backend/artifacts/v3-2026-10-22-leakfree/`). At patient
level the test gain is one patient of 49; see
[`documentation/ACCURACY_EXPERIMENTS_REPORT.md`](documentation/ACCURACY_EXPERIMENTS_REPORT.md).
The **82.09% reported for the 2026-08-14 model was inflated by the overlap** and
must not be cited. That model is archived in `backend/artifacts/v3-2026-08-14/`. Full evidence:
[`documentation/FINAL_PHASE_IMPROVEMENT_REPORT.md`](documentation/FINAL_PHASE_IMPROVEMENT_REPORT.md).

The legacy `backend/best_model.h5` (2021, 8 classes, leakage-prone split) is never loaded or
served.

## Corrected experiment flow

1. Records are built from class folders (`--dataset-format folder`), with ICBHI sorted into the
   same 5 classes from its **authentic** diagnoses by `reorganize_icbhi.py`. That script rejects
   any label table that differs from the published ICBHI distribution. In `icbhi` format,
   `main.py` verifies the diagnosis CSV against a provenance record the same way.
2. When ICBHI and Kaggle V2 are merged, Kaggle clips that are cuts of ICBHI recordings are dropped
   (fail-closed: training refuses to run without the evidence file), and byte-identical
   duplicates are removed.
3. Patients are stratified into train, validation, and locked test partitions.
4. Only training recordings receive augmentation; validation and test audio remain original.
5. `preprocessing.py` supplies the same explicit audio/MFCC configuration to both training and
   serving, with overlapping windows over the full recording.
6. `train.py` selects the checkpoint on validation accuracy.
7. Calibration (temperature scaling + abstention thresholds) is fit on validation recordings, and
   `evaluate.py` evaluates the untouched test partition overall and per data source.
8. The run writes a split manifest, a dataset audit (content hashes, removed overlaps and
   duplicates), calibrated metrics, the model hash, ordered labels, all hyperparameters, library
   versions, the git revision, and the preprocessing contract under the output directory.

The default split is 60% train, 20% validation, and 20% test by patient. Augmentation uses 20 dB
SNR noise, zero-filled time shift, two time-stretch rates, and online SpecAugment. It is
deterministic from the configured seed and is applied equally to all training classes.

## Directory Structure

```text
.
├── backend/          # Python backend, Flask API, model definition, training & inference
├── documentation/    # System architecture, benchmarks, dataset specs & design docs
├── frontend/         # React + Vite + TypeScript web interface (Respiratory Atlas spec)
└── README.md         # Repository overview
```

## Dataset

Datasets are not redistributed. `backend/download_dataset.sh all` fetches both into
`backend/dataset/`:

```text
backend/dataset/Asthma_Detection_V2/…/{asthma,Bronchial,copd,healthy,pneumonia}/*.wav
backend/dataset/ICBHI_final_dataset/*.wav
backend/dataset/patient_diagnosis_authentic.csv   # authentic ICBHI per-patient diagnoses
```

Then sort ICBHI into class folders:

```bash
cd backend
python reorganize_icbhi.py --copy      # defaults to dataset/patient_diagnosis_authentic.csv
```

`backend/patient_diagnosis.csv` in the repository is **deliberately scrambled** and is rejected by
the label check. `backend/data/kaggle_icbhi_overlap.csv` (tracked) lists which Kaggle clips are
cuts of ICBHI recordings. Regenerate it with `python cross_dataset_overlap.py …` if either dataset
changes. See [`documentation/DATASET_CARD.md`](documentation/DATASET_CARD.md) before
interpreting results.

## Environment

Create an isolated Python environment and navigate to the backend:

```bash
cd backend
pip install -r requirements.txt
```

`requirements.txt` defines supported ranges, not a fully resolved lock. After
validating a working CPU/GPU environment, create and retain a platform-specific
lock file for reproducible retraining.

Copy `.env.example` to `.env` for local configuration. Do not commit `.env` or
API keys.

## Training

Training is explicit and has no import-time side effects. To reproduce the current model:

```bash
cd backend
python main.py --dataset-format folder --merge-icbhi \
  --output-dir artifacts/latest --epochs 80 --batch-size 64 --seed 42
```

Useful options:

- `--test-size` and `--validation-size`: total patient fractions.
- `--learning-rate` (default 3e-4) and `--no-use-focal-loss`: optimization controls.
- `--no-augmentation`, `--no-spec-augment`, `--max-waveform-variants`: augmentation controls.
- `--overlap-csv` / `--no-overlap-exclusion`: cross-dataset overlap evidence (disabling it
  reintroduces leakage).
- `--bootstrap-samples`: patient-bootstrap samples for 95% confidence intervals.
- `--exclude-patient ID`: explicit exclusion, repeatable.
- `--source-revision`: defaults to the current git commit.
- `--prepare-only`: validate and write patient splits without extracting features or training.

To inspect the corrected split safely before training:

```bash
cd backend
python main.py --dataset-format folder --merge-icbhi --prepare-only --output-dir artifacts/split-check
```

Expected run artifacts:

```text
backend/artifacts/latest/
├── best_model.keras
├── calibration.json
├── dataset_audit.json
├── model_metadata.json
├── split_manifest.csv
├── split_summary.json
├── test_metrics.json
├── training_history.csv
├── training_history.json
├── model_summary.txt
├── accuracy_plot.png
└── loss_plot.png
```

`test_metrics.json` includes window-aggregated recording-level and patient-aggregated accuracy,
balanced accuracy, macro/weighted F1, macro precision/recall, kappa, MCC, log loss, multiclass
Brier score, calibration error, confusion matrix, classification report, macro one-vs-rest AUROC
when it is defined, patient-bootstrap confidence intervals, and the same metrics per data source
(`by_source`).

## Inference API

Start the API only after producing or selecting an artifact:

```bash
cd backend
python server.py
```

The server requires a complete `schema_version: 2` artifact contract by default:
model SHA-256, ordered classes, preprocessing settings, evaluation, calibration,
and data-provenance records must all validate before inference is available.
`GET /ready` is the readiness check; `GET /live` is liveness only.

Endpoints:

- `GET /health`: diagnostic status; it never claims readiness by itself.
- `GET /live` and `GET /ready`: liveness and strict artifact readiness.
- `POST /predict`: multipart audio inference.
- `GET /predict-sample/<disease>`: local dataset demonstration without patient
  IDs in the response.
- `POST /explain`: experimental spectrogram and attribution output.
- `POST /summarize`: optional external narrative generation.

The API limits request size and decoded duration, validates audio container
signatures and probability shape, checks the model hash and output dimension,
returns calibrated full-recording probabilities with abstention for uncertain
results, binds to `127.0.0.1` by default, and restricts CORS to configured
origins. Inference-time denoising is disabled by default because it is not part
of the verified training contract.

### External LLM privacy

LLM endpoints use Google Gemini when `GEMINI_API_KEY` is set (the key is sent as a request
header, never in a URL) and Groq otherwise. They require `external_llm_consent=true`. The server removes patient
ID, occupation, notes, medications, comorbidities, and other free text before
sending structured context to the configured provider. This is a technical
minimum, not a complete privacy/compliance program. Do not use real patient
data without organizational approval, a provider agreement, retention rules,
and a reviewed consent process.

## React frontend

```bash
cd frontend
npm ci
npm run dev
```

The frontend uses same-origin API requests by default, which work through the
Vite proxy. Set `VITE_API_BASE_URL` when the API is hosted separately.

The UI fails closed when inference is unavailable. It does not fabricate
results or rewrite model probabilities. Recorded WebM audio retains its real
container type. Build deployable assets from source with `npm run build`.

## Static checks

Development dependencies and dataset-free checks:

```bash
cd backend
pip install -r requirements-dev.txt
ruff check .
pytest

cd ../frontend
npm ci
npm run typecheck
```

CI runs these checks without loading a trained model or requiring the audio
dataset.

## Documentation & Architecture Reports

Detailed documentation is available in the [`documentation/`](documentation/) directory:

- [**Project Research Chronicle & Architecture Evolution**](documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md) — *Master living document covering complete project history, architectural overhaul, ICBHI failure root cause, and dataset transformation*
- [**Documentation Index**](documentation/README.md)
- [**Dataset Optimization & Accuracy Improvement Plan**](documentation/DATASET_AND_ACCURACY_OPTIMIZATION_PLAN.md) — *Resolving Run 1241 overfitting, skewness & noise issues*
- [**Alternative Datasets & Benchmarks Guide**](documentation/ALTERNATIVE_DATASETS_AND_BENCHMARKS.md) — *Guide to SPRSound, HF_Lung, Kaggle Asthma V2, COUGHVID*
- [`documentation/ARCHITECTURE_AND_BENCHMARK_REPORT.md`](documentation/ARCHITECTURE_AND_BENCHMARK_REPORT.md)
- [`documentation/DATASET_CARD.md`](documentation/DATASET_CARD.md)
- [`documentation/MODEL_CARD.md`](documentation/MODEL_CARD.md)
- [`documentation/KAGGLE_TRAINING_GUIDE.md`](documentation/KAGGLE_TRAINING_GUIDE.md)
- [`documentation/SPIT_GPU_SERVER_GUIDE.md`](documentation/SPIT_GPU_SERVER_GUIDE.md)
- [`documentation/SECURITY.md`](documentation/SECURITY.md)
- [`documentation/design.md`](documentation/design.md)
- [`documentation/design-qa.md`](documentation/design-qa.md)
- [`documentation/CHANGELOG.md`](documentation/CHANGELOG.md)

See [`documentation/MODEL_CARD.md`](documentation/MODEL_CARD.md) and [`documentation/SECURITY.md`](documentation/SECURITY.md) for the
current limitations and reporting guidance.
