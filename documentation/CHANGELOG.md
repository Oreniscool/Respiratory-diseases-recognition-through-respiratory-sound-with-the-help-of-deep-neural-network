# Changelog

All notable frontend revamp work is recorded here.

## 2026-08-02 — Respiratory Atlas Frontend Revamp (Completed)

### Summary of Changes

- **Frontend Overhaul:** Completed the React + Vite + TypeScript frontend according to the **Respiratory Atlas** design spec (`design.md`).
- **Cleaned Up Obsolete Code:** Removed unneeded legacy files (`DiagnosePage.tsx`, `DiseasesPage.tsx`, `ChatPage.tsx`, `HowItWorksPage.tsx`, `MetricsPage.tsx`, `HomePage.tsx`, `AmbientEffects.tsx`, `AnimatedCounter.tsx`, `ChatMessage.tsx`, `PipelineSteps.tsx`, `ProbabilityChart.tsx`, `TiltCard.tsx`, `diseases.ts`, `chatStore.ts`).
- **Replaced Old Frontend:** Cleared the old vanilla HTML/CSS/JS frontend directory (`frontend/`) and replaced it with the completed React application as the single canonical frontend (`frontend/`).
- **Primary Routes & Components:**
  - `AnalyzePage.tsx`: Integrated file upload, drag-and-drop, microphone audio recording, sample dataset selection, real server inference, and optional report consent.
  - `EvidencePage.tsx`: Integrated runtime health status, model method steps, ICBHI dataset facts, and responsible use guidance.
  - `LearnPage.tsx`: Searchable plain-language respiratory reference covering all 8 project labels with source citations and glossary.
  - `ReportPage.tsx`: Formatted research summary display with print support and plain text download.
  - `ExplainabilityPage.tsx`: Spectrogram, saliency, and attribution overlay visualizations with attribution safety disclaimers.
- **Workflow & Configuration Updates:** Updated `.github/workflows/checks.yml`, `README.md`, `PLAN.md`, and `design-qa.md` to reference `frontend` as the canonical frontend path.

### Verification

- Conducted full static design & visual token QA (`design-qa.md`: `final result: passed`).
- All active routes (`/`, `/evidence`, `/learn`, `/report`, `/explainability`) and legacy redirects (`/diagnose`, `/diseases`, `/chat`, `/how-it-works`, `/metrics`) verified.

## 2026-08-14 — Merged Cohort Training & Calibration (Completed)

### Summary of Changes

- **Label Correction:** Sourced authentic, peer-reviewed clinical diagnoses (`patient_diagnosis_authentic.csv`) to resolve the validation accuracy collapse caused by scrambled label maps.
- **Dataset Integration:** Reorganized the ICBHI dataset and combined it with the Kaggle Asthma V2 dataset into a unified 5-class target (`copd`, `asthma`, `healthy`, `pneumonia`, `bronchial`), enabling stable three-way patient-disjoint stratification.
- **Model Retraining:** Re-trained the Conv1D + BiGRU sequence model on the combined cohort (2,131 recordings from 331 patients), implementing `FeatureValidityMask` to eliminate zero-padding length bias.
- **Temperature Scaling & Calibration:** Applied post-hoc temperature scaling ($T = 0.844$; originally misreported here as $T \approx 1.54$) to reduce ECE to **3.33%** (recording-level) and **10.30%** (patient-level).
- **Backend Deployment:** Exposed the verified metadata-backed `best_model.keras` on port 5001 using the Flask backend (`server.py`), and confirmed full end-to-end routing with the React frontend.

> **Note (2026-10-22):** The 2026-08-14 results above were later found to be inflated by
> cross-dataset leakage (631 Kaggle clips are copies of ICBHI recordings). See the entry below.

## 2026-10-22 — Final-Phase Evidence-Validity Hardening (Completed)

Branch `final-phase-improvements`; details in `FINAL_PHASE_IMPROVEMENT_REPORT.md`.

### Summary of Changes

- **Leakage removed:** 631 of the 1,211 Kaggle Asthma V2 clips (all 401 COPD clips) turned out to
  be verbatim cuts of ICBHI recordings that were also in the merged cohort. They are now dropped,
  with tracked evidence in `backend/data/kaggle_icbhi_overlap.csv` (new tool
  `cross_dataset_overlap.py`), along with 12 byte-identical duplicates. Cohort: 1,488 recordings /
  243 patients.
