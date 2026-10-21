# CLAUDE.md — RespiNet (Respiratory Atlas)

Context for AI coding assistants working in this repository. Subdirectory files
[`backend/CLAUDE.md`](backend/CLAUDE.md) and [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
hold module-level detail. The full verified reference (history, exact architecture,
verified metrics, discrepancy register) is
[`documentation/PROJECT_CONTEXT.md`](documentation/PROJECT_CONTEXT.md).

Last verified against source and on-disk artifacts: **2026-10-21** (HEAD `1b81cff`).

---

## 1. What this project is

RespiNet is a **research prototype** that classifies respiratory-sound recordings
(lung auscultation audio) into disease categories with a Conv1D + BiGRU sequence
model over MFCC features. It has three parts:

| Part | Stack | Entry point |
|---|---|---|
| Training pipeline | Python 3.11, TensorFlow/Keras 3, librosa, scikit-learn | `backend/main.py` |
| Inference API | Flask (+ gunicorn in Docker) | `backend/server.py` (`backend/wsgi.py` for WSGI) |
| Web UI ("Respiratory Atlas") | React 19, Vite 6, TypeScript, Zustand, Recharts, framer-motion | `frontend/src/main.tsx` |

**It is not a medical device.** Never describe output as a diagnosis, screening, or
clinical confidence. This is enforced in UI copy and docs; keep it that way.

The **currently trained model** is a 5-class classifier
(`asthma`, `bronchial`, `copd`, `healthy`, `pneumonia`) trained on the **Kaggle Asthma
Detection V2 dataset merged with ICBHI 2017** (ICBHI re-mapped to 5 classes). The
original 2021 project targeted the 8 ICBHI classes; that model (`backend/best_model.h5`)
is legacy.

---

## 2. MANDATORY: documentation synchronization rule

From [`AGENTS.md`](AGENTS.md) / [`GEMINI.md`](GEMINI.md) (identical rule). Whenever you
change **any** of the following, update
[`documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md`](documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md)
in the same change:

- architecture in `backend/model.py`
- preprocessing / filtering / features in `backend/preprocessing.py`, `backend/featureExtraction.py`
- loss, optimizer, LR schedule, hyperparameters in `backend/train.py`
- datasets, download scripts, manifests, patient grouping (`backend/download_dataset.sh`,
  `backend/dataset_provenance.py`, `backend/reorganize_icbhi.py`)
- any new training run, validation result, calibration score or benchmark
- endpoints in `backend/server.py` or workflows in `frontend/`

The chronicle is consumed by downstream LLMs that write academic reports, so it must
be accurate. Also update [`documentation/PROJECT_CONTEXT.md`](documentation/PROJECT_CONTEXT.md)
when a verified fact there changes (metrics, architecture, defaults, gotchas).

**Record only numbers you can trace to an artifact file.** Several existing docs
contain numbers that no artifact supports (see §6). Do not copy them forward.

---

## 3. Source-of-truth hierarchy

When sources disagree, trust them in this order:

1. **Source code** (`backend/*.py`, `frontend/src/**`)
2. **Run artifacts on disk** in `backend/artifacts/latest/` (gitignored, local only):
   `model_metadata.json`, `calibration.json`, `test_metrics.json`, `split_summary.json`,
   `training_history.json`, `model_summary.txt`
3. `documentation/PROJECT_CONTEXT.md` (verified 2026-10-21)
4. Everything else in `documentation/`. Much of it is historical, aspirational, or stale.

Note: `artifacts/latest/` at the **repo root** is tracked in git but is a **stale** split
from an earlier run with scrambled labels. It is *not* the current model's split. The
real one is `backend/artifacts/latest/`.

---

## 4. Repository map

```text
.
├── AGENTS.md / GEMINI.md        # doc-sync rule (identical apart from the title)
├── CLAUDE.md                    # this file
├── README.md                    # user-facing overview (partly stale, see §6)
├── Dockerfile                   # all-in-one image: nginx + `python server.py` (Flask dev server)
├── docker-compose.yml           # backend (gunicorn, :5000) + frontend (nginx, :80/:8080)
├── .github/workflows/checks.yml # CI: ruff + pytest (backend), npm ci + build (frontend)
├── artifacts/latest/            # STALE tracked split files from an older run, do not trust
├── backend/
│   ├── main.py                  # training orchestrator CLI (split → features → train → calibrate → eval → metadata)
│   ├── preprocessing.py         # PreprocessingConfig + bandpass/MFCC/Δ/Δ²/CMVN + windowing (shared train/serve)
│   ├── featureExtraction.py     # AudioRecord manifests (ICBHI csv or class folders) + window extraction + waveform aug
│   ├── Augmentation.py          # noise/shift/stretch + SpecAugment (numpy + tf versions)
│   ├── model.py                 # RespiNet-Attention v3 + custom serializable layers
│   ├── train.py                 # CategoricalFocalLoss, train_model (tf.data, CosineDecay, callbacks)
│   ├── calibration.py           # temperature scaling on probabilities + abstention policy
│   ├── evaluate.py              # recording/patient metrics, ECE, bootstrap CIs
│   ├── artifact_contract.py     # load_verified_contract(): SHA-256 + metadata schema checks
│   ├── dataset_provenance.py    # ICBHI provenance check, 4-class map, 3-way class-support check
│   ├── audio_validation.py      # upload extension/signature check (weak, see backend/CLAUDE.md)
│   ├── reorganize_icbhi.py      # ICBHI flat dir → 5-class folders (symlink/copy)
│   ├── server.py                # Flask API
│   ├── wsgi.py / validate.py    # WSGI entry / standalone predict helper
│   ├── submit.sh / download_dataset.sh  # SLURM jobs for the SPIT GPU cluster
│   ├── best_model.h5, scaler.pkl        # LEGACY 2021 artifacts (8-class, no contract; do not load scaler.pkl)
│   ├── patient_diagnosis.csv            # DELIBERATELY SCRAMBLED historical labels; never train on it
│   ├── dataset_provenance.json          # provenance for the scrambled CSV (self-consistent, so it passes the check)
│   ├── tests/                   # 21 dataset-free pytest tests
│   ├── artifacts/latest/        # (gitignored) the current verified model + contract files
│   └── dataset/                 # (gitignored) Asthma_Detection_V2/, ICBHI_final_dataset/, ICBHI_as_folders/,
│                                #   patient_diagnosis_authentic.csv  ← the REAL ICBHI labels
├── frontend/
│   ├── src/                     # React app (pages/, components/, store/, hooks/, utils/predict.ts, data/)
│   ├── dist/                    # COMMITTED build output, rebuild + commit if you change src
│   ├── vite.config.ts           # dev proxy → http://localhost:5001
│   └── nginx.conf               # prod proxy → http://backend:5000
└── documentation/               # chronicle, model/dataset cards, guides, design system, presentation dossiers
```

---

## 5. Commands

All backend commands run from `backend/`. Python version is pinned in
`backend/.python-version` (3.11.9). Dependencies are in `backend/requirements.txt`
(ranges, not a lock; includes `nvidia-*-cu12` wheels) and `requirements-dev.txt`
(adds pytest, ruff).

> **Local environment (rebuilt 2026-10-21):** `backend/venv/` was created from pyenv
> `~/.pyenv/versions/3.11.9` (the system Python is 3.14, which TensorFlow does not support). It has
> TF 2.21.0, Keras 3.15.1, NumPy 2.4.6 and librosa 0.11.0, plus `nvidia-cuda-nvcc-cu12`, which is
> **not** in requirements.txt but is needed for GPU JIT (`ptxas`/`libdevice`). Its `activate` and
> `activate.fish` were extended to export `LD_LIBRARY_PATH` (pip CUDA libs), `PATH` (ptxas) and
> `XLA_FLAGS` (libdevice). Without these, TF either skips the GPU or fails with
> `JIT compilation failed [Op:Sign]`. Venvs aren't relocatable: if the drive moves again (it used to
> be `/run/media/qitiya/SSD2`), rebuild the venv. `backend/venv.old/` is the pre-move venv; delete it
> once you no longer need it.

