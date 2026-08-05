# RespiNet

RespiNet is a research prototype for classifying respiratory-sound recordings
with MFCC features, temporal convolutions, and bidirectional GRUs. It includes
a patient-safe training pipeline, Flask inference API, React research UI,
evaluation utilities, and optional externally generated narrative summaries.

> **Not a medical device.** RespiNet has not been clinically validated and must
> not be used to diagnose, rule out, screen for, or treat disease. A softmax
> value is a model probability, not clinical confidence.

## Current evidence status

The repository contains a legacy `best_model.h5` and historical plots. That
artifact predates the corrected patient-level split and has no metadata file.
The server will not load or serve it.

The captured historical run reached 82.12% final training accuracy, 73.44%
final validation accuracy, and 75.36% best validation accuracy at epoch 48.
Those numbers came from the previous sample-level split after augmentation and
are **not a valid estimate of patient-level or clinical performance**. Replace
all historical values after running the corrected pipeline.

## Corrected experiment flow

1. `main.py` verifies an authorized diagnosis CSV against a provenance record
   and fails closed if its checksum or published ICBHI label distribution differs.
2. `featureExtraction.py` builds a deterministic recording manifest.
3. Patients are stratified into train, validation, and locked test partitions.
4. Only training recordings receive augmentation; validation and test audio
   remain original.
5. `preprocessing.py` supplies the same explicit audio/MFCC configuration to
   both training and serving, with overlapping windows over the full recording.
6. `train.py` selects the checkpoint using validation loss.
7. `evaluate.py` evaluates the untouched test partition.
8. The run writes a split manifest, provenance audit, calibrated metrics,
   model hash, ordered labels, and preprocessing contract under `artifacts/latest/`.

The default split is 60% train, 20% validation, and 20% test by patient.
Augmentation uses 20 dB SNR noise, zero-filled time shift, and two time-stretch
rates. It is deterministic from the configured seed and is applied equally to
all training classes.

## Directory Structure

```text
.
├── backend/          # Python backend, Flask API, model definition, training & inference
├── documentation/    # System architecture, benchmarks, dataset specs & design docs
├── frontend/         # React + Vite + TypeScript web interface (Respiratory Atlas spec)
└── README.md         # Repository overview
```

## Dataset

Download the ICBHI 2017 Respiratory Sound Database separately:

```text
backend/dataset/ICBHI_final_dataset/*.wav
backend/patient_diagnosis.csv  # authorized source only
backend/dataset_provenance.json
```

The repository intentionally ignores the audio dataset. See
[`documentation/DATASET_CARD.md`](documentation/DATASET_CARD.md) before interpreting results. Patient
exclusions are disabled by default; any explicit exclusion must be supplied on
the command line and documented in the resulting experiment. Create the
provenance record from
[`documentation/dataset_provenance.example.json`](documentation/dataset_provenance.example.json)
using the authorized source; the historical CSV in this repository deliberately
does not pass this check.

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

Training is explicit and has no import-time side effects:

```bash
cd backend
python main.py \
  --dataset-dir dataset/ICBHI_final_dataset \
  --diagnosis-csv patient_diagnosis.csv \
  --dataset-provenance dataset_provenance.json \
  --output-dir artifacts/latest \
  --seed 42
```

Useful options:

- `--test-size` and `--validation-size`: total patient fractions.
- `--no-augmentation`: disable all training augmentation.
- `--healthy-class-multiplier`: optional additional weighting; defaults to 1.
- `--bootstrap-samples`: patient-bootstrap samples for 95% confidence intervals.
- `--exclude-patient ID`: explicit exclusion, repeatable.
- `--epochs` and `--batch-size`: training controls.
- `--prepare-only`: validate and write patient splits without extracting audio
  features or training a model.

To inspect the corrected split safely before training:

```bash
cd backend
python main.py --prepare-only --output-dir artifacts/split-check
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
balanced accuracy, macro/weighted F1,
macro precision/recall, kappa, MCC, log loss, multiclass Brier score,
calibration error, confusion matrix, classification report, and macro one-vs-
rest AUROC when it is defined.

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

LLM endpoints require `external_llm_consent=true`. The server removes patient
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

- [**Documentation Index**](documentation/README.md)
- [**Dataset Optimization & Accuracy Improvement Plan**](documentation/DATASET_AND_ACCURACY_OPTIMIZATION_PLAN.md) — *Resolving Run 1241 overfitting, skewness & noise issues*
- [**Alternative Datasets & Benchmarks Guide**](documentation/ALTERNATIVE_DATASETS_AND_BENCHMARKS.md) — *Guide to SPRSound, HF_Lung, Kaggle Asthma V2, COUGHVID*
- [`documentation/ARCHITECTURE_AND_BENCHMARK_REPORT.md`](documentation/ARCHITECTURE_AND_BENCHMARK_REPORT.md)
- [`documentation/DATASET_CARD.md`](documentation/DATASET_CARD.md)
- [`documentation/MODEL_CARD.md`](documentation/MODEL_CARD.md)
- [`documentation/KAGGLE_TRAINING_GUIDE.md`](documentation/KAGGLE_TRAINING_GUIDE.md)
- [`documentation/SECURITY.md`](documentation/SECURITY.md)
- [`documentation/design.md`](documentation/design.md)
- [`documentation/design-qa.md`](documentation/design-qa.md)
- [`documentation/CHANGELOG.md`](documentation/CHANGELOG.md)

See [`documentation/MODEL_CARD.md`](documentation/MODEL_CARD.md) and [`documentation/SECURITY.md`](documentation/SECURITY.md) for the
current limitations and reporting guidance.
