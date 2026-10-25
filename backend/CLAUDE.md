# backend/CLAUDE.md — training pipeline & inference API

Loaded when working inside `backend/`. Read the root [`../CLAUDE.md`](../CLAUDE.md) first.
That file covers the doc-sync rule, invariants and the source-of-truth order.
Verified against source on 2026-10-21.

---

## 1. End-to-end training flow (`main.py:run_training`)

```text
parse_args → resolve_dataset_paths (auto Kaggle path, --merge-icbhi)
  → build manifest
       folder format: build_manifest_from_folders(dataset_dir)        → list[AudioRecord]
       icbhi format : load_and_validate_provenance → map_disease_labels(4-class) → build_manifest
  → + build_manifest_from_folders(each --extra-dataset-dir)            (merged BEFORE splitting)
     every AudioRecord carries a `source` tag (source_name(): "icbhi" / "kaggle_asthma_v2")
  → exclude_cross_dataset_overlap (if icbhi + kaggle are both present; fails closed without
     data/kaggle_icbhi_overlap.csv): drops the 631 Kaggle clips that are cuts of ICBHI recordings
  → deduplicate_records (sha256; drops 12 byte-identical Kaggle files; label conflict → error)
  → dataset_audit over the cohort actually used (per-source counts, real inventory hash)
  → split_by_patient (stratified on patient label; 2 × train_test_split)
  → write split_manifest.csv (+ sha256), dataset_audit.json, split_summary.json
  → [--prepare-only stops here; TensorFlow is never imported]
  → TF GPU memory growth, set_random_seed
  → extract_manifest(train, augment=True)   val/test: augment=False
  → LabelEncoder over sorted class names → one-hot
  → train_model(...) → best_model.keras (checkpoint on val_accuracy)
  → predict val windows → mean per recording → fit_temperature → fit_abstention_policy → calibration.json
  → [--fusion yamnet] fit_yamnet_fusion: YAMNet embeddings for all splits → logistic head on train
     (C by val log loss) → yamnet_head.keras + copy of yamnet/ → member temperatures on val →
     50/50 fusion of val and test probabilities (then the usual temperature is fit on fused val)
  → predict test windows → mean per recording → apply_temperature
  → evaluate_model (recording) + evaluate_patient_level + bootstrap CIs → test_metrics.json
  → model_metadata.json (schema_version 2, sha256, classes, preprocessing, training, provenance, uncertainty)
```

Output directory contents: `best_model.keras`, `model_summary.txt`, `training_history.{csv,json}`,
`accuracy_plot.png`, `loss_plot.png`, `split_manifest.csv`, `split_summary.json`,
`dataset_audit.json`, `calibration.json`, `test_metrics.json`, `model_metadata.json`, and for
`--fusion yamnet` also `yamnet_head.keras` and `yamnet/` (the copied SavedModel; artifact ≈ 24 MB).

---

## 2. Module reference

### `preprocessing.py`: the shared train/serve contract
`PreprocessingConfig` (frozen dataclass, persisted via `to_dict()` and restored via
`from_dict()`, which silently drops unknown keys and lets missing keys take the
current defaults):

| field | default | meaning |
|---|---|---|
| `sample_rate` | 22050 | `librosa.load(sr=…, mono=True)` |
| `res_type` | `kaiser_fast` | resampler; falls back to the librosa default on error |
| `use_bandpass`, `lowcut`, `highcut` | True, 100, 2000 | 4th-order Butterworth, `sosfiltfilt` (zero-phase); skipped if `data.size < 16` |
| `n_mfcc`, `n_fft`, `hop_length` | 40, 2048, 512 | `librosa.feature.mfcc` |
| `use_deltas` | True | stacks MFCC + Δ + Δ² → `feature_dim = 120` |
| `use_cmvn` | True | per-**recording** mean/std over time (applied to the full sequence *before* windowing) |
| `max_len`, `window_hop` | 200, 100 | window frames (~4.64 s) and hop (50% overlap) |

