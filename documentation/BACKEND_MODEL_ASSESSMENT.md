# Backend and Model Assessment Report

Assessment date: 2026-08-03

## Executive rating

| Area | Rating | Why |
|---|---:|---|
| Backend engineering | 7/10 | Clear training modules, shared preprocessing, metadata-aware serving, and useful validation checks. Main weakness is a large monolithic `server.py` plus limited tests. |
| Model architecture | 6/10 | Sensible lightweight Conv1D + BiGRU sequence classifier for MFCC features. It is compact and appropriate for a prototype, but not state of the art and does not handle padding, long recordings, or uncertainty very well. |
| Model evidence / trustworthiness | 3/10 | The checked-in H5 artifact is explicitly legacy and unverified. There is no current patient-held-out benchmark artifact proving real performance. |
| Clinical readiness | 1/10 | Not clinically validated. It should remain a research/education prototype only. |
| Overall backend/model maturity | 5/10 | Good engineering direction, but the model must be retrained, benchmarked, calibrated, and documented before its predictions can be trusted. |

## Implementation Status

The codebase now enforces the report's immediate engineering safeguards: legacy
models cannot serve, artifacts require a complete metadata/evaluation/calibration
contract, uploads undergo basic container-signature validation, complete recordings
are windowed, padded frames are masked for recurrent/pooling stages, validation-set
temperature scaling and abstention are recorded, and evaluation includes per-class
specificity, calibration bins, and patient-bootstrap confidence intervals.

Two recommendations cannot be truthfully completed from this repository alone:
obtaining the authorized diagnosis labels and deciding a scientifically feasible
task for the authentic rare classes. Training now fails closed until that evidence
is supplied, rather than generating a benchmark from the historical CSV.

## What The Backend Does Well

1. **Patient-level splitting is the right idea.** `backend/main.py` splits by patient before feature extraction and augmentation, which reduces a major source of leakage in respiratory-audio work.

2. **Training-only augmentation is safer than global augmentation.** `backend/featureExtraction.py` augments only the training split, preventing augmented copies from appearing in validation or test data.

3. **Shared preprocessing reduces train/serve drift.** `backend/preprocessing.py` centralizes sample rate, MFCC count, delta features, frame length, FFT size, and hop length. The server reads the same preprocessing contract when metadata exists.

4. **The architecture is compact.** The model uses batch normalization, Conv1D layers, bidirectional GRUs, global average pooling, dropout, and a softmax head. This is reasonable for a small audio-classification prototype and should be fast to serve.

5. **Evaluation code includes stronger metrics than accuracy alone.** `backend/evaluate.py` reports balanced accuracy, macro precision/recall/F1, weighted F1, Cohen kappa, MCC, log loss, Brier score, calibration error, confusion matrix, and patient-level aggregation.

6. **Artifact metadata is thoughtfully designed.** New training runs can save class order, preprocessing settings, model hash, split manifest hash, training settings, limitations, and test metrics.

7. **Serving has useful guardrails.** The Flask server checks file extension, upload size, decoded audio duration, model output shape, probability validity, and optional model hash. External LLM calls require consent and sanitize patient fields.

8. **The documentation is honest.** The model card and legacy result files clearly warn that the checked-in artifact and historical metrics are not verified.

## Main Problems

1. **The current model artifact should not be trusted.** `backend/best_model.h5` is a legacy artifact without verified class order, preprocessing metadata, split hash, or valid held-out metrics. This is the biggest issue.

2. **There is no current benchmark result.** The intended pipeline can produce `test_metrics.json`, but no corrected artifact exists under `backend/artifacts/latest/`. Without that, the real accuracy, recall, and class behavior are unknown.

3. **Eight-class classification may be scientifically fragile.** Respiratory datasets like ICBHI are small and imbalanced. Rare classes such as Asthma or LRTI can make stratified patient-disjoint train/validation/test splits impossible or unstable unless the dataset is augmented with reliable external data or the task is redesigned.

4. **The model truncates long audio.** Features are fixed to the first 200 frames. At 22.05 kHz with a 512 hop, this is only about 4.6 seconds. Any clinically useful information after that point is discarded.

5. **Padding is not masked.** Short recordings are zero-padded, then passed through Conv1D, GRU, and global average pooling without a mask. The model can learn artifacts from padding length rather than respiratory content.

6. **Softmax confidence is not calibrated.** The server returns percentages, but the model does not have temperature scaling, abstention thresholds, out-of-distribution detection, or confidence intervals.