```bash
# --- backend setup ---
cd backend
~/.pyenv/versions/3.11.9/bin/python -m venv venv && source venv/bin/activate   # fish: activate.fish
pip install -r requirements-dev.txt nvidia-cuda-nvcc-cu12
# then add the LD_LIBRARY_PATH / PATH / XLA_FLAGS exports to the activate scripts (see note above)

# --- static checks (what CI runs; no dataset or model needed) ---
ruff check .                # currently 4 pre-existing findings (Augmentation.py F821×2, model.py F401, wsgi.py F401)
python -m pytest            # NOT bare `pytest`: tests `import preprocessing`, so backend/ must be on
                            # sys.path, which only `python -m` adds (21 tests pass)

# --- datasets (into backend/dataset/) ---
./download_dataset.sh all   # Kaggle CLI or curl; also runs under sbatch
python reorganize_icbhi.py \
  --dataset-dir dataset/ICBHI_final_dataset \
  --diagnosis-csv dataset/patient_diagnosis_authentic.csv \   # NOT the default patient_diagnosis.csv!
  --output-dir dataset/ICBHI_as_folders --copy

# --- inspect a split without training ---
python main.py --dataset-format folder --merge-icbhi --prepare-only --output-dir artifacts/split-check

# --- train the current configuration (Kaggle V2 + ICBHI, 5 classes) ---
python main.py --dataset-format folder --merge-icbhi \
  --output-dir artifacts/latest --epochs 80 --batch-size 64 --seed 42 \
  --source-revision "$(git rev-parse HEAD)"

# --- serve ---
python server.py            # binds RESPINET_HOST:RESPINET_PORT (default 127.0.0.1:5001)

# --- frontend ---
cd ../frontend
npm ci
npm run dev                 # http://localhost:5173, proxies API paths to :5001
npm run typecheck           # tsc -b
npm run build               # tsc -b && vite build → dist/ (dist is committed)
```

