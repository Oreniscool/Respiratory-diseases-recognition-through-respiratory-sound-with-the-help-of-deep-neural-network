# RespiNet: Master Project Context & Prompt Dossier for Presentation Generation

> **Round 2b update (2026-10-23, supersedes the figures below where they differ).** The served model
> is now a four-member late fusion: a 3-seed RespiNet ensemble plus logistic heads over frozen
> YAMNet, OPERA-CE and HeAR embeddings. It was chosen by pre-registered patient-grouped
> cross-validation and trained with 21 KAUH patients added (split v3).
>
> - **Test set (49 patients):** **75.5% patient-level / 82.0% recording-level accuracy** (95% CI
>   63–88%; balanced 74.9% / 73.5%). Split v3 has different test patients, so this is not comparable
>   with the earlier 73.3%.
> - **KAUH holdout (24 held-out patients from the same hospital):** **healthy 17/18 correct but COPD
>   0/5**. The model follows what the site's training patients mostly were. This is within-site
>   adaptation, not generalization to a new hospital.
> - The earlier model's external failure (0/45, exact CI 0–7.9%) remains a key finding.
>
> Details: `ROUND2_EXPERIMENTS_REPORT.md` §9.

> **Round 2 update (2026-10-22, supersedes the figures below where they differ).** Kaggle clips cut
> from the KAUH hospital dataset now carry their real patient IDs, which changed the split. The served
> RespiNet + YAMNet model, retrained on the corrected split, scores **73.3% patient-level / 81.3%
> recording-level accuracy** on 45 test patients (95% CI 60–87%; balanced 71.9% / 70.5%). **On 45
> external KAUH patients from another hospital and stethoscope it scores 0%: healthy and COPD patients
> are called "asthma"**, because almost all KAUH-recorded training audio is asthma and all COPD audio is
> ICBHI. Probes show every representation identifies the dataset or stethoscope far more easily than
> the disease. Present the in-cohort numbers only as in-cohort results, and present the external
> failure as a key finding. Details: `ROUND2_EXPERIMENTS_REPORT.md`.