- `extract_feature_sequence(data, sr, config)` → `(T, 120)` float32, raises on non-finite values.
- `window_feature_sequence(features, config)` → `(windows[N,200,120], valid_lengths[N], starts[N])`.
  If T ≤ 200: one window, zero-padded at the tail. Otherwise starts are `0, 100, 200, …`
  plus a final window anchored at `T-200`, so the tail is always covered.
- `extract_features()` and `pad_or_truncate()` are **legacy** helpers (first window only). Don't use them in new code.

### `featureExtraction.py`
- `AudioRecord(path, patient_id:int, disease:str)`. `ExtractedDataset` holds per-window
  arrays `X, y, patient_ids, source_paths, variants, window_starts, valid_lengths`.
- `build_manifest(dir, diagnoses_df)`: ICBHI flat dir. Patient ID is the filename prefix
  before `_` (e.g. `101_1b1_Al_sc_Meditron.wav` → 101). Raises on conflicting labels,
  missing labels or an empty result.
- `build_manifest_from_folders(dir)`: recursive search over
  `{.wav,.mp3,.flac,.m4a,.ogg,.aac}`. The label is the **lowercased parent folder name**.
  The pseudo patient ID is derived like this:
  `key = f"{disease}_P{digits}"` if the filename matches `^[pP]?(\d+)`, otherwise
  `f"{disease}_{relative_path}"`. Then `100000 + int(sha256(key)[:12],16) % 800000`.
  - Kaggle files look like `P54WheezingIE_269.wav`, so all `P54` files in one class folder
    share a patient. The key includes the class, so the same `P54` in two folders becomes
    two "patients".
  - ICBHI files (`101_…wav`) group by the real patient number.
  - Collisions are possible in principle (800k buckets) but unlikely at 331 patients.
- `_variants()`: original + `noise_20db`, `shift_right_1600` (zero-filled, not wrapped),
  `stretch_1.2`, `stretch_0.8` → up to 5 waveform variants. `--max-waveform-variants N`
  randomly keeps N of the 4 augmentations.
- `extract_manifest()` accumulates one 3-D chunk per recording, runs one `np.concatenate`,
  and calls `gc.collect()` every 100 recordings. This was the fix for the OOM problem
  (chronicle §8.4). Optional **offline** SpecAugment duplicates every window (doubling RAM).

### `Augmentation.py`
`add_noise` (SNR-relative Gaussian), `shift`, `stretch` (librosa time_stretch),
`spec_augment` (numpy; time masks stay within `valid_length`), `spec_augment_tf`
(vectorized). Note that `train.py` re-implements the TF version inline instead of calling
`spec_augment_tf`.

### `model.py`: RespiNet-Attention v3 (`instantiate_model(input, num_classes)`)
```text
Input (200,120) ─► FeatureValidityMask (bool (B,200): any feature ≠ 0)
      └► LayerNorm ─► MultiScaleConvBlock(96 = 3×32 ch; k=3,5,11; GELU; SE(r=4); SpatialDropout 0.2; L2 1e-4)
            ├► BiGRU(128, return_sequences, activation=None, L2) [mask] ─► GELU ─► Dropout 0.3 ─┐
            └► Conv1D(256,k=1,L2) "skip_proj" ─► LayerNorm ──────────────────────────────────── Add "residual_add"
                 ─► BiGRU(64, activation=None, L2) [mask] ─► GELU                       (B,200,128)
                 ─► MaskedDualTemporalPooling1D(attn_units=128): [softmax-attention ctx ‖ masked max] → (B,256)
                 ─► Dense 128 + GELU + Dropout 0.3 ─► Dense 64 + GELU + Dropout 0.4 ─► Dense C softmax (L2)
```
- GRUs use `activation=None` (a linear candidate state) followed by GELU outside the GRU.
  This is unusual. Keep it unless you are deliberately re-architecting.
- There is **no** `recurrent_dropout` and no 0.4/0.5 dense dropout, despite the chronicle's
  Phase 7 "Option C" text.
- `MaskedGlobalAveragePooling1D` is defined and registered but **unused** in v3. It is kept
  for loading older artifacts. Don't delete it.
