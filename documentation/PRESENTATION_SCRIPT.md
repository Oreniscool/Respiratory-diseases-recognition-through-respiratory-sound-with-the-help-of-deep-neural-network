# RespiNet / Respiratory Atlas: Progress & Technical Evolution Presentation Script

**Target Duration:** ~8–10 Minutes  
**Audience:** Technical Reviewers, Academic Committee, and Clinical Engineering Stakeholders  
**Scope:** Progress, Backend Refactoring, Architecture Evolution, and Empirical Verification since the baseline prototype.

---

## Slide 1: Title & Clinical Use Case

* **Visuals on Slide:** 
  - Project Title: **RespiNet (Respiratory Atlas)**
  - Subtitle: *Deep Learning-Assisted Computer-Aided Auscultation (CAA) for Multi-Class Respiratory Disease Screening*
  - Pipeline Diagram: Digital Stethoscope Audio $\rightarrow$ Butterworth Bandpass (100–2000 Hz) $\rightarrow$ 120-dim $\text{MFCC}+\Delta+\Delta^2$ $\rightarrow$ Deep Sequence Model $\rightarrow$ Calibrated 5-Class Prediction + Grad-CAM Saliency Map + LLM Clinical Draft.
* **Estimated Time:** 1:00 min

> **[SPEAKER SCRIPT]:**  
> "Good morning, everyone. Today, I am presenting the latest technical evolution of **RespiNet**, also known as **Respiratory Atlas**—an AI-assisted computer-aided auscultation and clinical decision support system.
>
> For over two centuries, the acoustic stethoscope has served as the frontline instrument for pulmonary evaluation. However, conventional auscultation is constrained by high inter-observer variability, subjective human auditory perception, acoustic environmental noise, and a severe shortage of experienced pulmonologists in primary healthcare settings.
>
> **The Use Case of RespiNet:**  
> RespiNet addresses these limitations by providing an objective, reproducible, and scalable screening engine. The system analyzes auscultation recordings, removes non-pulmonary noise, extracts dynamic time-frequency spectral features, and classifies patient acoustics across **five major clinical categories: COPD, Asthma, Pneumonia, Bronchial conditions, and Healthy controls**.
>
> Crucially, RespiNet is not a black box: it incorporates **post-hoc probability calibration** with a selective abstention policy for ambiguous cases, as well as **visual Grad-CAM spectrogram saliency maps** so that clinicians can verify exactly which acoustic transients drove the prediction."

---

## Slide 2: The Baseline & The "Run 1241" Benchmark Crisis

* **Visuals on Slide:** 
  - Split Comparison Box:
    - *Legacy Claims:* 85–95% reported accuracy (unverified legacy `.h5`).
    - *SPIT HPC GPU Cluster Audit (Run 1241):* Validation Accuracy: **11.90%**, Validation Loss: **6.8942**, Early Stopped at Epoch 11.
  - Failure Diagnostic Tags: *Patient Data Leakage*, *Unmasked Zero-Padding*, *Naive 4.6s Truncation*, *Hardware Confounding*, *Single-Patient Partition Failure*.
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "At our previous presentation, the project relied on a legacy prototype trained on the ICBHI 2017 dataset, which historically reported accuracies between 85% and 95%. However, when we subjected that pipeline to a rigorous, fail-closed engineering audit on our HPC GPU cluster, the model suffered an immediate breakdown in **Run 1241**: validation accuracy collapsed to **11.90%**—essentially worse than random guessing—and validation loss exploded to **6.89**.
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
> "To establish clinical validity, we completely overhauled the acoustic preprocessing pipeline in `backend/preprocessing.py`:
>
> - **4th-Order Butterworth Bandpass Filter:** Raw stethoscope audio is heavily corrupted by low-frequency chest wall friction and heartbeat thuds below 100 Hz, as well as electronic sensor hiss above 2000 Hz. We apply a zero-phase 4th-order Butterworth bandpass filter using second-order sections (`sosfiltfilt`) strictly between **100 Hz and 2000 Hz**, perfectly isolating the acoustic bandwidth of adventitious breath sounds.
> - **120-Dimensional Acoustic Dynamics:** Rather than using 40 static MFCCs, we compute **40 static MFCCs + 40 first-order velocity deltas ($\Delta$) + 40 second-order acceleration deltas ($\Delta^2$)**. The dynamic deltas capture the rapid temporal onset of discontinuous crackles (<20 ms) and sustained frequency trajectories of wheezes.
> - **Hardware Invariance via CMVN:** We apply **Cepstral Mean and Variance Normalization** across each feature window. By centering features to zero mean and unit variance, we eliminate stethoscope hardware transfer function bias, making inference invariant to microphone brands.
> - **Non-Destructive Sliding Windows:** Feature sequences are partitioned into windows of 200 frames (~4.6 seconds) with a 50% hop (100 frames). The final window is anchored to the exact end of the audio file, guaranteeing 100% temporal coverage without discarding any breath cycles."