- **Retrained (same model and settings):** test accuracy 77.36% recording / **75.51% patient**
  (95% CI 63.3–87.8%), balanced accuracy 73.72%, macro AUROC 0.932. The previous 82.09% was
  inflated by the leakage. Per-source test metrics are now reported.
- **Fail-closed serving:** no legacy `best_model.h5` fallback. Inference returns 503 without a
  verified contract.
- **Safety:** inference denoising is off by default, uploads need matching container signatures,
  and the Gemini API key is sent as a header instead of in the URL.
- **Provenance:** ICBHI labels must match the published distribution, `reorganize_icbhi.py` uses
  the authentic CSV by default, and `submit.sh` no longer rewrites provenance.
- **Reproducibility:** full hyperparameters, library versions and git revision are recorded in
  `model_metadata.json`. Manifests are machine-independent, and the dataset audit covers the cohort
  actually used.
- **UI and docs:** verified numbers on the Landing and Evidence pages, "calibrated research
  estimate" wording, and corrections across the chronicle, model and dataset cards, README and
  presentation dossiers.

### Verification

- 70 backend tests pass (21 before), ruff clean, TypeScript and production build clean.
- Live server: verified contract ready; test-split recordings predicted end to end; a
  missing contract → 503; random bytes → 400.


## 2026-10-22 — Accuracy Experiments and RespiNet + YAMNet Fusion (Completed)

Branch `accuracy-experiments`. Full report: [`ACCURACY_EXPERIMENTS_REPORT.md`](ACCURACY_EXPERIMENTS_REPORT.md).

- **Fair comparison method:** `backend/experiments/cv.py` compares variants with 3-fold
  patient-grouped cross-validation on the 194 development patients; the 49 test patients stay
  locked and are used once, for the adopted model.
- **Tried:** log-mel front-end (worse, −8.5 balanced accuracy), MFCC-statistics baselines (worse),
  YAMNet embeddings alone (equal), **RespiNet + YAMNet fusion (+4.6 balanced accuracy, P = 0.97,
  adopted)**. New option `--feature-type logmel` kept for future work.
- **New served model:** late fusion of RespiNet and a YAMNet-embedding logistic head
  (`main.py --fusion yamnet`). Test results: recording accuracy 84.46% (was 77.36%), patient
  accuracy **77.55%** (was 75.51%; 95% CI 65.3–89.8%), patient balanced accuracy 76.22% (73.72%),
  calibration error 0.031 (0.074). The previous model is archived in
  `backend/artifacts/v3-2026-10-22-leakfree/`.
- **Serving:** the artifact contract hash-checks the YAMNet SavedModel and the classifier head
  (a Keras Dense layer, no pickle). The server decodes each upload a second time at 16 kHz for
  YAMNet. Older artifacts load unchanged.

## 2026-10-22 — Round 2: Validity First (Completed for now; experiments continue)

Branch `round2-validity-accuracy`. Report: [`ROUND2_EXPERIMENTS_REPORT.md`](ROUND2_EXPERIMENTS_REPORT.md).

- **Real patient IDs for Kaggle clips cut from KAUH** (316 clips, 40 patients; 57 of 64 filename
  groups had mixed patients). New split, 223 patients (133 / 45 / 45).
- **External test set:** 72 KAUH patients absent from training. **The served model scores 0% on the
  45 in-label ones**: it predicts asthma for healthy and COPD patients from that hospital.
- **Shortcut probes:** every representation identifies the dataset or stethoscope more easily than
  the disease.
- **New options (off by default):** cuDNN GRUs with per-sample SpecAugment (D3, 2× faster, better
  off-device COPD), mixup, simulated-device augmentation, crackle/wheeze multi-task head, OPERA and
  band-limited YAMNet embeddings, N-member fusion with RespiNet ensembles, and a lung-sound gate that
  refuses silence, noise, speech, music and tones.
- **Served model:** RespiNet + YAMNet retrained on the corrected split: 73.33% patient / 81.25%
  recording accuracy on 45 test patients (95% CI 60.0–86.7%). No candidate met the pre-registered
  adoption rule; the unfinished variants are listed in the report's §8.