- Every custom layer is `@register_keras_serializable(package="respinet")` and must also
  appear in `server.py` `custom_objects`.

### `train.py`
- `CategoricalFocalLoss(gamma=2.0, alpha=0.25, label_smoothing)`: smooths targets, clips
  predictions, computes `alpha * y * (1-p)^γ * -y*log p`. Note that `y_true` appears
  **twice** (in the weight and in the CE term), so the smoothed off-target mass is
  effectively squared. That is a quirk, not textbook focal loss.
- `train_model(...)` defaults: `batch_size=64, epochs=75, learning_rate=3e-4,
  label_smoothing=0.08`. **`main.py` always passes its own CLI values** (batch 32, epochs 50,
  smoothing 0.1, `--learning-rate` 3e-4 by default). Fixed constants (`FOCAL_GAMMA`,
  `FOCAL_ALPHA`, `COSINE_DECAY_ALPHA`, `EARLY_STOPPING_*`) live at the top of `train.py`, and
  `main.build_model_metadata` records them.
- Optimizer: `Adamax(CosineDecay(lr, decay_steps=steps_per_epoch*epochs, alpha=5e-3))`.
- Class weights: sklearn `"balanced"` over **window** labels, optionally multiplied for the
  healthy class (matched case-insensitively, so it works for both `Healthy` and `healthy`).
- Callbacks: `ModelCheckpoint` and `EarlyStopping(patience=18, min_delta=0.003,
  restore_best_weights)`, both on **`val_accuracy`, mode=max** (window-level). Plus
  `CSVLogger`. `ReduceLROnPlateau` is intentionally absent: it raises `TypeError` with a
  schedule-based LR.
- **The two callbacks pick different epochs** (fixed 2026-10-23, D-24). `ModelCheckpoint` saves every
  new validation maximum; `EarlyStopping` restores the last epoch that improved by ≥ `min_delta`.
  `train_model` therefore re-saves the returned (restored) model to `model_path` after `fit`, so the
  file is the model that calibration, test metrics and CV use. Artifacts trained before `724c52c` may
  serve a later checkpoint than they were evaluated on (`fusion-round2-split2`: 64 vs 67).
- `tf.data`: shuffle (buffer ≤10k, seeded) → batch → optional online SpecAugment `map` →
  prefetch. The online SpecAugment draws **one mask per batch** (shared across samples) and
  time masks can land in padding. A time-masked frame becomes all zeros, so
  `FeatureValidityMask` then treats it as padding.

### `calibration.py`
- `apply_temperature(probs, T)` = `p^(1/T)` renormalized. This is equivalent to logit
  scaling, done on probabilities. T < 1 sharpens and T > 1 softens.
- `fit_temperature`: grid search over 161 log-spaced T in [0.25, 5] minimizing NLL. It is
  fit on **recording-level** mean validation probabilities.
- `fit_abstention_policy(probs, target_coverage=0.8)` sets `min_confidence` to the
  20th-percentile max-prob and `max_normalized_entropy` to the 80th-percentile normalized
  entropy.
- `is_uncertain` returns True if `conf < min_confidence OR entropy > max_entropy`. With an
  empty policy it is never uncertain.

### `evaluate.py`
`aggregate_probabilities_by_group` (mean over windows per recording), `evaluate_model`
(accuracy, balanced acc, macro P/R/F1, weighted F1, κ, MCC, log loss, Brier, 10-bin ECE,
calibration curve, confusion matrix, classification report, per-class sens/spec, macro OvR
AUROC or `None`), `evaluate_patient_level` (mean per patient), and
`bootstrap_patient_confidence_intervals` (≥100 samples; re-indexes duplicate draws).

### `artifact_contract.py`
`load_verified_contract(model_path, metadata_path)` requires these metadata keys:
`schema_version≥2, model_filename (== basename), model_sha256 (64 hex, must match file),
classes (non-empty unique strings), preprocessing (dict), evaluation_file,
calibration_file (both must exist and parse as JSON), data_provenance.dataset_audit_file
(must exist), source_revision`. It returns a `ModelContract`. It does **not** check the
input shape, the split hash, or that `source_revision` ≠ `"unknown"`.