---

## Slide 4: Deep Neural Network Architecture — RespiNet Sequence Model

* **Visuals on Slide:** 
  - Detailed Layer Architecture:
    - Input: `(None, 200, 120)`
    - Custom Layer: `FeatureValidityMask` $\rightarrow$ `(None, 200)`
    - `LayerNormalization`
    - `Conv1D (64 filters, k=5) + LeakyReLU + SpatialDropout1D(0.2) + L2(1e-4)`
    - `Conv1D (64 filters, k=3) + LeakyReLU + SpatialDropout1D(0.2) + L2(1e-4)`
    - `Bidirectional GRU (128 units, recurrent_dropout=0.15, dropout=0.4)`
    - *Residual Skip Connection:* Pointwise `Conv1D(256, k=1)` from Conv Block to GRU-2
    - `Bidirectional GRU (64 units, recurrent_dropout=0.15)`
    - Custom Layer: `MaskedDualTemporalPooling1D` (Attentive Pooling + Max-Pooling $\rightarrow$ 256 dims)
    - `Dense (64 units) + LeakyReLU + Dropout(0.5) + L2(1e-4)`
    - `Dense (5 units, Softmax)`
* **Estimated Time:** 1:30 min

> **[SPEAKER SCRIPT]:**  
> "Here is our modernized **RespiNet sequence architecture**, specifically engineered to eliminate overfitting on biomedical audio:
>
> 1. **Zero-Padding Validity Masking:** A custom Keras layer, `FeatureValidityMask`, detects non-zero frames. This mask propagates through the recurrent layers and into our custom `MaskedDualTemporalPooling1D` layer, ensuring zero-padded frames contribute zero weight to internal states or gradients.
> 2. **Channel-Independent Feature Extraction:** In our convolutional layers, we replaced standard dropout with **`SpatialDropout1D(0.2)`**. This drops entire feature channels across time, preventing adjacent Mel-frequency bands from co-adapting.
> 3. **Recurrent Stack & Recurrent Dropout:** We employ two stacked Bidirectional GRU layers (128 and 64 units). Crucially, we introduced **`recurrent_dropout=0.15`** directly into the hidden recurrent transitions, preventing the network from memorizing exact temporal sequences of training files.
> 4. **Residual Spectral Skip & Dual Temporal Pooling:** We incorporated a pointwise $1\times 1$ convolution skip connection from the convolutional block directly to the second GRU, preserving high-frequency acoustic texture. For sequence aggregation, our dual temporal pooling combines soft attentive pooling—which captures continuous wheezes—with masked max-pooling, which preserves explosive crackle transients.
> 5. **Regularization & Compact Footprint:** Uniform $L_2$ kernel weight regularization ($10^{-4}$) and 0.5 dense dropout keep the entire architecture at approximately 442K parameters—requiring only ~1.7 MB of storage, making it fully edge-deployable."

---

## Slide 5: Training Pipeline, Loss Function & Memory Engineering

* **Visuals on Slide:** 
  - Mathematical Formulations:
    - Categorical Focal Loss: $\mathcal{L}_{\text{Focal}} = -\sum_{k=1}^K \alpha_k y_k^{\text{smooth}} (1 - p_k)^\gamma \log(p_k + \delta)$, $\gamma=2.0$
    - Label Smoothing: $y_k^{\text{smooth}} = (1-\epsilon)y_k + \frac{\epsilon}{K}$, $\epsilon=0.08$
    - Cosine Decay: $\eta_t = \eta_{\min} + \frac{1}{2}(\eta_0 - \eta_{\min})(1 + \cos(\frac{t}{T}\pi))$
  - Memory Diagram:
    - *Legacy In-Memory Pipeline:* 60,000 NumPy arrays in Python list $\rightarrow$ **26 GB RAM spike $\rightarrow$ Linux OOM Killer**
    - *RespiNet v3.1 Streaming:* Chunked pre-allocation + `tf.data.Dataset` + Vectorized Online SpecAugment $\rightarrow$ **Peak RAM < 4.8 GB (80% reduction)**
