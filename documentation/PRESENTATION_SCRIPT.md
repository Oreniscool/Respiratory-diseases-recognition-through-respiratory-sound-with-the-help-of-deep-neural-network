# RespiNet / Respiratory Atlas: Progress & Technical Evolution Presentation Script

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

**Target Duration:** ~8–10 Minutes  
**Audience:** Technical Reviewers, Academic Committee, and Clinical Engineering Stakeholders  
**Scope:** Progress, Backend Refactoring, Architecture Evolution, and Empirical Verification since the baseline prototype.

> **Updated 2026-10-22 (final phase).** Slides 4, 6, 7 and 8 and the quick-card use the
> leakage-free retrain. Earlier versions of this script quoted 80.81% / 82.09% accuracy,
> T ≈ 1.54 and a 442K-parameter architecture; those figures are contaminated or wrong and must not
> be used. Source of truth: `FINAL_PHASE_IMPROVEMENT_REPORT.md`. Run 1241 figures (Slide 2) are as
> reported at the time; that run's log is not in the repository.

---

## Slide 1: Title & Clinical Use Case

* **Visuals on Slide:** 
  - Project Title: **RespiNet (Respiratory Atlas)**
  - Subtitle: *Deep Learning-Assisted Computer-Aided Auscultation (CAA) for Multi-Class Respiratory Disease Screening*
  - Pipeline Diagram: Digital Stethoscope Audio $\rightarrow$ Butterworth Bandpass (100–2000 Hz) $\rightarrow$ 120-dim $\text{MFCC}+\Delta+\Delta^2$ $\rightarrow$ Deep Sequence Model $\rightarrow$ Calibrated 5-Class Prediction + Time-Only Gradient Saliency Map + LLM Clinical Draft.
* **Estimated Time:** 1:00 min

> **[SPEAKER SCRIPT]:**  
> "Good morning, everyone. Today, I am presenting the latest technical evolution of **RespiNet**, also known as **Respiratory Atlas**—an AI-assisted computer-aided auscultation and clinical decision support system.
>
> For over two centuries, the acoustic stethoscope has served as the frontline instrument for pulmonary evaluation. However, conventional auscultation is constrained by high inter-observer variability, subjective human auditory perception, acoustic environmental noise, and a severe shortage of experienced pulmonologists in primary healthcare settings.
>
> **The Use Case of RespiNet:**  
> RespiNet addresses these limitations by providing an objective, reproducible, and scalable research tool (not a screening or diagnostic device). The system analyzes auscultation recordings, removes non-pulmonary noise, extracts dynamic time-frequency spectral features, and classifies patient acoustics across **five major clinical categories: COPD, Asthma, Pneumonia, Bronchial conditions, and Healthy controls**.
>
> Crucially, RespiNet is not a black box: it incorporates **post-hoc probability calibration** with a selective abstention policy for ambiguous cases, as well as **visual time-only gradient spectrogram saliency maps** so that clinicians can verify exactly which acoustic transients drove the prediction."

---

## Slide 2: The Baseline & The "Run 1241" Benchmark Crisis