### `dataset_provenance.py`
- `ICBHI_2017_PATIENT_COUNTS` is the authentic per-patient label distribution (COPD 64,
  Healthy 26, URTI 14, Bronchiectasis 7, Bronchiolitis 6, Pneumonia 6, LRTI 2, Asthma 1).
- `load_and_validate_provenance` checks that the required fields are present,
  `dataset_name == "ICBHI 2017 Respiratory Sound Database"`, the ISO date, and the CSV sha256.
  Both the declared `label_counts` and the CSV's per-patient counts must equal
  `ICBHI_2017_PATIENT_COUNTS` (`assert_authentic_icbhi_labels`, final-phase item 6). Before that
  fix, self-declared counts were accepted. The repo's `dataset_provenance.json` describes an
  older scrambled CSV and fails on checksum.
- `LABEL_MAPPING_4CLASS` (only used for `--dataset-format icbhi --group-classes 4-class`):
  COPD, Healthy, Non_COPD_Chronic (Bronchiectasis, Asthma), Acute_Infection (URTI,
  Pneumonia, Bronchiolitis, LRTI). This is **different** from the 5-class mapping in
  `reorganize_icbhi.py`.
- `assert_three_way_class_support` raises if any class has fewer than 3 patients.

### `pretrained.py`: YAMNet member and fusion (shared by training, experiments, server)
- `load_yamnet(dir)` (`tf.saved_model.load`), `load_yamnet_audio(path)` (librosa, 16 kHz mono, no
  band-pass), `yamnet_embedding(model, waveform)` → mean ‖ std of the 1,024-d frame embeddings (2,048).
- `fit_logistic_head` (StandardScaler + `LogisticRegression(class_weight="balanced")`, C from
  {0.001, 0.01, 0.1, 1} by validation log loss) and `export_logistic_head`, which folds the scaler
  into one Keras `Dense(softmax)` layer. **Never pickle estimators.** Evaluate heads only through
  `predict_head(head, x)`, which runs on the CPU in full float32. On the GPU, TF32 moved OPERA-CE
  probabilities by up to 2.2e-3 (EXP-014); on the CPU the head matches scikit-learn to ~3.5e-6, so
  `main.py` checks `HEAD_EXPORT_ATOL = 1e-4` plus identical argmax.
- `fuse_probabilities(respinet, yamnet, fusion)`: weighted mean of member-calibrated vectors; the
  caller then applies the `calibration.json` temperature.
- `directory_sha256(dir)`: one hash over every file of a SavedModel, used by the contract.

### `experiments/cv.py`: comparing variants without the test split
`python -m experiments.cv {folds,cache,deep,classical,yamnet,report}`. Development set = train +
validation of the seed-42 split (test patients asserted absent); 3 `StratifiedGroupKFold` folds by
patient, each with an inner 20% patient split for early stopping and temperature. Feature caches
(`artifacts/experiments/cache/`, 3.4 GB for MFCC, 5.4 GB for log-mel) are extracted once with the
training augmentation; scoring uses `variants == "original"`. Each variant writes calibrated OOF
rows (`oof_<id>.csv`); `report` writes `results.json` with a paired patient bootstrap vs D0.
A deep variant takes ~70 min for 3 folds on the RTX 4060.

### Round 2 additions (branch `round2-validity-accuracy`)
- `kauh.py`: KAUH filename parsing (`BP12_Asthma,...wav` → patient 12, bell filter, label), label map
  (N→healthy, Asthma, Pneumonia, COPD, BRON→bronchial; anything else out of label),
  `external_manifest()` → `data/kauh_external_manifest.csv` (72 patients absent from Kaggle).
- `main.assign_kauh_patient_ids` (inside `build_cohort`, after the ICBHI exclusion): Kaggle clips
  matched to KAUH (`data/kaggle_kauh_overlap.csv`) get ID 900,000 + KAUH patient; fails closed;
  `--no-kauh-ids` / `--kauh-overlap-csv`.
