# RespiNet: Respiratory Disease Recognition from Lung Sounds

RespiNet is a deep learning pipeline that classifies respiratory conditions from lung sound recordings. It includes:

- A full data pipeline to extract MFCC features and augment audio data.
- A Conv1D + BiGRU sequence model trained with class weighting.
- A Flask inference server with optional explainability and LLM summaries.
- Two frontends: a static HTML demo and a full React diagnostic UI.

This README explains how the project is wired end to end, what each module does, and how to run each part.

## Project flow at a glance

1. **Raw audio + labels**: Download the ICBHI 2017 respiratory sound dataset into [dataset/ICBHI_final_dataset/](dataset/ICBHI_final_dataset/) and place [patient_diagnosis.csv](patient_diagnosis.csv) in the project root.
2. **Feature extraction**: [featureExtraction.py](featureExtraction.py) loads audio, performs augmentation, and extracts MFCC features into a fixed-length tensor.
3. **Model training**: [main.py](main.py) prepares the train/test split and calls [train.py](train.py) to train the model defined in [model.py](model.py). The best weights are saved to [best_model.h5](best_model.h5).
4. **Evaluation**: Use [validate.py](validate.py) and [evaluate.py](evaluate.py) to get predictions and metrics.
5. **Inference server**: [server.py](server.py) loads [best_model.h5](best_model.h5), exposes REST endpoints, and optionally provides explainability overlays and LLM summaries.
6. **Frontends**: [frontend/](frontend/) is a static demo UI. [frontend-react/](frontend-react/) is a multi-page diagnostic UI that calls the API.

## Data and labels

- **Dataset**: ICBHI 2017 Respiratory Sound Database. Place the `.wav` files in [dataset/ICBHI_final_dataset/](dataset/ICBHI_final_dataset/).
- **Labels**: [patient_diagnosis.csv](patient_diagnosis.csv) must map `patient_id` to `disease`.
- **Class list**: The class list is derived from the CSV by both training and the server. If the CSV is missing, the server falls back to a default list and [main.py](main.py) creates a dummy CSV for testing.
- **Known filters**: [featureExtraction.py](featureExtraction.py) ignores patients 103, 108, and 115 to match prior experiments.

## Feature extraction and augmentation

All feature work happens in [featureExtraction.py](featureExtraction.py) and [Augmentation.py](Augmentation.py):

- **Audio loading**: `librosa.load(..., res_type="kaiser_fast")`.
- **Features**: 40 MFCC coefficients plus delta and delta-delta, stacked into 120 features per time step.
- **Fixed length**: Features are padded or truncated to 200 time steps.
- **Augmentations for non-COPD**:
  - Additive noise
  - Time shift
  - Time stretch (rate 1.2 and 0.8)
- **COPD handling**: Limits samples per patient to reduce dominance from repeated recording locations.

This yields an input tensor with shape $N \times 200 \times 120$.

## Model architecture

Defined in [model.py](model.py):

- BatchNorm
- Conv1D (kernel 5) + LeakyReLU + Dropout
- Conv1D (kernel 3) + LeakyReLU + Dropout
- Bidirectional GRU (64 units) + LeakyReLU + Dropout
- Bidirectional GRU (32 units) + LeakyReLU
- GlobalAveragePooling1D
- Dense (64) + LeakyReLU + Dropout
- Dense softmax output

For a full layer listing and a specific training run configuration, see [model_info.txt](model_info.txt).

## Training and evaluation

Training is coordinated in [main.py](main.py):

- Loads [patient_diagnosis.csv](patient_diagnosis.csv)
- Extracts features from [dataset/ICBHI_final_dataset/](dataset/ICBHI_final_dataset/)
- One-hot encodes labels and performs a stratified train/test split
- Sets `num_epochs` and `num_batch_size`
- Calls `trainModel(...)` in [train.py](train.py)

[train.py](train.py) uses:

- `categorical_crossentropy` loss
- `Adamax` optimizer
- Early stopping and checkpointing to [best_model.h5](best_model.h5)
- Class weights derived from `y_train`, with an optional multiplier to upweight the Healthy class

Evaluation utilities:

- [validate.py](validate.py) loads [best_model.h5](best_model.h5) and returns predicted class indices.
- [evaluate.py](evaluate.py) computes accuracy, precision, recall, F1, Cohen kappa, and MCC.

## Results and run summary

The following reflects a captured training run summary (data stats and configuration) to make the results visible without opening any extra files.

**Dataset and split checks**

- Extracted samples: 1,720
- Patient leakage overlap: 0 (no shared patient IDs between train and test)

**Class distribution (sample run)**