* **Visuals on Slide:** 
  - Split Comparison Box:
    - *Legacy Claims:* 75.36% best validation accuracy, measured on a leakage-prone split (unverified legacy `.h5`).
    - *SPIT HPC GPU Cluster Audit (Run 1241):* Validation Accuracy: **11.90%**, Validation Loss: **6.8942**, Early Stopped at Epoch 11.
  - Failure Diagnostic Tags: *Patient Data Leakage*, *Unmasked Zero-Padding*, *Naive 4.6s Truncation*, *Hardware Confounding*, *Single-Patient Partition Failure*.
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "At our previous presentation, the project relied on a legacy prototype trained on the ICBHI 2017 dataset, whose best recorded validation accuracy was 75.36% on a leakage-prone split. However, when we subjected that pipeline to a rigorous, fail-closed engineering audit on our HPC GPU cluster, the model suffered an immediate breakdown in **Run 1241**: validation accuracy collapsed to **11.90%**—essentially worse than random guessing—and validation loss exploded to **6.89**.
>
> A post-mortem autopsy uncovered critical methodological defects in the baseline:
> 1. **Data Leakage:** Previous splits were performed at the audio frame or slice level rather than grouped by patient. Slices from the same patient existed in both train and test sets, massively inflating validation numbers.
> 2. **Naive 4.6-Second Truncation:** Feature extraction truncated recordings at the first 200 frames, discarding over 75% of longer 20-second clinical breath cycles.
> 3. **Unmasked Zero-Padding:** Short recordings were padded with trailing zeros without validity masking, causing recurrent GRU layers to learn padding representations.
> 4. **Hardware Confounding:** ICBHI was captured across four distinct stethoscope models. Without cepstral normalization, the neural network classified the microphone's frequency response rather than patient lung pathology.
> 5. **Mathematical Impossibility of 8-Class Stratification:** ICBHI exhibits catastrophic class imbalance: COPD represents >70% of the dataset, while Asthma had only 1 patient and LRTI had only 2. In a 3-way patient-disjoint split, these minority classes could not populate all partitions, causing catastrophic cross-entropy divergence.
>
> Everything we have built since was designed to eliminate each of these failure modes."

---

## Slide 3: Acoustic Signal Processing & Preprocessing Overhaul

* **Visuals on Slide:** 
  - Audio Processing Architecture:
    $$\text{Raw Audio (22.05 kHz)} \xrightarrow{\text{Butterworth 100-2000 Hz}} y[n] \xrightarrow{\text{STFT + Mel Filterbank}} \text{MFCC (40)} \xrightarrow{\Delta, \Delta^2} \mathbf{F}_t \in \mathbb{R}^{120} \xrightarrow{\text{CMVN}} \hat{\mathbf{F}}_t \xrightarrow{\text{Sliding Window}} (200, 120)$$
  - Graphs: Frequency response showing suppression below 100 Hz and above 2000 Hz; sliding window coverage showing 100% temporal capture.
* **Estimated Time:** 1:30 min

> **[SPEAKER SCRIPT]:**  
> "To make our evidence sound, we completely overhauled the acoustic preprocessing pipeline in `backend/preprocessing.py`:
>
> - **4th-Order Butterworth Bandpass Filter:** Raw stethoscope audio is heavily corrupted by low-frequency chest wall friction and heartbeat thuds below 100 Hz, as well as electronic sensor hiss above 2000 Hz. We apply a zero-phase 4th-order Butterworth bandpass filter using second-order sections (`sosfiltfilt`) strictly between **100 Hz and 2000 Hz**, perfectly isolating the acoustic bandwidth of adventitious breath sounds.
> - **120-Dimensional Acoustic Dynamics:** Rather than using 40 static MFCCs, we compute **40 static MFCCs + 40 first-order velocity deltas ($\Delta$) + 40 second-order acceleration deltas ($\Delta^2$)**. The dynamic deltas capture the rapid temporal onset of discontinuous crackles (<20 ms) and sustained frequency trajectories of wheezes.
> - **Hardware Invariance via CMVN:** We apply **Cepstral Mean and Variance Normalization** across each feature window. By centering features to zero mean and unit variance, we eliminate stethoscope hardware transfer function bias, making inference invariant to microphone brands.
> - **Non-Destructive Sliding Windows:** Feature sequences are partitioned into windows of 200 frames (~4.6 seconds) with a 50% hop (100 frames). The final window is anchored to the exact end of the audio file, guaranteeing 100% temporal coverage without discarding any breath cycles."

---

## Slide 4: Deep Neural Network Architecture — RespiNet-Attention v3

* **Visuals on Slide:** 
  - Layer architecture (458,701 parameters, ≈1.75 MB):
    - Input: `(None, 200, 120)` — 200 frames × (40 MFCC + 40 Δ + 40 Δ²)
    - Custom layer `FeatureValidityMask` → `(None, 200)` boolean mask of real (non-padded) frames
    - `LayerNormalization`
    - `MultiScaleConvBlock`: parallel Conv1D k = 3 / 5 / 11 (32 channels each, GELU) → squeeze-excitation → `SpatialDropout1D(0.2)` → 96 channels
    - `Bidirectional GRU (128 units)` + GELU + Dropout 0.3 → 256 channels
    - *Residual skip:* pointwise `Conv1D(256, k=1)` + LayerNorm from the conv block, added before GRU-2
    - `Bidirectional GRU (64 units)` + GELU → 128 channels
    - Custom layer `MaskedDualTemporalPooling1D` (attention pooling ‖ masked max-pooling → 256)
    - `Dense 128` + GELU + Dropout 0.3 → `Dense 64` + GELU + Dropout 0.4 → `Dense 5, softmax`; L2 = 1e-4 throughout