- `experiments/shortcut.py`: probes predicting dataset / ICBHI device / disease from each
  representation. `experiments/cv.shortcut_metrics`: off-device COPD sensitivity and Meditron
  accuracy for every variant. `report --fuse A+B` (equal weights) or `--fuse stack:A+B` (nested
  learned stacking, worse here).
- `experiments/external.py`: KAUH external set through the served path for one artifact
  (`RESPINET_MODEL_PATH`/`RESPINET_MODEL_METADATA`); writes `artifacts/experiments/external/<name>.json`.
- Training options (defaults unchanged): `--cudnn-gru` (needs `--spec-augment-mode sample`, because
  cuDNN rejects masks with holes and batch SpecAugment zeroes whole frames), `--mixup-alpha`,
  `--device-augment` (`Augmentation.device_response`), `--multitask` (aux crackle/wheeze head from
  ICBHI `.txt` cycle annotations; saved model keeps only the class output).
- `pretrained.Extractor` (yamnet, yamnet_bandpass, opera_ct, opera_ce; OPERA code vendored in
  `third_party/opera/`, weights in `artifacts/pretrained/opera/`, PyTorch CPU build), `--fusion
  members --fusion-members yamnet,opera_ce --ensemble-seeds N` → `fusion.type = late_fusion_members`.
- `pretrained.lung_sound_gate`: server refuses silence, broadband noise, speech, music and tones for
  artifacts that ship YAMNet (`RESPINET_LUNG_SOUND_GATE`, `/health.lung_sound_gate`).

### Research analyses added 2026-10-23…25 (`experiments/`; none changes the served model)
- `leakage_ladder.py` (X1 + `fidelity` grid), `site_vs_band.py` (X2), `contamination.py` (C4),
  `match_validation.py` (copy-detector recall and the blind listening set).
- `nonbreath.py` (source probes on non-breath audio), `loso.py` (leave-one-source-out),
  `learning_curve.py` (KAUH adaptation), `ast_embed.py` (frozen AST cache; needs `transformers`),
  `ast_finetune.py` (`prepare` / `finish` in the main venv, `train` in `venv-gpu`).
- `fingerprint_match.py`: a second, independent copy detector (landmark fingerprinting) that cross-checks
  the cross-correlation audit (C-31).
- **PyTorch on the GPU lives in a separate venv, `backend/venv-gpu`** (`requirements-gpu.txt`). Never
  install CUDA PyTorch into `venv`: it downgrades the NVIDIA libraries TensorFlow's GPU setup uses.
  `venv` keeps the CPU PyTorch build (OPERA, transformers) on purpose.
- `research/tools/*.py` turn their outputs into the ledger, figures and documents;
  `collect_evidence.py --check` keeps the ledger in sync.
- `kauh.audio_linked_patients` / `drop_audio_linked` build the v2 holdout.
  `experiments/external.py` defaults to it and refuses audio-linked patients.

### `cross_dataset_overlap.py` (evidence tool)
Finds clips of one dataset that are cut from recordings of another. Audio is band-passed to
100–1000 Hz at 4 kHz, and each clip is slid over every reference recording with normalized
cross-correlation, which is gain-invariant. On Kaggle V2 vs ICBHI, the 631 verbatim cuts score
≥ 0.795 (mostly ≥ 0.99) and every other clip scores ≤ 0.697, so `DEFAULT_THRESHOLD = 0.75`.
Output: `data/kaggle_icbhi_overlap.csv` (**tracked**, consumed by `main.py`) +
`.summary.json`. A full run with 14 workers takes ~11 min. Workers are pinned to 1 BLAS/OpenMP
thread via `threadpoolctl`. Without that, 16 threads × 12 workers thrashed the scheduler and a
run took over an hour. Regenerate the file if either dataset changes, because `main.py` refuses a
file that doesn't cover every Kaggle clip.

### `reorganize_icbhi.py`
ICBHI → 5 class folders: COPD→copd, Healthy→healthy, Pneumonia→pneumonia, Asthma→asthma,
URTI/Bronchiectasis/Bronchiolitis/LRTI→bronchial. Symlinks by default, `--copy` for hard
copies. The default `--diagnosis-csv` is `dataset/patient_diagnosis_authentic.csv`, and labels are
checked with `assert_authentic_icbhi_labels` before anything is written. An output dir that already
holds files is refused unless `--force` is given, which deletes and rebuilds the five class folders.