> **Usage Guide:**  
> Copy and paste this entire document into any LLM alongside your desired prompt instruction
> (e.g., *"Generate a 10-slide deck with speaking notes and slide layout directives based on this
> context"*).
>
> **Revised 2026-10-22 (final phase).** Every number below is traced to
> `backend/artifacts/latest/*.json` (the leakage-free retrain) or to
> `documentation/FINAL_PHASE_IMPROVEMENT_REPORT.md`. Earlier versions of this dossier quoted
> 80.81% / 82.09% accuracy, T ≈ 1.54, a 442K-parameter LeakyReLU architecture, and Grad-CAM;
> those figures were contaminated by data leakage or simply wrong. **Do not use them.**

---

## 1. System Prompt to Give the External LLM

```text
You are a biomedical AI engineer and scientific presentation designer.
Generate a technically rigorous academic presentation from the project dossier below.

When generating the presentation:
1. Explain the clinical problem and why automated analysis of lung sounds is a research question.
2. Contrast the flawed baseline prototype with the corrected pipeline.
3. Detail the signal processing pipeline, the neural network, and the loss/optimization mechanics.
4. Present the leakage-free results honestly, including confidence intervals, per-class and
   per-source results, and the weakest classes. Explain that removing data leakage lowered the
   headline accuracy, and why that makes the result more trustworthy.
5. Describe explainability (time-only gradient saliency) and selective abstention as research
   aids, never as clinical evidence.
6. Never describe the system as diagnostic, screening-grade, clinically validated, or suitable for
   clinical decisions. It is a research prototype.
7. Provide slide titles, bullet points, visual layout recommendations, and verbatim speaker notes
   with estimated timings. Use only numbers stated in this dossier.
```

---

## 2. Core Project Identity & Use Case

- **Project Name:** RespiNet (product UI: *Respiratory Atlas*).
- **Domain:** acoustic biomedical signal processing, deep learning, computer-aided auscultation
  research.
- **Technology stack:**
  - *Deep learning:* TensorFlow 2.21 / Keras 3, librosa, SciPy, NumPy, scikit-learn (Python 3.11).
  - *Backend:* Flask REST API (gunicorn in Docker) with a fail-closed SHA-256 artifact contract.
  - *Frontend:* React 19, Vite, TypeScript, Zustand, Recharts, framer-motion, Lucide icons, Web
    Audio API.
  - *Interpretability & reporting:* time-only gradient saliency over spectrograms; temperature
    scaling with abstention; optional consented LLM summaries (Google Gemini, Groq fallback).

### The clinical problem
Stethoscope auscultation is cheap and ubiquitous but subjective: interpretation varies between
listeners, faint adventitious sounds (fine crackles, mild wheezes) are easy to miss, ambient
noise interferes, and specialists are scarce in many settings. That motivates research into
objective, reproducible acoustic analysis.

### What RespiNet does (research use only)
1. Takes a lung-sound recording (uploaded file or browser microphone).
2. Band-pass filters it (100–2,000 Hz) to suppress heartbeat, friction, and hiss.
3. Extracts 120-dimensional MFCC + Δ + Δ² features over overlapping windows covering the full
   recording.
4. Scores five labels: **asthma, bronchial** (grouped: URTI, bronchiectasis, bronchiolitis,
   LRTI), **COPD, healthy, pneumonia**.
5. Calibrates the scores (temperature scaling) and **abstains** ("uncertain") when confidence is
   low or the distribution is too flat.
6. Optionally shows a time-only gradient saliency overlay on the spectrogram, labeled as an
   experimental sensitivity view rather than causal or clinical evidence.

It is **not a medical device** and has no clinical validation.

---

## 3. Technical Evolution: Baseline vs. Corrected System

### Phase A: The legacy prototype and the "Run 1241" failure
- **Legacy model (2021):** Keras Conv1D + BiGRU on ICBHI 2017 with 8 classes. Its best recorded
  validation accuracy was 75.36%, but on a **sample-level random split**, so recordings of the same
  patient appeared in training and validation.
- **Run 1241 (SPIT GPU cluster, as reported at the time; the log is not in the repository):** with
  a patient-disjoint split on 8 ICBHI classes, validation accuracy collapsed to 11.90% and
  validation loss reached 6.8942, with early stopping at epoch 11.
- **Root causes identified:**
  1. *Patient leakage* from random sample-level splits.
  2. *Truncation:* only the first 200 frames (~4.6 s) of each recording were used.
  3. *Unmasked zero padding* entering the GRUs and pooling.
  4. *Device confounding:* four different stethoscopes/microphones, with no normalization.
  5. *Infeasible task:* ICBHI has 1 asthma and 2 LRTI patients, too few to appear in train,
     validation, and test.

### Phase B: Signal processing overhaul
1. **Butterworth band-pass, 4th order, 100–2,000 Hz**, zero-phase (`sosfiltfilt`).
2. **Features:** 22,050 Hz mono; STFT n_fft = 2,048, hop = 512 (≈23.2 ms); 40 MFCCs + 40 Δ +
   40 Δ² = **120 dimensions per frame**.
3. **CMVN:** per-feature mean/variance normalization over each **recording** (before windowing),
   reducing device gain and response differences.
4. **Non-destructive windowing:** 200-frame (≈4.6 s) windows with 50% overlap. The last window is
   anchored to the end of the recording, so nothing is discarded. Short recordings are padded and
   masked.

### Phase C: Neural network (RespiNet-Attention v3, 458,701 parameters, ≈1.75 MB)
1. **Input** `(batch, 200, 120)` → **`FeatureValidityMask`** (marks real frames) → **LayerNorm**.
2. **`MultiScaleConvBlock`:** parallel Conv1D with kernels 3 / 5 / 11 (32 channels each, GELU),
   squeeze-excitation channel re-weighting, `SpatialDropout1D(0.2)`.
3. **BiGRU (128 units)** + GELU + Dropout 0.3, with a **residual 1×1 Conv1D(256)** skip from the
   conv block added before the second GRU.
4. **BiGRU (64 units)** + GELU; both GRUs receive the validity mask.
5. **`MaskedDualTemporalPooling1D`:** attention pooling (sustained sounds) concatenated with masked
   max-pooling (short transients) → 256 dims.
6. **Head:** Dense 128 + GELU + Dropout 0.3 → Dense 64 + GELU + Dropout 0.4 → Dense 5 softmax;
   L2 = 1e-4 on all kernels.

### Phase C2: YAMNet fusion (the served model since 2026-10-22)
1. **YAMNet** (Google, pretrained on the AudioSet general-sound corpus, kept frozen) turns the
   recording, decoded at 16 kHz, into one 1,024-value embedding per 0.96 s frame.
2. The mean and standard deviation of those embeddings (2,048 values) go through a **standardized,
   class-balanced logistic regression**, stored as a one-layer Keras model (no pickled code).
3. RespiNet's and YAMNet's probabilities are each temperature-calibrated, **averaged 50/50**, and
   calibrated once more. The artifact contract pins the SHA-256 of both models.

### Phase D: Training pipeline and memory engineering
1. **Categorical focal loss** (γ = 2.0, α = 0.25) with **label smoothing 0.1**, plus balanced class
   weights.
2. **Adamax** with **cosine decay** from 3 × 10⁻⁴ to 1.5 × 10⁻⁶. Batch 64, up to 80 epochs, early
   stopping on validation accuracy (patience 18).
3. **Augmentation, training split only:** 20 dB SNR noise, time shift, time stretch ×0.8 / ×1.2,
   and online SpecAugment (2 frequency masks ≤ 15, 2 time masks ≤ 25).
4. **OOM fix:** the old pipeline kept more than 60,000 window arrays in Python lists and hit a
   ~22–26 GB peak. Chunked extraction plus a streaming `tf.data` pipeline keeps it under ~4.8 GB.

### Phase E: Dataset transformation and the leakage audit
1. **ICBHI label repair:** the repository's `patient_diagnosis.csv` contains deliberately
   scrambled labels. ICBHI is now sorted into the 5 classes from the **authentic** diagnoses, and
   any label table that differs from the published distribution is rejected.
2. **Merge with Kaggle Asthma Detection V2** (1,211 clips, five class folders) to obtain enough
   asthma and pneumonia patients.
3. **Audit finding: 631 of the 1,211 Kaggle clips (52%) are verbatim cuts of ICBHI recordings**
   that were already in the cohort, under different made-up patient IDs:
   - by class: COPD 401 of 401 (100%), healthy 74 of 133, bronchial 51 of 104, pneumonia 105 of
     285, asthma 0 of 288;
   - cut from 187 ICBHI recordings of 60 real patients;
   - match scores (normalized cross-correlation) ≥ 0.795, against ≤ 0.697 for every other clip;
   - Kaggle `P`-numbers are not patient IDs (35 of 98 groups mix several ICBHI patients), and 3
     clips labeled pneumonia come from a Healthy ICBHI patient.
4. **Fix:** drop the Kaggle copies (the full ICBHI recordings stay, with real patient IDs) and 12
   byte-identical duplicates. Training refuses to merge the datasets without the evidence file.
5. **Corrected cohort:** **1,488 recordings / 243 patients** (ICBHI 920 / 126 + Kaggle remainder
   568 / 117 groups). Patient-disjoint split: train 145 / validation 49 / test 49 patients
   (864 / 328 / 296 recordings), with no audio shared across splits.

---

## 4. Quantitative Results (held-out test split, 49 patients / 296 recordings)

The served model is a **late fusion of RespiNet and a classifier over pretrained YAMNet audio
embeddings**, chosen by cross-validation before the test split was used (see 4.1).

| Metric | Recording level | Patient level |
| :--- | ---: | ---: |
| **Accuracy** | **84.46%** | **77.55%** (95% bootstrap CI 65.3–89.8%) |
| **Balanced accuracy** | 79.87% | 76.22% |
| **Macro F1** | 0.782 | 0.763 |
| **Macro one-vs-rest AUROC** | 0.971 | 0.953 |
| **Cohen's κ / MCC** | 0.768 / 0.771 | 0.716 / 0.717 |
| **Expected calibration error** | 0.031 | 0.088 |

**Effect of removing the leakage** (RespiNet alone, identical model and settings, only the data
changed): patient-level accuracy 82.09% → 75.51%, recording-level 80.81% → 77.36%. The earlier
numbers were inflated and must not be presented as performance.

**Effect of adding YAMNet** (same split): recording-level accuracy 77.36% → **84.46%**, balanced
accuracy 71.42% → 79.87%, calibration error 0.074 → 0.031; patient-level accuracy 75.51% →
**77.55%**, which is one patient of 49 and within the confidence interval on its own.

### 4.1 How the improvement was chosen (cross-validation, test split locked)
Six variants were compared with 3-fold patient-grouped cross-validation on the 194 development
patients, with a pre-registered rule (≥ +2 points balanced accuracy and macro F1, paired-bootstrap
P ≥ 0.90). Patient-level out-of-fold balanced accuracy: RespiNet 70.0%, log-mel RespiNet 61.6%,
MFCC statistics + logistic regression 63.5%, MFCC statistics + gradient boosting 60.6%, YAMNet +
logistic regression 71.1%, **RespiNet + YAMNet fusion 74.7%** (+4.6 points, P = 0.97, the only
variant that met the rule). The fusion helps because the two models make different mistakes:
YAMNet is better on healthy and bronchial, RespiNet on asthma and pneumonia.

### Patient-level sensitivity and specificity
- **Asthma:** sensitivity 91.7%, specificity 94.6% (12 patients)
- **COPD:** 76.9% / 94.4% (13)
- **Bronchial (grouped):** 75.0% / 90.2% (8)
- **Pneumonia:** 75.0% / 97.6% (8)
- **Healthy:** 62.5% / 95.1% (8). This is now the weakest class.

### By data source
- **ICBHI test patients (26, reliable identities):** 83.0% recording / 65.4% patient accuracy.
  Only 1 asthma and 1 pneumonia patient, so per-class figures here are unstable.
- **Kaggle test groups (23, identities unverified):** 86.8% / 91.3%. Likely optimistic, because
  Kaggle has no reliable patient identifiers and part of it derives from another database (KAUH)
  that was not checked for overlap.

### Training run
RespiNet member: early stopping at epoch 62, with weights restored from epoch 44 (validation
accuracy 74.6%, training accuracy 80.3%). YAMNet head: logistic regression with C = 0.01.
Temperatures: RespiNet 0.713, YAMNet 0.999, final fused 0.674. The model abstains when the top
calibrated score is below 0.648 or the normalized entropy is above 0.519 (80% validation coverage).

---

## 5. Deployment, Interpretability & User Experience

1. **Fail-closed artifact contract:** the server serves a model only if its SHA-256 hash, ordered
   classes, preprocessing settings, calibration, evaluation, and dataset-audit files all verify.
   Otherwise inference returns 503. Run metadata records all hyperparameters, library versions, and
   the git revision.
2. **Calibration and abstention:** temperature scaling fit on validation recordings, with the
   dual-threshold abstention rule above.
3. **Interpretability (experimental):** the gradient of the predicted class score with respect to
   the input, averaged over features, for the most confident window, shown over that window's
   mel spectrogram. It is time-only and explicitly labeled as not causal or clinical evidence.
4. **Input safety:** strict audio container signature checks; inference-time denoising is off by
   default because it is not part of training.
5. **React 19 interface:** upload (WAV, MP3, WebM, OGG, M4A, FLAC) or microphone recording with a
   live level meter, a calibrated score ring, an entropy bar and uncertainty banner, a 5-run
   history, and consented LLM research summaries (Gemini or Groq) with identifiers and free text
   stripped.

---

## 6. Future Research Roadmap

1. **External validation** on independent data (e.g. SPRSound, HF_Lung), plus an overlap check of
   the remaining Kaggle data against its KAUH source.
2. **Self-supervised audio foundation models** (AST, BEATs, wav2vec 2.0) fine-tuned with LoRA.
3. **Richer short-event features:** log-mel tensors and continuous wavelet transforms for
   sub-20 ms crackles.
4. **Multimodal fusion** of acoustics with vitals (SpO₂, temperature, age, smoking history).
5. **Edge inference:** INT8 TensorFlow Lite on low-cost hardware.

---

## 7. Recommended Presentation Generation Directives for Other LLMs

- **Option 1 (academic slide deck):** *"Using the provided RespiNet context, create an 8-to-10
  slide presentation outline. For each slide, give a title, 3–4 bullets, a visual description, and
  60–90 seconds of speaker notes. Use only the numbers in the dossier and present them as research
  results, not clinical performance."*
- **Option 2 (5-minute technical pitch):** *"Summarize this context into a 5-minute talk for an
  engineering and research audience: the clinical problem, why the baseline failed, how a data
  audit found and removed cross-dataset leakage, the leakage-free result, the cross-validated
  YAMNet fusion (77.6% patient-level / 84.5% recording-level accuracy, 95% CI 65–90%), and the roadmap to external validation."*
- **Option 3 (Q&A defense):** *"Act as a tough academic panelist. Generate the 8 hardest questions
  about this methodology (patient- and audio-disjoint splitting, the Kaggle–ICBHI overlap,
  unverified Kaggle patient IDs, focal loss vs. cross-entropy, CMVN and device bias, calibration
  with a small validation set, why accuracy fell after the fix) and give rigorous answers based
  only on this context."*