* **Estimated Time:** 1:30 min

> **[SPEAKER SCRIPT]:**  
> "Here is our RespiNet-Attention v3 sequence architecture:
>
> 1. **Zero-padding validity masking:** a custom Keras layer, `FeatureValidityMask`, marks real frames. The mask is passed into both recurrent layers and into the pooling layer, so zero padding never influences the hidden state or the pooled summary.
> 2. **Multi-scale convolution:** three parallel convolutions with kernel sizes 3, 5 and 11 look at short crackle-like events and longer wheeze-like patterns at the same time. A squeeze-excitation step re-weights the channels, and `SpatialDropout1D` drops whole channels to prevent co-adaptation.
> 3. **Recurrent stack with a residual path:** two bidirectional GRUs (128 and 64 units) model the time course. A 1×1 convolution carries the convolutional features around the first GRU, so fine spectral texture is not lost.
> 4. **Dual temporal pooling:** attention pooling summarizes sustained sounds; masked max-pooling keeps the strongest short transient.
> 5. **Compact:** about 459K parameters and 1.75 MB of weights."

---

## Slide 5: Training Pipeline, Loss Function & Memory Engineering

* **Visuals on Slide:** 
  - Mathematical Formulations:
    - Categorical Focal Loss: $\mathcal{L}_{\text{Focal}} = -\sum_{k=1}^K \alpha_k y_k^{\text{smooth}} (1 - p_k)^\gamma \log(p_k + \delta)$, $\gamma=2.0$
    - Label Smoothing: $y_k^{\text{smooth}} = (1-\epsilon)y_k + \frac{\epsilon}{K}$, $\epsilon=0.1$
    - Cosine Decay: $\eta_t = \eta_{\min} + \frac{1}{2}(\eta_0 - \eta_{\min})(1 + \cos(\frac{t}{T}\pi))$
  - Memory Diagram:
    - *Legacy In-Memory Pipeline:* 60,000 NumPy arrays in Python list $\rightarrow$ **26 GB RAM spike $\rightarrow$ Linux OOM Killer**
    - *RespiNet v3.1 Streaming:* Chunked pre-allocation + `tf.data.Dataset` + Vectorized Online SpecAugment $\rightarrow$ **Peak RAM < 4.8 GB (80% reduction)**
* **Estimated Time:** 1:45 min

> **[SPEAKER SCRIPT]:**  
> "The backend training engine underwent three fundamental breakthroughs:
>
> **1. Loss Function Optimization:**  
> Standard cross-entropy fails on clinical audio because common conditions like COPD overwhelm gradients. We implemented **`CategoricalFocalLoss`** with a focusing parameter $\gamma=2.0$. This mathematically suppresses the loss contribution of well-classified majority samples to near zero, forcing gradient updates to focus on hard, borderline minority examples. We paired this with **Label Smoothing ($\epsilon=0.1$)**, which prevents logit saturation and eliminates validation loss spikes.
>
> **2. Learning Rate & Early Stopping Correction:**  
> We adopted an Adamax optimizer governed by a smooth **Cosine Annealing decay schedule** from $\eta_0 = 3\times10^{-4}$ down to $\eta_{\min} = 1.5\times10^{-6}$. We also resolved an early stopping pitfall: previously, early stopping monitored validation loss, which oscillated as focal loss re-weighted hard samples even while accuracy climbed. We redirected early stopping and checkpoints to monitor `val_accuracy` directly with an 18-epoch patience window.
>
> **3. Solving the 26 GB Out-Of-Memory (OOM) Bottleneck:**  
> When scaling up data, our offline augmentation pipeline exploded: 5 waveform variants $\times$ sliding windows $\times$ 2x offline SpecAugment created over 60,000 NumPy arrays, spiking RAM past 25 GB and triggering the Linux OOM killer.  
> In RespiNet v3.1, we resolved this by building a **chunked pre-allocation pipeline coupled with a streaming `tf.data.Dataset`**. SpecAugment frequency and time masking are now computed **vectorized and on-the-fly per batch**. This slashed peak memory by **80% down to under 4.8 GB**, eliminated all memory drift, and provides infinite stochastic variations across training epochs."