7. **Inference-time denoising can create train/serve mismatch.** The `/predict` and `/explain` endpoints can optionally denoise audio, but denoising is not part of the training pipeline. This can change the input distribution in unpredictable ways.

8. **The server can overwrite metadata-backed classes at startup.** In `server.py`, the module loads metadata, but the `__main__` block resets `CLASSES = load_class_labels()`. That can silently map model outputs to the wrong disease labels when running `python server.py`.

9. **`server.py` is doing too much.** It contains app config, model loading, preprocessing glue, prediction routes, saliency rendering, LLM calls, and error handling in one 900-line file. This makes safety-critical behavior harder to test.

10. **Tests are useful but thin.** Existing tests check splitting, preprocessing, augmentation, and evaluation helpers, but there are no server contract tests, artifact metadata tests, real inference-shape tests, or reproducible training smoke tests.

## Recommended Improvement Plan

### Phase 1: Make The Current System Trustworthy

1. Remove or quarantine `backend/best_model.h5` from default production use.
2. Require metadata by default: set `RESPINET_REQUIRE_METADATA=1` for normal serving.
3. Fix the `server.py` startup class override so metadata class order is never replaced by CSV-derived labels.
4. Add a server test that loads a fake metadata file and confirms class order, preprocessing settings, and model output dimension are enforced.
5. Add a test that `/health` reports a non-ready status when model metadata is missing or invalid.

### Phase 2: Rebuild The Dataset Evidence

1. Verify `patient_diagnosis.csv` against the original dataset source.
2. Record dataset provenance: source URL, download date, checksum, label counts, patient counts, excluded IDs, and reasons for exclusions.
3. Decide whether eight classes are actually feasible. If some classes have too few patients, merge rare labels into an "Other/rare disease" class or train a narrower classifier.
4. Use patient-disjoint splits only. Prefer repeated patient-level cross-validation if the dataset is small.
5. Report confidence intervals with patient-level bootstrapping.

### Phase 3: Improve The Model

1. Replace fixed first-window truncation with windowed inference over the whole recording, then aggregate probabilities per recording and per patient.
2. Add masking or length-aware pooling so padded frames do not influence predictions.
3. Compare several baselines:
   - logistic regression or XGBoost on summarized MFCC features,
   - the current Conv1D + BiGRU,
   - a CNN on log-mel spectrograms,
   - a pretrained audio embedding model followed by a small classifier.
4. Tune augmentation carefully: noise, time shift, speed perturbation, band masking, and device/channel simulation. Keep augmentation training-only.
5. Add calibration after training, such as temperature scaling on validation data.
6. Add abstention: return "uncertain" when confidence is low, entropy is high, or the audio looks out of distribution.

### Phase 4: Strengthen Evaluation

Report at least:

- patient-level and recording-level accuracy,
- balanced accuracy,
- per-class sensitivity/recall and specificity,
- macro F1 and weighted F1,
- confusion matrix,
- one-vs-rest AUROC where class support allows it,
- log loss, Brier score, and calibration curve,
- bootstrap confidence intervals,
- performance by disease, recording device/location, duration, and signal quality when metadata is available.

The most important metric is not overall accuracy. For this project, **macro recall, per-class recall, balanced accuracy, calibration, and patient-level performance** matter more because the classes are imbalanced and medical false negatives can be serious.

### Phase 5: Make Serving Safer

1. Split `server.py` into smaller modules: config, model contract, audio IO, prediction, explainability, LLM summarization, and routes.
2. Add MIME/content sniffing instead of extension-only audio validation.
3. Add structured logging without raw patient data.
4. Add request IDs and clear readiness vs liveness endpoints.
5. Use a production WSGI server for deployment instead of Flask's development server.
6. Add rate limits and authentication if this is exposed beyond local demos.
7. Make every response state that outputs are research-only and not diagnostic.

## Bottom Line

The backend has a good foundation for a research prototype. The strongest parts are the patient-safe pipeline design, shared preprocessing, metadata concept, and broad evaluation helpers.

The weak point is not just the neural network. The weak point is **evidence**: the repository does not currently contain a verified, metadata-backed, patient-held-out model result. Until that exists, the model should be rated as an interesting prototype rather than a reliable respiratory disease recognizer.

Best next step: fix the server metadata bug, verify the labels, retrain with patient-disjoint splits, save `artifacts/latest/model_metadata.json` and `test_metrics.json`, then re-rate the model using patient-level metrics.
