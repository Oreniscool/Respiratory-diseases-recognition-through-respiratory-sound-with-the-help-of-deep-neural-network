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
artifact predates the corrected patient-level split and has no metadata file,
so the server identifies it as `legacy-unverified`.

The captured historical run reached 82.12% final training accuracy, 73.44%
final validation accuracy, and 75.36% best validation accuracy at epoch 48.
Those numbers came from the previous sample-level split after augmentation and
are **not a valid estimate of patient-level or clinical performance**. Replace
all historical values after running the corrected pipeline.

## Corrected experiment flow

1. `main.py` loads the real diagnosis CSV and fails if it is missing.
2. `featureExtraction.py` builds a deterministic recording manifest.
3. Patients are stratified into train, validation, and locked test partitions.
4. Only training recordings receive augmentation; validation and test audio
   remain original.
5. `preprocessing.py` supplies the same explicit audio/MFCC configuration to
   both training and serving.
6. `train.py` selects the checkpoint using validation loss.
7. `evaluate.py` evaluates the untouched test partition.
8. The run writes a split manifest, metrics, model hash, ordered labels, and
   preprocessing contract under `artifacts/latest/`.

The default split is 60% train, 20% validation, and 20% test by patient.
Augmentation uses 20 dB SNR noise, zero-filled time shift, and two time-stretch
rates. It is deterministic from the configured seed and is applied equally to
all training classes.

## Dataset

Download the ICBHI 2017 Respiratory Sound Database separately:

```text
dataset/ICBHI_final_dataset/*.wav
patient_diagnosis.csv
```

The repository intentionally ignores the audio dataset. See
[`DATASET_CARD.md`](DATASET_CARD.md) before interpreting results. Patient
exclusions are disabled by default; any explicit exclusion must be supplied on
the command line and documented in the resulting experiment.

## Environment

Create an isolated Python environment and install dependencies:

```bash
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
python main.py \
  --dataset-dir dataset/ICBHI_final_dataset \
  --diagnosis-csv patient_diagnosis.csv \
  --output-dir artifacts/latest \
  --seed 42
```

Useful options:

- `--test-size` and `--validation-size`: total patient fractions.
- `--no-augmentation`: disable all training augmentation.
- `--healthy-class-multiplier`: optional additional weighting; defaults to 1.
- `--exclude-patient ID`: explicit exclusion, repeatable.
- `--epochs` and `--batch-size`: training controls.
- `--prepare-only`: validate and write patient splits without extracting audio
  features or training a model.

To inspect the corrected split safely before training:

```bash
python main.py --prepare-only --output-dir artifacts/split-check
```

Expected run artifacts:

```text
artifacts/latest/
├── best_model.keras
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

`test_metrics.json` includes recording-level and patient-aggregated accuracy,
balanced accuracy, macro/weighted F1,
macro precision/recall, kappa, MCC, log loss, multiclass Brier score,
calibration error, confusion matrix, classification report, and macro one-vs-
rest AUROC when it is defined.

## Inference API

Start the API only after producing or selecting an artifact:

```bash
python server.py
```

The server prefers `artifacts/latest/best_model.keras` and its metadata. It can
fall back to the checked-in H5 for local legacy inspection, but reports that
contract as unverified. Set `RESPINET_REQUIRE_METADATA=1` outside local legacy
work.

Endpoints:

- `GET /health`: model, dataset, label, and contract status.
- `POST /predict`: multipart audio inference.
- `GET /predict-sample/<disease>`: local dataset demonstration without patient
  IDs in the response.
- `POST /explain`: experimental spectrogram and attribution output.
- `POST /summarize`: optional external narrative generation.

The API limits request size and decoded duration, validates extensions and
probability shape, checks the model hash and output dimension, binds to
`127.0.0.1` by default, and restricts CORS to configured origins.

### External LLM privacy

LLM endpoints require `external_llm_consent=true`. The server removes patient
ID, occupation, notes, medications, comorbidities, and other free text before
sending structured context to the configured provider. This is a technical
minimum, not a complete privacy/compliance program. Do not use real patient
data without organizational approval, a provider agreement, retention rules,
and a reviewed consent process.

## React frontend

```bash
cd frontend-react
npm ci
npm run dev
```

The frontend uses same-origin API requests by default, which work through the
Vite proxy. Set `VITE_API_BASE_URL` when the API is hosted separately.

The UI fails closed when inference is unavailable. It does not fabricate
results or rewrite model probabilities. Recorded WebM audio retains its real
container type. The checked-in `frontend-react/dist` directory was removed;
build deployable assets from source with `npm run build`.

`frontend/` is retained only as a legacy visualization. Its historical six-
class plots do not describe the current source model, and its inference path
also fails closed.

## Static checks

Development dependencies and dataset-free checks:

```bash
pip install -r requirements-dev.txt
ruff check .
pytest

cd frontend-react
npm ci
npm run typecheck
```

CI runs these checks without loading a trained model or requiring the audio
dataset.

## Important remaining work

- Run patient-level cross-validation and an untouched test evaluation.
- Add patient-bootstrap confidence intervals and device/location subgroup
  reporting.
- Calibrate probabilities and implement audio-quality/OOD abstention.
- Validate denoising separately; it is experimental inference preprocessing.
- Replace tiled time-only saliency with a validated attribution method.
- Obtain clinical review and citations for all disease/treatment content.
- Add a project license and formal citation metadata once ownership and license
  choice are confirmed.
- Conduct privacy, threat-model, accessibility, and clinical-safety reviews
  before any deployment.

See [`MODEL_CARD.md`](MODEL_CARD.md) and [`SECURITY.md`](SECURITY.md) for the
current limitations and reporting guidance.