---

## Slide 6: Dataset Audit — Finding and Removing Hidden Duplicates

* **Visuals on Slide:** 
  - Datasets: ICBHI 2017 (920 recordings, 126 patients, authentic diagnoses) + Kaggle Asthma Detection V2 (1,211 clips)
  - **Audit finding:** 631 of 1,211 Kaggle clips (52%) are verbatim cuts of ICBHI recordings — 100% of Kaggle COPD, 56% healthy, 49% bronchial, 37% pneumonia, 0% asthma — taken from 60 ICBHI patients (match scores ≥ 0.795 vs ≤ 0.697 for all other clips)
  - Kaggle `P`-numbers are not patient IDs (35 of 98 groups mix several ICBHI patients); 3 clips labeled pneumonia come from a Healthy ICBHI patient; 12 byte-identical duplicates
  - **Corrected cohort:** 1,488 recordings / 243 patients (ICBHI 920 / 126 + Kaggle remainder 568); patient-disjoint split 145 / 49 / 49
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "Merging ICBHI with the Kaggle Asthma V2 dataset looked like an easy way to fix ICBHI's extreme class imbalance. But when we audited the merged data, we found that more than half of the Kaggle clips — including every single COPD clip — are cut directly out of ICBHI recordings that were already in our cohort.
>
> Because the two copies carried different patient IDs, a test patient's recording could also appear, cut into segments, in the training set. That is data leakage, and it inflated our earlier results.
>
> We built a cross-correlation matcher that locates every Kaggle clip inside every ICBHI recording. The separation was clean: true copies score above 0.79, everything else below 0.70. We now drop the copies — keeping the full ICBHI recordings with their real patient IDs and authentic diagnoses — and the pipeline refuses to merge the datasets without this evidence file. The corrected cohort has 1,488 recordings from 243 patients."

---

## Slide 7: Leakage-Free Results, Calibration & Deployment

* **Visuals on Slide:** 
  - Held-out test set: 49 patients / 296 recordings
  - Served model: **RespiNet + pretrained YAMNet embeddings, late fusion**, chosen by patient-grouped cross-validation (+4.6 points balanced accuracy, P = 0.97) before the test set was used
  - **Patient-level accuracy 77.6%** (95% bootstrap CI 65–90%), balanced accuracy 76.2%, macro-F1 0.76, macro AUROC 0.95; **recording-level accuracy 84.5%**
  - Leakage removal (RespiNet alone): 82.1% → 75.5% patient-level; adding YAMNet: 75.5% → 77.6% patient-level, 77.4% → 84.5% recording-level
  - Patient-level sensitivity: Asthma 91.7%, COPD 76.9%, Bronchial 75.0%, Pneumonia 75.0%, Healthy 62.5%
  - By source: ICBHI patients 65.4% (few non-COPD cases); Kaggle groups 91.3% (identities unverified)
  - Calibration: temperature scaling (fused T = 0.67), ECE 0.031 (recording level); abstention when the score is < 0.65 or the entropy is high
  - Deployment: fail-closed SHA-256 artifact contract, Flask API, React 19 UI with live microphone meter, time-only gradient saliency, consented LLM summaries
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "Our earlier figure was 82%. Retraining the identical model on the corrected data dropped it to 75.5%. We report the lower number because it is the honest one: the difference was leakage, not skill.
>
> We then looked for real improvements without overfitting our small test set. We compared six variants by cross-validation on the training patients only, with a decision rule fixed in advance. Only one passed: averaging RespiNet with a classifier over embeddings from YAMNet, a model Google pretrained on general sounds. The two make different mistakes, so together they do better.
>
> On the 49 held-out patients, the combined model reaches **77.6% patient-level accuracy**, with a bootstrap confidence interval of 65 to 90 percent, **76.2% balanced accuracy**, and **84.5% accuracy per recording**. At patient level that is one more patient than before, so the cross-validation, not the test set, is our evidence that the gain is real.
>
> Asthma is recognized best, at 92% patient sensitivity; healthy is now the hardest, at 63%. On ICBHI patients alone accuracy is 65%, and on the Kaggle subset it is 91%. We treat the Kaggle figure as optimistic, because that dataset has no reliable patient identifiers.
>
> Scores are temperature-calibrated on validation data, and the server abstains — returning 'uncertain' — when confidence is low or entropy is high. It refuses to serve any model whose hash, class order, preprocessing and evaluation records don't verify."