| Class          | Count |
| -------------- | ----: |
| Asthma         |   358 |
| Bronchiolitis  |   302 |
| Pneumonia      |   300 |
| Healthy        |   260 |
| Bronchiectasis |   188 |
| URTI           |   146 |
| LRTI           |   106 |
| COPD           |    60 |

**Training configuration highlights**

- Split strategy: GroupShuffleSplit by patient ID
- SpecAugment: enabled (time mask width 20, freq mask width 8, two masks each)
- Healthy class multiplier: 1.5
- Feature cache: features_cache/

**Performance metrics (observed training run)**

These numbers reflect the training log in [Images/training_results.txt](Images/training_results.txt).

- Best validation accuracy: 75.36% (epoch 48)
- Final validation accuracy: 73.44% (epoch 50)
- Final training accuracy: 82.12% (epoch 50)
- Best validation loss: 0.7183 (epoch 48)

If you want precision/recall/F1 and per-class metrics for this same run, run evaluation with [evaluate.py](evaluate.py) and I can add those numbers too.

## Inference server (Flask)

The inference service in [server.py](server.py) exposes:

- `GET /health` - server, model, and dataset status
- `POST /predict` - upload a `.wav` file, get class probabilities
- `GET /predict-sample/<disease>` - pick a real dataset sample and run inference
- `POST /explain` - returns spectrogram, saliency heatmap, and overlay images
- `POST /summarize` - optional LLM-generated narrative summary

Feature extraction on the server mirrors [featureExtraction.py](featureExtraction.py), with an optional spectral-gate noise reduction step.

### Optional LLM summaries

Set these environment variables (for example in a local environment file at the project root):

- `GROQ_API_KEY` (required for LLM features)
- `GROQ_API_URL` (defaults to the Groq chat completions endpoint)
- `GROQ_MODEL` (defaults to `llama-3.1-8b-instant`)
- `GROQ_DEBUG` (set to `1` for extra diagnostics)
- `GROQ_USER_AGENT` (optional)

## Frontends

### Static demo UI

- Location: [frontend/](frontend/)
- Entry file: [frontend/index.html](frontend/index.html)
- Script: [frontend/app.js](frontend/app.js)

This UI polls `GET /health`, shows demo data when the server is offline, and calls `/predict` or `/predict-sample` when the server is online.

### React diagnostic UI

- Location: [frontend-react/](frontend-react/)
- Framework: Vite + React + Tailwind
- Routes include diagnostics, metrics, explainability, and report generation.
- Calls `/predict`, `/predict-sample`, `/explain`, and `/summarize` through helper utilities.

## How to run

### 1) Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2) Prepare the dataset

- Put `.wav` files under [dataset/ICBHI_final_dataset/](dataset/ICBHI_final_dataset/)
- Place [patient_diagnosis.csv](patient_diagnosis.csv) in the project root

### 3) Train the model

```bash
python main.py
```

This writes [best_model.h5](best_model.h5) and training plots under [Images/](Images/).

### 4) Run the backend

```bash
python server.py
```

The server runs at `http://localhost:5000` and enables CORS for local frontends.

### 5) Run a frontend

Static demo:

- Open [frontend/index.html](frontend/index.html) directly in a browser.

React UI:

```bash
cd frontend-react
npm install
npm run dev
```

## Outputs and artifacts

- [best_model.h5](best_model.h5) - trained model weights used by the server.
- [Images/](Images/) - training plots and sample visualizations.
- [results_summary.txt](results_summary.txt) - sample run metadata.
- [model_info.txt](model_info.txt) - model summary and training config dump.
- [features_cache/](features_cache/) - cached feature arrays from prior experiments.

## Notes and limitations

- This project is for research and educational use only; it is not a medical diagnostic device.
- The class list depends on [patient_diagnosis.csv](patient_diagnosis.csv). Ensure the model and server agree on the same labels.
- The React UI shows demo metrics and sample predictions when the server is offline or the dataset is missing.

## Key modules (quick reference)

- [main.py](main.py) - orchestration of feature extraction, split, and training
- [featureExtraction.py](featureExtraction.py) - MFCC extraction and augmentation
- [Augmentation.py](Augmentation.py) - noise, shift, and stretch utilities
- [model.py](model.py) - model architecture
- [train.py](train.py) - training loop and callbacks
- [validate.py](validate.py) - model inference on feature arrays
- [evaluate.py](evaluate.py) - evaluation metrics
- [server.py](server.py) - Flask API with explainability and LLM summary
- [frontend/](frontend/) - static demo UI
- [frontend-react/](frontend-react/) - React diagnostic UI