`--dataset-format folder` with the default `--dataset-dir` auto-resolves to
`dataset/Asthma_Detection_V2/Asthma Detection Dataset Version 2/Asthma Detection Dataset Version 2`.
`--merge-icbhi` appends `dataset/ICBHI_as_folders` if it exists.

**Ports:** local dev is **5001** (server default, `.env`, Vite proxy). Docker images and
`backend/.env.example` use **5000**. Keep them consistent when you change one.

---

## 6. Current verified state (from `backend/artifacts/latest/`)

| Fact | Value | Source |
|---|---|---|
| Classes (ordered) | `asthma, bronchial, copd, healthy, pneumonia` | `model_metadata.json` |
| Parameters | 458,701 (≈1.75 MB) | `model_summary.txt` |
| Cohort | 2,131 recordings / 331 patients (Kaggle 1,211 / 205 + ICBHI 920 / 126) | `split_summary.json` |
| Split (patients) | train 198 / val 66 / test 67; recordings 1,248 / 440 / 443 | `split_summary.json` |
| Epochs run | 76 (early stop); best epoch 58, val_acc 0.808, val_loss 0.1103 | `training_history.json` |
| Temperature | **0.8443** (val NLL 0.5531 → 0.5446) | `calibration.json` |
| Abstention | min_conf 0.6386, max_norm_entropy 0.5276, 80% target coverage | `calibration.json` |
| Test acc (recording / patient) | 80.81% / 82.09% | `test_metrics.json` |
| Balanced acc | 75.03% / 79.65% | `test_metrics.json` |
| Macro F1 | 0.7200 / 0.7922 | `test_metrics.json` |
| ECE | 0.0333 / 0.1030 | `test_metrics.json` |
| Macro OvR AUROC | 0.9465 / 0.9672 | `test_metrics.json` |
| Patient-bootstrap 95% CI (acc) | 73.1% – 91.0% (1,000 samples) | `test_metrics.json` |

**Known-wrong numbers in existing docs:** "T ≈ 1.54" (chronicle, CHANGELOG, assessment,
presentation dossiers; the real value is 0.844), the chronicle's §7.1 "refactored" table
(val acc 82.5–88.1%, macro-F1 0.842, ECE 0.061: no artifact supports these), the
chronicle's §4.2 layer table (~136K params, the pre-v3 architecture), the landing page stat
"82.9%" (real value 82.09%), and "Option C" dropout/recurrent_dropout values (never landed in
`model.py`). The full list is in `documentation/PROJECT_CONTEXT.md` §14.

---

## 7. Invariants. Do not break these.

1. **Patient-disjoint splits.** `split_by_patient()` splits *patients* (stratified) before
   any feature extraction. It raises on any overlap. Every class needs at least 3 patients
   (`assert_three_way_class_support`).