---

## 3. `main.py` CLI (real defaults)

| flag | default | notes |
|---|---|---|
| `--dataset-dir` | `dataset/ICBHI_final_dataset` | auto-replaced by the Kaggle path in folder mode |
| `--dataset-format` | `icbhi` | `icbhi` or `folder`; the current model used `folder` |
| `--diagnosis-csv` / `--dataset-provenance` | `patient_diagnosis.csv` / `dataset_provenance.json` | icbhi format only |
| `--group-classes` | `4-class` | icbhi format only |
| `--extra-dataset-dir DIR` (repeatable), `--merge-icbhi` | – | merged before the split |
| `--test-size`, `--validation-size` | 0.20, 0.20 | total patient fractions |
| `--seed` | 42 | python/numpy/TF seeds, split seed, aug RNG |
| `--batch-size`, `--epochs` | **32, 50** | pass `--batch-size 64 --epochs 80` to match the current run |
| `--label-smoothing` | 0.1 | |
| `--use-focal-loss` / `--no-use-focal-loss` | focal | `BooleanOptionalAction` |
| `--learning-rate` | 3e-4 | initial Adamax LR for `CosineDecay` |
| `--no-augmentation`, `--max-waveform-variants` | off, all 4 | |
| `--no-spec-augment`, `--offline-spec-augment` | online SpecAugment on | |
| `--num-freq-masks/--max-freq-mask/--num-time-masks/--max-time-mask` | 2/15/2/25 | |
| `--healthy-class-multiplier` | 1.0 | applies to `Healthy`/`healthy` |
| `--bootstrap-samples`, `--abstention-coverage` | 1000, 0.80 | |
| `--exclude-patient ID` (repeatable) | [] | |
| `--source-revision` | `$RESPINET_SOURCE_REVISION`, else the git commit (`-dirty` if modified) | the 2026-08-14 artifact says `unknown` |
| `--prepare-only` | off | split files only |

Audit and manifest (final-phase item 7): `dataset_audit.json` describes the cohort *after*
merge, overlap exclusion and dedup, with `per_source` counts, a content hash of every file
(`audio_inventory_sha256`), `cross_dataset_overlap` (evidence file + sha256 + removed counts)
and `duplicates_removed`. `split_manifest.csv` has a `source` column and backend-relative paths,
so its hash no longer depends on the machine. `test_metrics.json["by_source"]` has recording- and
patient-level metrics for each source. `--overlap-csv` (default `data/kaggle_icbhi_overlap.csv`)
and `--no-overlap-exclusion` (which reintroduces leakage) control the overlap step.

---

## 4. Inference API (`server.py`)

Import-time behavior: `load_dotenv()`, then `CLASSES = load_model_contract()`. The model
itself loads lazily (`load_model_once`, thread-locked) or eagerly under `__main__`.

| Route | Method | Behavior |
|---|---|---|
| `/live` | GET | always `{"status":"ok"}` |
| `/ready` | GET | 503 unless `CONTRACT` is set and the model loads. Returns classes and output dim |
| `/health` | GET | cheap status; **never loads the model** (it is loaded eagerly at startup by `server.py __main__` and `wsgi.py`). Returns `model` (loaded?), `model_file`, `dataset`, `classes`, `model_contract` (`verified-metadata` or `unverified`), `ready`, `contract_error`. Polled by the UI every 5 s |
| `/predict` | POST multipart `file`, optional `denoise` | returns the payload below (fused scores for a fusion artifact) |
| `/predict-sample/<disease>` | GET `?denoise=` | finds the **first** audio file whose parent folder name matches the class (recursive glob over `dataset/Asthma_Detection_V2`, `dataset/`, `DATASET_DIR`), falls back to the ICBHI CSV lookup, then predicts. Always returns the same file |
| `/explain` | POST multipart `file`, `denoise`, `payload` JSON (`include_reason`, `patient_info`, `external_llm_consent`) | prediction + gradient saliency for the **single window** with the highest predicted-class probability, rendered over that window's 128-mel spectrogram (PNG data URIs), + optional LLM reasoning |
| `/summarize` | POST JSON `model_result`, `patient_info`, `external_llm_consent` | sanitizes inputs and returns `{summary, model}` from the LLM |

