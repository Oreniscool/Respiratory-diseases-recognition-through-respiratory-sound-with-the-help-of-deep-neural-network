# CLAUDE.md — RespiNet (Respiratory Atlas)

Context for AI coding assistants working in this repository. Subdirectory files
[`backend/CLAUDE.md`](backend/CLAUDE.md) and [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
hold module-level detail. The full verified reference (history, exact architecture,
verified metrics, discrepancy register) is
[`documentation/PROJECT_CONTEXT.md`](documentation/PROJECT_CONTEXT.md).

Last verified against source and on-disk artifacts: **2026-10-22** (branch `round2-validity-accuracy`, stacked on `accuracy-experiments`).

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
Detection V2 dataset merged with ICBHI 2017** (ICBHI re-mapped to 5 classes). It is a **late
fusion** of the RespiNet network (MFCC windows) and a logistic-regression head over frozen YAMNet
embeddings (`backend/pretrained.py`). The original 2021 project targeted the 8 ICBHI classes; that model (`backend/best_model.h5`)
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

Note: the stale root-level `artifacts/latest/` (a split from the scrambled-label run) was deleted
in the final phase. Run artifacts live only in `backend/artifacts/` (gitignored): `latest/` is the
current model and `v3-2026-08-14/` is the archived, leakage-contaminated one.

---

## 4. Repository map

```text
.
├── AGENTS.md / GEMINI.md        # doc-sync rule (identical apart from the title)
├── CLAUDE.md                    # this file
├── README.md                    # user-facing overview (updated 2026-10-22)
├── Dockerfile                   # all-in-one image: nginx + `python server.py` (Flask dev server)
├── docker-compose.yml           # backend (gunicorn, :5000) + frontend (nginx, :80/:8080)
├── .github/workflows/checks.yml # CI: ruff + pytest (backend), npm ci + build (frontend)
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
│   ├── audio_validation.py      # upload extension allowlist + strict container signature check
│   ├── reorganize_icbhi.py      # ICBHI flat dir → 5-class folders (symlink/copy), authentic labels only
│   ├── cross_dataset_overlap.py # finds Kaggle clips cut from ICBHI recordings (NCC) → data/kaggle_icbhi_overlap.csv
│   ├── data/                    # TRACKED evidence: kaggle_icbhi_overlap.csv (+ .summary.json)
│   ├── pretrained.py            # YAMNet embeddings, logistic head export (Keras, no pickle), fusion math
│   ├── experiments/cv.py        # patient-grouped CV harness (test split locked) → artifacts/experiments/
│   ├── server.py                # Flask API
│   ├── wsgi.py / validate.py    # WSGI entry / standalone predict helper
│   ├── submit.sh / download_dataset.sh  # SLURM jobs for the SPIT GPU cluster
│   ├── best_model.h5, scaler.pkl        # LEGACY 2021 artifacts (8-class, no contract; do not load scaler.pkl)
│   ├── patient_diagnosis.csv            # DELIBERATELY SCRAMBLED historical labels; never train on it
│   ├── dataset_provenance.json          # stale provenance for an older scrambled CSV (checksum mismatch → rejected)
│   ├── tests/                   # dataset-free pytest tests (107 as of round 2b)
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
> TF 2.21.0, Keras 3.15.1, NumPy 2.4.6 and librosa 0.11.0, plus `nvidia-cuda-nvcc-cu12` (now in
> requirements.txt), which is needed for GPU JIT (`ptxas`/`libdevice`). Its `activate` and
> `activate.fish` were extended to export `LD_LIBRARY_PATH` (pip CUDA libs), `PATH` (ptxas) and
> `XLA_FLAGS` (libdevice). Without these, TF either skips the GPU or fails with
> `JIT compilation failed [Op:Sign]`. Venvs aren't relocatable: if the drive moves again (it used to
> be `/run/media/qitiya/SSD2`), rebuild the venv. `backend/venv.old/` is the pre-move venv; delete it
> once you no longer need it.

```bash
# --- backend setup ---
cd backend
~/.pyenv/versions/3.11.9/bin/python -m venv venv && source venv/bin/activate   # fish: activate.fish
pip install -r requirements-dev.txt   # includes nvidia-cuda-nvcc-cu12 (ptxas/libdevice)
# then add the LD_LIBRARY_PATH / PATH / XLA_FLAGS exports to the activate scripts (see note above)

# --- static checks (what CI runs; no dataset or model needed) ---
ruff check .                # clean
pytest                      # all tests pass (107 as of round 2b) (pyproject sets pythonpath=["."], so bare pytest works)

# --- datasets (into backend/dataset/) ---
./download_dataset.sh all   # Kaggle CLI or curl; also runs under sbatch
python reorganize_icbhi.py \
  --dataset-dir dataset/ICBHI_final_dataset \
  --diagnosis-csv dataset/patient_diagnosis_authentic.csv \   # NOT the default patient_diagnosis.csv!
  --output-dir dataset/ICBHI_as_folders --copy

# --- inspect a split without training ---
python main.py --dataset-format folder --merge-icbhi --prepare-only --output-dir artifacts/split-check

# --- YAMNet (once; public TF2 SavedModel, 14 MB) into artifacts/pretrained/yamnet ---
mkdir -p artifacts/pretrained/yamnet && curl -sSL \
  https://www.kaggle.com/api/v1/models/google/yamnet/tensorFlow2/yamnet/1/download \
  | tar xz -C artifacts/pretrained/yamnet

# --- train the current configuration (Kaggle V2 + ICBHI, 5 classes, RespiNet + YAMNet fusion) ---
python main.py --dataset-format folder --merge-icbhi \
  --output-dir artifacts/latest --epochs 80 --batch-size 64 --seed 42 --fusion yamnet
  # source_revision is filled from git automatically; commit first so it isn't "-dirty"

# --- compare variants without touching the test split (see experiments/cv.py docstring) ---
python -m experiments.cv cache --cache mfcc && python -m experiments.cv deep --variant D3
python -m experiments.cv embed --extractor yamnet
python -m experiments.cv report --fuse D3+E_yamnet --reference D0+E_yamnet
python -m experiments.shortcut              # dataset/device probes
python -m experiments.external --name NAME  # KAUH holdout through the served path (once per model)

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

**Ports:** local dev is **5001** (server default, `.env`, `backend/.env.example`, Vite proxy).
Docker images use **5000**. Keep them consistent when you change one.

---

## 6. Current verified state (from `backend/artifacts/latest/`, trained 2026-10-22)

**RespiNet + YAMNet late fusion** (branch `accuracy-experiments`; see
`documentation/ACCURACY_EXPERIMENTS_REPORT.md`), chosen by 3-fold patient-grouped CV on the
development patients before the test split was used. The RespiNet-only leakage-free model
(75.51% patient accuracy) is archived in `backend/artifacts/v3-2026-10-22-leakfree/`; the
2026-08-14 model in `backend/artifacts/v3-2026-08-14/`. **The latter's metrics (e.g. 82.09%) are
contaminated by cross-dataset leakage and must not be cited as performance.**

| Fact | Value | Source |
|---|---|---|
| Classes (ordered) | `asthma, bronchial, copd, healthy, pneumonia` | `model_metadata.json` |
| Members | RespiNet-Attention v3, 458,701 parameters (`model_summary.txt`) + frozen YAMNet (`yamnet/`) → logistic head, 2,048 → 5 (`yamnet_head.keras`, C = 0.01) | `model_metadata.json["fusion"]` |
| Cohort | 1,488 recordings / 223 patients (ICBHI 920 / 126 + Kaggle remainder 568 / 97: 40 real KAUH patients + 57 filename groups), after dropping 631 Kaggle copies of ICBHI audio and 12 byte duplicates | `dataset_audit.json` |
| Split (patients) | train 133 / val 45 / test 45; recordings 868 / 284 / 336 | `split_summary.json` |
| Epochs run (RespiNet) | 80 (no early stop); best epoch 67, val_acc 0.7015, train_acc 0.8436 | `training_history.json` |
| Temperatures | RespiNet 0.8443, YAMNet 1.5371 (`model_metadata.json["fusion"]`); fused **0.5592** (`calibration.json`) | |
| Abstention | min_conf 0.6929, max_norm_entropy 0.4525, 80% target coverage | `calibration.json` |
| Test acc (recording / patient) | **81.25% / 73.33%** (45 patients, round-2 split) | `test_metrics.json` |
| Balanced acc | 70.49% / 71.92% | `test_metrics.json` |
| Macro F1 | 0.648 / 0.673 | `test_metrics.json` |
| ECE | 0.0455 / 0.1955 | `test_metrics.json` |
| Macro OvR AUROC | 0.8925 / 0.9053 | `test_metrics.json` |
| Patient-bootstrap 95% CI (acc) | 60.0% – 86.7% (1,000 samples) | `test_metrics.json` |
| By source, accuracy rec. / patient | ICBHI (27 patients) 85.92% / 70.37%; Kaggle (18 patients, 316 clips with real KAUH IDs) 73.17% / 77.78% | `test_metrics.json["by_source"]` |
| **External KAUH (45 in-label patients)** | **0%**: healthy and COPD predicted asthma | `artifacts/experiments/external/served_round2.json` |
| Code revision | `b1698e9` (round 2); previous model archived in `artifacts/fusion-2026-10-22-oldsplit/` | `model_metadata.json` |

**Historical numbers in docs:** The chronicle keeps superseded figures (T ≈ 1.54, the §7.1
"refactored" table, the ~136K-parameter layer table, the never-merged "Option C" dropout values,
the leakage-contaminated §8.6 metrics) for the record, each marked with a dated
correction/superseded callout. Other docs were corrected in final-phase item 10. When citing
results, use only the table above or `backend/artifacts/latest/*.json`. See
`documentation/PROJECT_CONTEXT.md` §14 for the per-item status.

---

## 7. Invariants. Do not break these.

1. **Patient-disjoint splits.** `split_by_patient()` splits *patients* (stratified) before
   any feature extraction. It raises on any overlap. Every class needs at least 3 patients
   (`assert_three_way_class_support`). **The same audio must never appear twice:** byte
   duplicates are removed (`deduplicate_records`), and when ICBHI and Kaggle V2 are merged, the 631
   Kaggle clips that are cuts of ICBHI recordings are dropped (`exclude_cross_dataset_overlap`,
   evidence in `backend/data/kaggle_icbhi_overlap.csv`). Kaggle `P`-numbers are **not** patient IDs.
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

- **The model does not transfer to a new hospital/stethoscope (round 2).** On 45 external KAUH
  patients the pre-round-2 model predicted asthma for nearly everyone (0% accuracy), because almost
  all KAUH-recorded training audio is asthma and all COPD is ICBHI (mostly the AKG C417L). Probes
  identify the dataset/device far more easily than the disease. Never present in-cohort accuracy as
  real-world performance; see `documentation/ROUND2_EXPERIMENTS_REPORT.md`.
- **Kaggle clips cut from KAUH carry real KAUH patient IDs** (`main.assign_kauh_patient_ids`,
  evidence `backend/data/kaggle_kauh_overlap.csv`, IDs 900,000 + n). This changed the seed-42 split
  (223 patients, 133/45/45): test results before round 2 are on a different, leakier split.
- **`data/kauh_external_manifest.csv` is an external test set:** never train on it or use it to
  pick between candidates (`experiments/external.py` evaluates a served artifact once).

- **The served model is a two-member fusion.** The artifact dir must contain `yamnet/` (SavedModel)
  and `yamnet_head.keras`; `model_metadata.json["fusion"]` pins their SHA-256 and the member
  temperatures, and `load_verified_contract` refuses the artifact if either changes. The server
  decodes uploads twice (22.05 kHz for RespiNet, 16 kHz for YAMNet). `/explain` saliency covers
  RespiNet only. Artifacts without `fusion` work as before.
- **Never pick variants on the test split.** It has 49 patients (±12-point CI). Compare with
  `backend/experiments/cv.py` (3-fold patient-grouped CV on the development patients, test
  patients asserted absent) and touch the test set once per adopted configuration.
- **GPU TF32 (fixed 2026-10-23, D-23):** on the RTX 4060 a Keras Dense head differs from
  scikit-learn by up to 2.2e-3 (OPERA-CE, C = 0.1), because the TF32 error grows with the weights.
  Exported heads therefore always run on the CPU via `pretrained.predict_head` (training, the export
  check and the server); the check is 1e-4 (`main.HEAD_EXPORT_ATOL`) plus identical argmax. Never call
  `head.predict` directly. The RespiNet networks still train and infer on the GPU.

- **Saved model = restored model (fixed 2026-10-23, D-24).** `ModelCheckpoint` and `EarlyStopping`'s
  `min_delta` rule can pick different epochs; `train_model` now re-saves the restored model after
  `fit`. Before `724c52c`, an artifact's `.keras` file could be a later epoch than its reported metrics
  (the round-2 `fusion-round2-split2`: evaluated epoch 64, served file epoch 67). Parity checks that
  load the same files on both sides cannot detect this.

- **The pre-2026-10-22 metrics are contaminated.** 52% of Kaggle Asthma V2 (631 clips, including
  all 401 COPD clips) are verbatim cuts of ICBHI recordings that were also in the merged cohort,
  under different made-up patient IDs, so copies sat on both sides of the split. The 82.09% of the
  2026-08-14 model is not a valid estimate. The corrected cohort has 1,488 recordings / 243
  patients (see `documentation/FINAL_PHASE_IMPROVEMENT_REPORT.md` item 7).

- **Serving is fail-closed (since branch `final-phase-improvements`).** Without a verified
  contract the status is `"unverified"`, `CLASSES` is empty, and `/predict`, `/explain`,
  `/predict-sample` and `/summarize` return 503. There is no `best_model.h5` fallback any more.
  The UI only accepts `model_contract == "verified-metadata"`. A fresh clone without
  `backend/artifacts/latest/` therefore **cannot** run inference until a model is trained.
- **Inference denoising defaults to OFF** (`RESPINET_ALLOW_INFERENCE_DENOISING` default `"0"`
  since final-phase item 3), because it is not part of the training contract. A denoise request
  while disabled → 400. `/health` exposes `denoise_allowed`, and the UI hides the checkbox unless it
  is true. Note that the local, gitignored `.env` files on the dev machine still set it to `1`.
- **Uploads are signature-checked (final-phase item 4).** The extension must be in
  `.wav .flac .ogg .mp3 .webm .m4a` and the leading bytes must match that container. Errors are no
  longer swallowed. `/predict-sample` reads dataset files directly and is not validated.
- **ICBHI labels are verified against the published distribution** (final-phase item 6).
  `load_and_validate_provenance` and `reorganize_icbhi.py` both call
  `assert_authentic_icbhi_labels`. `reorganize_icbhi.py` defaults to
  `dataset/patient_diagnosis_authentic.csv` and needs `--force` to rebuild an existing output dir.
  This prevents a repeat of the 27–29% val-accuracy collapse (chronicle §8.5).
- **`main.py` CLI defaults override `train_model` defaults.** The CLI has batch 32,
  epochs 50, label_smoothing 0.1, `--learning-rate` 3e-4. `train_model`'s own defaults
  (64 / 75 / 0.08) only apply when it's called directly. Pass `--batch-size 64 --epochs 80` to
  reproduce the current model. Focal loss can be turned off with `--no-use-focal-loss`. Every
  setting actually used is recorded in `model_metadata.json["training"]["hyperparameters"]`, and
  `source_revision` is auto-filled from git (final-phase item 8).
- **`submit.sh` no longer generates provenance.** It trains the merged folder cohort
  (`--dataset-format folder` + ICBHI class folders, `--epochs 80 --batch-size 64`).
- **The Gemini API key is sent in the `x-goog-api-key` header** (final-phase item 5), never in the
  URL, so URL-printing error diagnostics can't leak it. Keep it that way.
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