2. **Augmentation only on the training split.** Validation and test are extracted with
   `augment=False`.
3. **One preprocessing contract.** Training and serving both use `PreprocessingConfig`.
   The config is persisted into `model_metadata.json["preprocessing"]` and re-read by the
   server. If you change a default, you must retrain. Old artifacts carry their own config.
4. **Class order comes from metadata.** `LabelEncoder` sorts the class names alphabetically.
   The server must use `metadata["classes"]`, never a CSV-derived or hardcoded list.
5. **Custom layers must stay registered.** Classes in `model.py` and `CategoricalFocalLoss`
   use `@register_keras_serializable(package="respinet")` and are listed in
   `server.py:load_model_once` `custom_objects`. If you rename or remove one, saved
   `.keras` artifacts will no longer load.
6. **Model selection uses validation data only.** The test split is touched once, after
   calibration.
7. **Research-only language** in the UI and generated reports ("model score", "research
   prototype — not a diagnostic device").
8. **No secrets in git.** `.env` and `backend/.env` are gitignored and may hold
   `GEMINI_API_KEY` / `GROQ_API_KEY`. Never print or commit them.

---

## 8. Top gotchas (details in subdirectory CLAUDE.md files)

- **Serving is fail-closed (since branch `final-phase-improvements`).** Without a verified
  contract the status is `"unverified"`, `CLASSES` is empty, and `/predict`, `/explain`,
  `/predict-sample` and `/summarize` return 503. There is no `best_model.h5` fallback any more.
  The UI only accepts `model_contract == "verified-metadata"`. A fresh clone without
  `backend/artifacts/latest/` therefore **cannot** run inference until a model is trained.
- **Inference denoising defaults to OFF** (`RESPINET_ALLOW_INFERENCE_DENOISING` default `"0"`
  since final-phase item 3), because it is not part of the training contract. A denoise request
  while disabled → 400. `/health` exposes `denoise_allowed`, and the UI hides the checkbox unless it
  is true. Note that the local, gitignored `.env` files on the dev machine still set it to `1`.
- **Upload validation is effectively off.** `_looks_like_audio` accepts any payload of at
  least 128 bytes, and `_read_audio_upload` swallows validation errors for payloads of at
  least 128 bytes, including bad extensions.
- **`reorganize_icbhi.py` defaults to the scrambled `patient_diagnosis.csv`.** Always pass
  `--diagnosis-csv dataset/patient_diagnosis_authentic.csv`. This caused the 27–29%
  val-accuracy collapse (chronicle §8.5).
- **`main.py` CLI defaults override `train_model` defaults.** The CLI has batch 32,
  epochs 50, label_smoothing 0.1. `train_model` defaults are 64 / 75 / 0.08. The learning
  rate is never passed from the CLI, so it is always 3e-4. `--use-focal-loss` is
  `store_true` with `default=True`, so focal loss cannot be disabled from the CLI.
- **`submit.sh` regenerates `dataset_provenance.json`** from whatever CSV is present,
  which makes the ICBHI provenance check meaningless on the cluster.
- **The Gemini API key goes in the URL query string,** and on `URLError` the full URL is
  printed to stdout (`server.py:450`, `490`). It can leak into logs.
- **`frontend/dist/` is committed.** Source changes leave it stale until you rebuild.
- `RESPINET_REQUIRE_METADATA` appears in `.env.example` and `SECURITY.md` but **is not
  implemented** anywhere.

---

## 9. Conventions

- Python: `from __future__ import annotations`, type hints, dataclasses, `pathlib`, no
  import-time side effects in pipeline modules (except `server.py`, which loads the
  contract at import). Ruff config: py310 target, line length 100, rules `E4,E7,E9,F`.
- Legacy camelCase aliases are kept for old notebooks (`trainModel`, `InstantiateModel`,
  `evalModel`, `validateModel`). Leave them in place.
- Tests are dataset-free and model-free. Use `tmp_path` and synthetic arrays. CI must
  never need the audio dataset.
- Frontend: function components, Zustand for cross-page state, all HTTP calls in
  `src/utils/predict.ts`, Lucide icons imported by deep path
  (`lucide-react/dist/esm/icons/<name>.js`), and design tokens from `documentation/design.md`.
- Commit/PR attribution follows the session's system instructions.