Prediction payload: `prediction` (class or `"uncertain"`), `model_prediction`, `confidence`
(%), `probabilities` {class: %}, `uncertain`, `uncertainty{normalized_entropy, min_confidence,
max_normalized_entropy}`, `mfcc_preview` (10 values), `duration_s`, `sample_rate`,
`windows_analyzed`, `valid_frames`, `noise_cancellation`, `research_only: true`.

Inference math: per-window softmax, renormalized → **mean over windows** → for a fusion artifact,
`fuse_probabilities` with the YAMNet head's output on the 16 kHz decode (`model_metadata.json["fusion"]`
temperatures and weights) → `apply_temperature(T from calibration.json)` → abstention via `metadata["uncertainty"]`. (Metadata says "mean
calibrated probability across all windows", but the code calibrates the mean. It matches how
calibration was fit, so the behavior is correct and only the label is misleading.)

Request controls (`before_request`): optional bearer token `RESPINET_API_TOKEN` (the frontend
never sends one), and an in-memory per-IP rate limit of `RESPINET_RATE_LIMIT_PER_MINUTE` (30),
kept per process, so per gunicorn worker. Health routes are exempt. Response headers:
`X-Request-ID`, `Cache-Control: no-store`, `nosniff`, `X-Frame-Options: DENY`. JSON request
log line on every response.

Audio limits: `MAX_CONTENT_LENGTH = RESPINET_MAX_UPLOAD_MB` (25) → 413. Decoded duration has to
be between 1 s and `RESPINET_MAX_AUDIO_SECONDS` (120). The limit is checked *after* the full
decode.