---

## Slide 8: Summary & Future Research Roadmap

* **Visuals on Slide:** 
  - Summary milestones: patient- *and audio*-disjoint pipeline, cross-dataset leakage found and removed, 77.6% leakage-free patient-level accuracy (84.5% per recording) with a cross-validated YAMNet fusion, calibrated scores with abstention, fail-closed serving, OOM-free streaming
  - Research roadmap:
    1. *External validation on an independent dataset (e.g. SPRSound, HF_Lung) and an overlap check against KAUH*
    2. *Respiratory-specific audio foundation models (OPERA, HeAR) and fine-tuning, beyond the frozen YAMNet used now*
    3. *Log-Mel tensors and wavelet features for short crackles*
    4. *Multimodal fusion (acoustics + vitals) and INT8 edge deployment*
* **Estimated Time:** 0:45 min

> **[SPEAKER SCRIPT]:**  
> "RespiNet is now a research prototype whose numbers we can stand behind: every test patient's audio is genuinely unseen, every result is traceable to a hashed artifact, and the server refuses to run unverified models. It is not clinically validated.
>
> **Next steps:**
> 1. Validate on an independent external dataset, and check the remaining Kaggle data against its KAUH source.
> 2. Go beyond the frozen YAMNet model: try respiratory-specific foundation models such as OPERA or HeAR, and fine-tuning.
> 3. Improve short-event features with Log-Mel tensors and wavelet transforms.
> 4. Explore multimodal fusion with patient vitals, and quantized edge deployment.
>
> Thank you, and I look forward to your questions."

---

## 📋 Speaker Reference & Metric Quick-Card

| Metric / Dimension | Earlier merged model (2026-08-14, leakage) | Leakage-free RespiNet (archived) | **Current: RespiNet + YAMNet fusion (2026-10-22)** |
| :--- | :--- | :--- | :--- |
| **Test accuracy (patient / recording)** | 82.09% / 80.81% (inflated, do not cite) | 75.51% / 77.36% | **77.55% / 84.46%** (95% CI 65.3–89.8%) |
| **Balanced accuracy (patient)** | 79.65% | 73.72% | **76.22%** |
| **Macro F1 (patient)** | 0.7922 | 0.7374 | **0.7627** |
| **Macro AUROC (patient)** | 0.967 | 0.932 | **0.953** |
| **ECE (recording)** | 0.033 (T = 0.844) | 0.074 (T = 0.713) | **0.031 (fused T = 0.674)** |
| **Dataset** | 2,131 files / 331 "patients" (631 duplicated ICBHI clips) | 1,488 files / 243 patients, audio-disjoint | same |
| **Test patients** | 67 | 49 | 49 |
| **Architecture** | RespiNet-Attention v3, 458,701 params | same | RespiNet + frozen YAMNet → logistic head, 50/50 late fusion |
| **Features** | 40 MFCC + Δ + Δ² (120 dims), CMVN, 200-frame windows | same | same for RespiNet; YAMNet uses 16 kHz audio (mean + std of 1,024-d embeddings) |
| **Loss / optimizer** | Focal loss (γ = 2) + label smoothing 0.1; Adamax 3e-4 + cosine decay | same | same for RespiNet; YAMNet head: balanced logistic regression (C = 0.01) |
| **Peak training RAM** | < 4.8 GB (chunked extraction + `tf.data` streaming) | same | same |
