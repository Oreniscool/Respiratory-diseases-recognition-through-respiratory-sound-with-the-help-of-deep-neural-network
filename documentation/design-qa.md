# RespiNet Design QA & Visual Audit

**Status:** Completed  
**Canonical frontend:** `frontend`  
**Design System Target:** Respiratory Atlas  

---

## 1. Visual Token Audit

| Category | Token / Element | Standard | Result | Notes |
|---|---|---|:---:|---|
| **Color** | Canvas background | `#fffdf7` warm-ivory canvas | PASS | Applied to root body and containers |
| | Muted canvas | `#f2f0e8` secondary backgrounds | PASS | Used for method panels, status cards, and alerts |
| | Surface | `#ffffff` focused cards & inputs | PASS | Used for active recording panel and forms |
| | Ink / Ink muted | `#17211e` / `#58625e` | PASS | High contrast text (WCAG AA compliant) |
| | Accent (Indigo) | `#2f477d` primary buttons & nav | PASS | Clear focus ring and active state styling |
| | Warning / Caution | `#b6533b` terracotta / `#9a6b16` amber | PASS | Explicit research disclaimers & uncalibrated score notices |
| **Typography** | Headlines | Serif (`Source Serif 4` fallback stack) | PASS | Warm editorial headers for page titles and sections |
| | Interface | Sans-serif (`Source Sans 3` fallback stack) | PASS | High legibility at 16px base size |
| | Technical data | Monospace (`IBM Plex Mono` fallback stack) | PASS | Audio sample rates, file sizes, and raw values |
| **Spacing & Radius** | Spacing scale | 4px base (8, 12, 16, 24, 32, 48px) | PASS | Clean fluid grids and consistent margins |
| | Corner radius | 4px controls, 8px cards, 999px status pills | PASS | Follows design spec strictly |
| **Motion** | Transitions | 90–240ms duration | PASS | No ambient glow, tilt, shimmer, or autoplay audio |
| | Motion reduction | `prefers-reduced-motion: reduce` support | PASS | Transitions disabled when requested by user |
| **Accessibility** | Focus indicator | 2px indigo outline with offset | PASS | Distinct keyboard focus indicator |
| | Text contrast | Minimum 4.5:1 ratio | PASS | Tested across light/dark text elements |

---

## 2. Navigation & Routing Verification

| Route | View Component | Status | Notes |
|---|---|:---:|---|
| `/` | `AnalyzePage` | PASS | Primary recording upload, sample, record & analysis workspace |
| `/evidence` | `EvidencePage` | PASS | Model methodology, ICBHI dataset facts, responsible use guidelines |
| `/learn` | `LearnPage` | PASS | Searchable 8-disease reference guide & glossary |
| `/report` | `ReportPage` | PASS | Generated research summary view with print & text download |
| `/explainability` | `ExplainabilityPage` | PASS | Experimental saliency, spectrogram & attribution view |
| `/diagnose` | Redirect to `/` | PASS | Legacy route preserved with clean redirect |
| `/diseases` | Redirect to `/learn` | PASS | Legacy route preserved with clean redirect |
| `/chat` | Redirect to `/learn` | PASS | Legacy route preserved with clean redirect |
| `/how-it-works` | Redirect to `/evidence` | PASS | Legacy route preserved with clean redirect |
| `/metrics` | Redirect to `/evidence` | PASS | Legacy route preserved with clean redirect |

---

## 3. Core Functional Flows Audit

1. **Upload & Sample Intake:**
   - Supports Drag and Drop + standard file picker.
   - Restricts file types to WAV, MP3, WebM, OGG, M4A up to 20MB.
   - ICBHI dataset samples (COPD, Pneumonia, Bronchiectasis, etc.) load seamlessly.
   - Microphone recording works using Browser MediaRecorder with 30s auto-stop safety limit.

2. **Inference & Prediction Output:**
   - Integrates directly with Python `server.py` inference endpoints (`/health`, `/predict`, `/predict-sample/<disease>`).
   - Surfaces model predictions with explicit uncalibrated model scores (%) and direct horizontal distribution bars.
   - Features clear disclaimer: *"Research prototype — not a diagnostic device"*.

3. **Report Generation & Export:**
   - Opt-in consent required for external LLM summary generation.
   - Text file export and formatted print options work cleanly.

4. **Explainability & Attribution:**
   - Real spectrogram, time sensitivity, and overlay rendering from `/explain` endpoint.
   - Explicit warnings clarifying that attention is not clinical cause or diagnostic proof.

---

## 4. Final Handoff Decision

- **All P0 / P1 / P2 issues resolved.**
- **Codebase clean & refactored:** Obsolete legacy code files removed.

**Final Result:** `passed`
