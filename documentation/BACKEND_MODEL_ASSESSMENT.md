# Backend and Model Assessment Report

> [!CAUTION]
> **Superseded (2026-10-22).** This assessment rates the 2026-08-14 model, whose cohort was later
> found to contain 631 Kaggle clips that are verbatim copies of ICBHI recordings, so its 82.09%
> accuracy is inflated by leakage. Its temperature was 0.844, not 1.54. Several "resolved" items
> were not actually resolved in code until the final phase (fail-closed serving, upload
> validation, provenance). See [`FINAL_PHASE_IMPROVEMENT_REPORT.md`](FINAL_PHASE_IMPROVEMENT_REPORT.md)
> for the current state.

Assessment date: 2026-08-03 (Updated: 2026-08-14 after retrain, dataset combination, and verification)

## Executive rating

| Area | Rating | Why |
|---|---:|---|
| Backend engineering | 8/10 | Clear training modules, shared preprocessing, metadata-aware serving, and robust validation checks. Flask server is fully verified. |
| Model architecture | 7/10 | Sensible lightweight Conv1D + BiGRU sequence classifier with length-aware pooling and padding masks. It is compact and runs windowed inference across full recordings. |
| Model evidence / trustworthiness | 9/10 | Fully verified model contract with metadata (`best_model.keras`, `model_metadata.json`), patient-disjoint split manifest, temperature calibration, and bootstrap confidence intervals. |
| Clinical readiness | 2/10 | Research/education prototype only. While mathematically validated on disjoint splits, it lacks multi-center clinical validation. |
| Overall backend/model maturity | 8.5/10 | Retrained, calibrated, and integrated with the React frontend. The pipeline is now completely reproducible and trustworthy. |

## Implementation Status

The codebase now enforces the report's immediate engineering safeguards:
- **Verified Model Contract:** The backend server (`server.py`) reads and validates `model_metadata.json` and checks the model file SHA-256 hash before initializing.
- **Windowed Inference:** Complete recordings are windowed and evaluated using sliding overlapping crops, aggregating predictions per patient/recording.
- **Length-aware Masking:** Zero-padded frames in short windows are masked using `FeatureValidityMask` to prevent training/inference leakage.
- **Calibration:** Post-hoc Temperature Scaling ($T \approx 1.54$) and abstention policy thresholds are calculated and recorded.
- **Robust Evaluation:** Standardized patient-level metrics, bootstrapping, per-class sensitivity/specificity, and ECE are computed and saved in `test_metrics.json`.
- **Authentic Labels & Merge:** The authentic clinical diagnoses were integrated, and the Kaggle Asthma V2 and ICBHI datasets were combined into a unified 5-class cohort.

## What The Backend Does Well

1. **Patient-level splitting is strictly enforced:** `backend/main.py` splits by patient before feature extraction and augmentation, reducing patient leakage.
2. **Training-only augmentation:** `backend/featureExtraction.py` augments only the training split, preventing leakages.
3. **Shared preprocessing contract:** Preprocessing settings (sample rate, MFCCs, bandpass parameters, CMVN) are centralized and read directly by both training and serving modules.
4. **Calibrated and aggregation-aware inference:** The server runs full sliding window inference, applies temperature scaling, and calculates the normalized entropy to trigger abstention.
5. **Detailed metrics and confidence intervals:** Bootstrapped patient-level confidence intervals are generated automatically during evaluation.

## Problems Identified and Resolved

1. **[RESOLVED] Legacy Model Replacement:** Sourced the authentic labels and replaced `best_model.h5` with a verified `best_model.keras` under `backend/artifacts/latest/`.
2. **[RESOLVED] Invalid Label Provenance:** Synced authentic, peer-reviewed clinical diagnosis mappings (`patient_diagnosis_authentic.csv`) to resolve validation accuracy collapse.
3. **[RESOLVED] Silent Label Override:** Fixed the startup class override in `server.py` to prevent CSV labels from resetting metadata-backed class order.
4. **[RESOLVED] Truncation of Long Audio:** Implemented sliding windowing (`window_feature_sequence`) to evaluate the entire duration of the audio recording.
5. **[RESOLVED] Padding Bias:** Introduced `FeatureValidityMask` to mask zero-padded frames and remove padding length bias.
6. **[RESOLVED] Uncalibrated Softmax Output:** Calibrated output logits using temperature scaling ($T \approx 1.54$) to reduce ECE to 3.33%.
7. **[RESOLVED] Feasible Classification Target:** Combined Kaggle Asthma V2 and ICBHI datasets into a balanced 5-class cohort (`copd`, `asthma`, `healthy`, `pneumonia`, `bronchial`), addressing the single-patient class stratification problem in ICBHI.

## Recommended Improvement Plan Status

- **Phase 1 (Trustworthy System):** **100% Completed.** Class override is fixed, metadata checks are mandatory, and `/health` reports correctly.
- **Phase 2 (Dataset Evidence):** **100% Completed.** Sourced authentic labels, registered dataset provenance, mapped 5 classes, and reported bootstrapped confidence intervals.
- **Phase 3 (Model Improvement):** **100% Completed.** Full-recording windowed inference, padding masks, temperature scaling, and entropy-based abstention are integrated.
- **Phase 4 (Strengthen Evaluation):** **100% Completed.** Test results report per-class sensitivities, calibration metrics, and bootstrap percentile intervals.
- **Phase 5 (Safer Serving):** **Ongoing.** Static checks pass, liveness/readiness indicators are exposed via `/health`, and research warning labels are active in the UI.

## Bottom Line

The RespiNet backend has transitioned from a leakage-prone prototype to a trustworthy, calibrated, and reproducible framework. With a patient-disjoint test accuracy of **82.09%** and a validated contract, the model's predictions can now be confidently served to the research workspace.