* **Estimated Time:** 1:45 min

> **[SPEAKER SCRIPT]:**  
> "The backend training engine underwent three fundamental breakthroughs:
>
> **1. Loss Function Optimization:**  
> Standard cross-entropy fails on clinical audio because common conditions like COPD overwhelm gradients. We implemented **`CategoricalFocalLoss`** with a focusing parameter $\gamma=2.0$. This mathematically suppresses the loss contribution of well-classified majority samples to near zero, forcing gradient updates to focus on hard, borderline minority examples. We paired this with **Label Smoothing ($\epsilon=0.08$)**, which prevents logit saturation and eliminates validation loss spikes.
>
> **2. Learning Rate & Early Stopping Correction:**  
> We adopted an Adamax optimizer governed by a smooth **Cosine Annealing decay schedule** down to $\eta_{\min}=10^{-5}$. We also resolved an early stopping pitfall: previously, early stopping monitored validation loss, which oscillated as focal loss re-weighted hard samples even while accuracy climbed. We redirected early stopping and checkpoints to monitor `val_accuracy` directly with an 18-epoch patience window.
>
> **3. Solving the 26 GB Out-Of-Memory (OOM) Bottleneck:**  
> When scaling up data, our offline augmentation pipeline exploded: 5 waveform variants $\times$ sliding windows $\times$ 2x offline SpecAugment created over 60,000 NumPy arrays, spiking RAM past 25 GB and triggering the Linux OOM killer.  
> In RespiNet v3.1, we resolved this by building a **chunked pre-allocation pipeline coupled with a streaming `tf.data.Dataset`**. SpecAugment frequency and time masking are now computed **vectorized and on-the-fly per batch**. This slashed peak memory by **80% down to under 4.8 GB**, eliminated all memory drift, and provides infinite stochastic variations across training epochs."

---

## Slide 6: Dataset Transformation & Authentic Diagnosis Audit

* **Visuals on Slide:** 
  - Multi-Cohort Dataset Table:
    - Primary: Kaggle Asthma Detection V2 (1,211 recordings)
    - Merged: ICBHI 2017 with Authentic Clinical Labels (920 recordings)
    - **Total Merged Cohort: 2,131 recordings from 331 unique patients**
  - Unified 5-Class Target Distribution:
    - COPD: 1,194 recordings
    - Pneumonia: 322 recordings
    - Asthma: 289 recordings
    - Healthy: 168 recordings
    - Bronchial: 158 recordings
  - Stratified Patient-Disjoint Splits: Train (198 pts, 1,248 recs), Val (66 pts, 440 recs), Test (67 pts, 443 recs).
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "To guarantee real-world generalization across different clinics and recording devices, we executed a major dataset transformation:
>
> First, we transitioned primary training from the skewed ICBHI dataset to the **Kaggle Asthma Detection Dataset (Version 2)**, which provides balanced multi-class folders.
>
> Next, to triple our training scale, we built an ingestion pipeline to merge the ICBHI dataset into our target space. During this work, our audit discovered that an old diagnosis CSV file in the repository contained scrambled labels designed for testing that was corrupting ICBHI labels. We sourced and verified the **authentic, peer-reviewed clinical diagnosis mappings** (`patient_diagnosis_authentic.csv`), re-sorted the files, and unified the taxonomy into a balanced 5-class target: *COPD, Asthma, Pneumonia, Bronchial, and Healthy*.
>
> Using deterministic SHA-256 patient hashing, we partitioned the combined cohort of **2,131 recordings from 331 unique patients** into strict patient-disjoint splits: 198 patients for training, 66 for validation, and 67 for held-out testing, ensuring zero patient overlap."

---

## Slide 7: Quantitative Results, Calibration & Clinical Deployment

* **Visuals on Slide:** 
  - Metric Progression Table:
    - Val Accuracy: 11.9% (Baseline) $\rightarrow$ **80.81% (Recording) / 82.09% (Patient)**
    - Expected Calibration Error (ECE): 48.2% $\rightarrow$ **3.33%** (via Temperature Scaling $T \approx 1.54$)
    - Validation Loss: 6.8942 $\rightarrow$ **0.1103**
  - Patient Sensitivity: COPD: **91.3%**, Asthma: **83.3%**, Pneumonia: **100.0%**, Bronchial: **60.0%**, Healthy: **63.6%**.
  - Deployment Features: SHA-256 Artifact Contract, Flask REST API (port 5001), React 19 Frontend with real-time mic VU meter, Grad-CAM Saliency heatmaps, and Gemini clinical draft reporting.