LLM: `call_llm` prefers Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`=gemini-2.5-flash, REST
`generateContent`, key in the `x-goog-api-key` header) and falls back to Groq (`GROQ_*`,
llama-3.1-8b-instant, OpenAI-compatible). Consent is enforced server-side.
`_sanitize_patient_info` allowlists `age, sex, bmi, smoker_status, pack_years, symptom_days,
cough_type, sputum_color, temperature_c, spo2, respiratory_rate, heart_rate, capture_mode`
(strings capped at 80 chars) and the lists `symptoms, exposures` (≤20 items). `patient_id`
and `notes`, which the UI does send, are dropped.

### Environment variables
`RESPINET_HOST` (127.0.0.1), `RESPINET_PORT` (5001), `RESPINET_MODEL_PATH`
(artifacts/latest/best_model.keras), `RESPINET_MODEL_METADATA` (alongside the model),
`RESPINET_DATASET_DIR`, `RESPINET_DIAGNOSIS_CSV`, `RESPINET_MAX_UPLOAD_MB` (25),
`RESPINET_MAX_AUDIO_SECONDS` (120), `RESPINET_CORS_ORIGINS` (localhost/127.0.0.1:5173),
`RESPINET_ALLOW_INFERENCE_DENOISING` (**"0"**, exposed as `/health.denoise_allowed`), `RESPINET_API_TOKEN`,
`RESPINET_RATE_LIMIT_PER_MINUTE` (30), `RESPINET_LOG_LEVEL`, `RESPINET_SOURCE_REVISION` (used by
main.py), `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_API_URL`, `GROQ_MODEL`,
`GROQ_DEBUG` (read, unused), `GROQ_USER_AGENT`. `RESPINET_REQUIRE_METADATA` is documented but
**not read anywhere**.

---

## 5. Known defects & sharp edges (verified in code)

| # | Where | Issue |
|---|---|---|
| 1 | ~~`server.py` legacy fallback~~ | **Fixed (final-phase item 2):** contract failure → status `unverified`, empty `CLASSES`, inference endpoints 503, no `best_model.h5` fallback. Covered by `tests/test_server_fail_closed.py` |
| 2 | ~~`server.py` denoise default~~ | **Fixed (final-phase item 3):** default `"0"`. Disabled requests get 400 before decoding. Covered by `tests/test_server_denoise.py` |
| 3 | ~~upload validation~~ | **Fixed (final-phase item 4):** strict per-extension signatures (RIFF/WAVE, fLaC, OggS, EBML, ID3/MPEG sync, ftyp), `.m4a` allowed, `_read_audio_upload` no longer swallows errors. Verified on all 2,131 dataset WAVs and ffmpeg-encoded samples of every format |
| 4 | ~~API key in URL~~ | **Fixed (final-phase item 5):** key sent as `x-goog-api-key` header. Covered by `tests/test_llm_key_handling.py` |
| 5 | ~~self-referential provenance~~ | **Fixed (final-phase item 6):** counts must equal the published ICBHI distribution; `submit.sh` no longer writes provenance. Covered by `tests/test_dataset_provenance.py` |
| 6 | ~~`reorganize_icbhi.py` defaults~~ | **Fixed (final-phase item 6):** defaults to the authentic CSV, validates labels before writing, rebuilds only with `--force` |
| 7 | ~~focal loss / LR flags~~ | **Fixed (final-phase item 8):** `--no-use-focal-loss`, `--learning-rate`. Covered by `tests/test_run_metadata.py` |
| 8 | ~~healthy multiplier case~~ | **Fixed (final-phase item 8):** matched case-insensitively |
| 9 | ~~folder audit / source revision~~ | **Fixed (items 7–8):** audit built after merge with real hashes; `source_revision` from git |
| 10 | `server.py:627-650` | `/health` triggers the full model load. Polled every 5 s by the UI |
| 11 | `train.py` SpecAugment | One mask per batch. Time masks can hit padding, and masked frames turn into "padding" for the validity mask |
| 12 | `server.py:197` | `NamedTemporaryFile(delete=False)`: the temp upload is left behind if the process dies mid-request |
| 13 | `server.py:686` | `/predict-sample` does a recursive glob over the whole dataset tree on every request |
| 14 | `scaler.pkl` | Unused pickle. Never load it (arbitrary-code risk) |

Do not "fix" these silently as a side effect of another change. Each one alters behavior or
the evidence trail, so make it its own change and record it in the chronicle.

---

## 6. Tests (`tests/`, 87 tests, dataset-free)

Accuracy-experiment additions: `test_experiments_cv` (folds, locked test patients, OOF files,
paired bootstrap, end-to-end shallow run + report), `test_fusion` (Keras head == scikit-learn,
fusion math, directory hash, contract rejects a tampered head or YAMNet, server fused aggregation),
log-mel cases in `test_preprocessing`, and the `--feature-type` metadata test.

Final-phase additions: `test_server_fail_closed`, `test_server_denoise`, `test_llm_key_handling`,
`test_dataset_provenance`, `test_cohort_integrity`, `test_cross_dataset_overlap`,
`test_run_metadata`, a strict-JSON test in `test_evaluate`, and 16 new upload-signature cases in
`test_audio_validation`. The original 21 are:

`test_artifact_contract` (class order kept; tampered hash rejected), `test_audio_validation`,
`test_augmentation` (shift zero-fill, seeded noise, numpy and TF SpecAugment),
`test_calibration`, `test_evaluate` (perfect metrics; window→recording aggregation),
`test_evaluate_patient`, `test_preprocessing` (feature_dim=120, pad/truncate),
`test_server_readiness` (imports `server`, so TF and the module import side effects run),
`test_splitting` (no patient overlap; rejects <3-patient classes), `test_windowing` (tail
coverage; short-recording padding).

`test_server_fail_closed` covers the no-contract path (503s, no fallback, `/health` side-effect free).
There is no test for the model graph, `build_manifest_from_folders`, a successful `/predict`,
or the LLM sanitizers. If you add one, keep it dataset-free and build tiny models
with `instantiate_model` on small shapes.