* **Estimated Time:** 1:15 min

> **[SPEAKER SCRIPT]:**  
> "The quantitative results confirm the success of this architectural and training overhaul:
>
> - **Accuracy & Generalization:** On completely held-out, unseen test patients, RespiNet achieves **80.81% recording-level accuracy** and **82.09% patient-level accuracy**, with a Macro F1 score of **79.22%** and Balanced Accuracy of **79.65%**.
> - **Clinical Sensitivity:** On the patient level, the model achieved **91.3% sensitivity for COPD**, **83.3% for Asthma**, and **100% sensitivity for Pneumonia**.
> - **Post-Hoc Probability Calibration:** Standard deep neural networks are notoriously overconfident. By fitting a post-hoc **Temperature Scaling parameter ($T \approx 1.54$)** on held-out validation logits, we lowered the Expected Calibration Error (ECE) from 48.2% down to **3.33%**.
> - **Selective Abstention:** The inference engine computes prediction entropy. If an ambiguous or corrupted audio sample produces entropy above our safety threshold, the system flags the result as uncertain and requests clinical re-assessment.
> - **Production Deployment:** Model artifacts are cryptographically verified via SHA-256 checksums and served via a Flask REST API on port 5001. The React 19 frontend provides real-time microphone input with a live VU meter, audio drag-and-drop, interactive Grad-CAM spectrogram attribution, and privacy-sanitized Gemini clinical draft summaries."*

---

## Slide 8: Summary & Future Research Roadmap

* **Visuals on Slide:** 
  - Summary Milestones: Verified patient-disjoint pipeline, 80%+ test accuracy, 3.3% ECE, OOM-free streaming, production full-stack deployment.
  - Research Roadmap:
    1. *Log-Mel Spectrogram Tensors & Continuous Wavelet Transforms (CWT)*
    2. *Self-Supervised Audio Foundation Models (Audio Spectrogram Transformer - AST / BEATs)*
    3. *Multimodal Fusion (Acoustics + Patient Vitals: $\text{SpO}_2$, Temperature, Smoking History)*
    4. *Edge Deployment via INT8 Quantization (TFLite on ARM Cortex-M / Raspberry Pi)*
* **Estimated Time:** 0:45 min

> **[SPEAKER SCRIPT]:**  
> "In conclusion, RespiNet has transitioned from an uncalibrated, overfitted prototype into a hardened, auditable, and clinically calibrated computer-aided auscultation platform with verified multi-patient generalizability.
>
> **Our next research milestones are:**
> 1. Upgrading acoustic representations to **Log-Mel spectrogram tensors and Continuous Wavelet Transforms (CWT)** to further isolate sub-20ms crackles.
> 2. Fine-tuning self-supervised foundation backbones such as the **Audio Spectrogram Transformer (AST)** and **wav2vec 2.0**.
> 3. Performing **multimodal clinical fusion**, combining acoustic features with electronic health records and patient vitals.
> 4. Exporting **INT8 quantized models** to enable low-latency inference on low-cost digital stethoscopes in rural and underserved clinics.
>
> Thank you, and I look forward to your questions."*

---

## 📋 Speaker Reference & Metric Quick-Card

| Metric / Dimension | Baseline Prototype (Run 1241) | Current RespiNet Merged Cohort |
| :--- | :--- | :--- |
| **Validation / Test Accuracy** | 11.90% (Random guess failure) | **80.81% (Recording) / 82.09% (Patient)** |
| **Validation Loss** | 6.8942 (Loss explosion) | **0.1103 (Smooth convergence)** |
| **Macro F1 Score** | 0.084 | **0.7922 (Patient-level)** |
| **Expected Calibration Error (ECE)** | 48.2% (Severely overconfident) | **3.33% (Calibrated via $T \approx 1.54$)** |
| **Dataset Scale** | 126 patients, 920 files (ICBHI only) | **331 patients, 2,131 files (Kaggle V2 + ICBHI)** |
| **Feature Dimensions** | 40 static MFCCs | **120 dims (40 MFCC + 40 $\Delta$ + 40 $\Delta^2$ + CMVN)** |
| **Peak Training Feature RAM** | ~26 GB (Linux OOM crash) | **< 4.8 GB (Chunked pre-alloc + `tf.data` streaming)** |
| **Loss Function** | Categorical Cross-Entropy | **Categorical Focal Loss ($\gamma=2.0$) + Label Smoothing** |
