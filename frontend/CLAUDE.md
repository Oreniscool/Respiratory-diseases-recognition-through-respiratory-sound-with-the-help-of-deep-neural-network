# frontend/CLAUDE.md — Respiratory Atlas web UI

Loaded when working inside `frontend/`. Read the root [`../CLAUDE.md`](../CLAUDE.md) first.
Verified against source on 2026-10-21.

The design spec is [`../documentation/design.md`](../documentation/design.md) (tokens, type,
motion, accessibility, content rules). The visual QA record is
[`../documentation/design-qa.md`](../documentation/design-qa.md). Its route table predates the
landing page (it still lists `/` → AnalyzePage).

---

## 1. Stack & scripts

React 19 · react-router-dom 7 · Vite 6 · TypeScript 5.7 (`tsc -b`) · Zustand 5 · Recharts 2.15
· framer-motion 11 · lucide-react · canvas-confetti · react-intersection-observer. Tailwind 4
and `@tailwindcss/vite` are in devDependencies but **not enabled** in `vite.config.ts`. Styling
is hand-written CSS in `src/styles/globals.css` (~1.7k lines) and `src/pages/LandingPage.css`.

```bash
npm ci
npm run dev        # Vite on :5173 (scripts call node node_modules/vite/bin/vite.js directly)
npm run typecheck  # tsc -b
npm run build      # tsc -b && vite build → dist/
npm run preview
```

**`dist/` is committed to git** (22 hashed asset files). After changing `src/`, run
`npm run build` and commit the regenerated `dist/`, or the checked-in build will stay stale.
`tsconfig.tsbuildinfo` is also tracked.

---

## 2. Routes (`src/App.tsx`)

All pages are `React.lazy` and wrapped in `<Suspense>` and an `AnimatePresence` page fade.
The `Navbar` is hidden on `/`.

| Path | Page | Purpose |
|---|---|---|
| `/` | `LandingPage` | marketing/overview: animated demo waveform, stat counters, pipeline stage strip, CTA → `/analyze` |
| `/analyze` | `AnalyzePage` | main workflow: upload / record / sample → analyze → results → report consent |
| `/evidence` | `EvidencePage` | method, ICBHI facts, benchmark caveats, responsible use |
| `/learn` | `LearnPage` | searchable reference (`data/referenceContent.ts`) + glossary |
| `/report` | `ReportPage` | LLM summary view, print, `.txt` download (needs `report` in the store) |
| `/explainability` | `ExplainabilityPage` | calls `/explain` for the stored analysis (needs `analysis.audioFile`) |
| `/diagnose` → `/analyze`, `/diseases` `/chat` → `/learn`, `/how-it-works` `/metrics` → `/evidence`, `*` → `/` | redirects | legacy URLs |

Navbar links: Analyze, Evidence library, Learn (+ utility links `/learn#glossary`, `/evidence#about`).

---

## 3. Data flow & state

- **API client:** everything goes through `src/utils/predict.ts`: `predictFile`,
  `predictSample`, `summarizeReport`, `requestExplainability`. Base URL is
  `import.meta.env.VITE_API_BASE_URL` (empty means same origin), with a 30 s
  `AbortSignal.timeout`. Errors surface `body.error`. Types: `PredictResult`,
  `SummaryResponse`, `ExplainabilityResponse`. These mirror `server.py`'s payloads, so keep
  them in sync when either side changes.
- **Server status:** `hooks/useServerStatus.ts` polls `GET /health` every 5 s (2.5 s
  timeout) and exposes `{online, datasetOnline, classes, modelLoaded, modelContract}`.
- **Readiness gate** (`AnalyzePage.tsx:89-90`):
  `contractVerified = modelContract === "verified-metadata"` (the same check is in
  `EvidencePage.tsx`), and `modelReady = online && modelLoaded && contractVerified`. When the
  contract is unverified, the page shows the "Model contract is not verified" alert and analysis
  stays disabled.
- **Global store** (`store/reportStore.ts`, Zustand, in-memory only, lost on reload):
  `analysis {audioFile, modelResult, patientInfo, capturedAt}`, `report {summary, model,
  modelResult, patientInfo, createdAt}`, `history` (last 5 `HistoryEntry`, newest first).
- **Dev proxy** (`vite.config.ts`): `/predict`, `/predict-sample`, `/health`, `/explain`,
  `/summarize` → `http://localhost:5001`. `/ready` and `/live` are **not** proxied, here or in
  `nginx.conf` (which proxies the same five paths to `http://backend:5000`).

---

## 4. AnalyzePage (≈840 lines, the core workflow)

- Capture modes: `upload` (drag-drop or picker, `accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a"`,
  **20 MB** client cap vs the server's 25 MB), `record` (MediaRecorder, prefers
  `audio/webm;codecs=opus`, then ogg/opus, then webm; live VU meter via `AnalyserNode` +
  `requestAnimationFrame`), and `sample` (buttons come from `server.classes`, falling back to
  `SAMPLE_LABELS = [healthy, asthma, copd, pneumonia, bronchial]`).
- `AudioVisuals` decodes the chosen audio client-side and draws a waveform plus a coarse
  64-point DFT spectrogram on `<canvas>`. These visuals come from the actual audio, as the
  design policy requires.
- `runAnalysis()` → `predictFile` / `predictSample` (with an optional `denoise` checkbox, shown
  only when `/health.denoise_allowed` is true, and only sent when allowed) →
  confetti (decorative; `disableForReducedMotion`) → `setAnalysis` + `addHistory`.
- Results: an uncertainty banner when `result.uncertain`, a Recharts `RadialBarChart`
  confidence ring (green >70%, amber 40–70%, terracotta <40%), ranked probability bars, and
  a normalized-entropy bar. The "Open explainability" button is disabled for samples, because
  `/explain` needs a real file.
- Report: a consent checkbox → `summarizeReport({model_result, patient_info,
  external_llm_consent: true})` → `setReport` → navigate to `/report`.
- `patientInfo = {patient_id, age, notes, capture_mode}`. The server allowlist **drops
  `patient_id` and `notes`**, so only `age` and `capture_mode` reach the LLM.

`ExplainabilityPage` has its own consent and "include reasoning" toggles and sends
`external_llm_consent: includeReason && consent`. `FormattedText` is a tiny markdown-ish
renderer for LLM output (strips code fences, handles headings and bullets, no
`dangerouslySetInnerHTML`).

---

## 5. Content & design rules (from `design.md`; keep them)

- Say "Analyze recording", not "Diagnose". Keep "Research prototype — not a diagnostic
  device" visible near analysis and results.
- Separate recorded data, model output, interpretation, and limitations. No treatment
  advice, and no one-to-one sound→disease claims in Learn content.
- Tokens: canvas `#fffdf7`, ink `#17211e`, indigo `#2f477d` (primary/focus), moss `#557b69`,
  terracotta `#b6533b` (warnings), amber `#9a6b16`, red `#a33d32` (errors only), rule
  `#d8d5ca`. Serif headings (Source Serif 4 stack), sans UI (Source Sans 3 stack), mono for
  technical values.
- Motion 90–240 ms, honor `prefers-reduced-motion`, no ambient/shimmer/tilt effects. (Note
  that the landing page animations and the post-analysis confetti already stretch this rule.)
- WCAG AA contrast, 44 px primary targets, a visible 2 px indigo focus ring, and a text or
  table equivalent for every visualization.
- Icons: Lucide only, imported by deep path, e.g.
  `import Download from "lucide-react/dist/esm/icons/download.js"`. The typings shim is in
  `src/vite-env.d.ts`.

---

## 6. Numbers shown in the UI (keep them in sync)

Since final-phase item 10 (2026-10-22), every figure in the UI comes from the leakage-free model
in `backend/artifacts/latest/`. Each hard-coded block carries a comment naming its source file:

| Where | Shows | Source |
|---|---|---|
| `LandingPage.tsx` stats | 77.6% patient-level test accuracy (RespiNet + YAMNet fusion) | `test_metrics.json` |
| `EvidencePage.tsx` dataset facts | 1,488 recordings, 243 patient groups, 631 duplicated ICBHI clips removed, 5 labels | `dataset_audit.json` |
| `EvidencePage.tsx` benchmark ledger | 77.6% patient accuracy (95% CI 65–90%), 84.5% recording accuracy, 76.2% balanced accuracy, fused T = 0.67, ECE 0.03, per-source 65.4% / 91.3%, weakest label healthy 62.5% | `test_metrics.json`, `calibration.json` |

**After any retrain, update these blocks, then rebuild and commit `dist/`.** Scores are described
as "calibrated research estimates". Never call them clinical probabilities, and don't call them
"uncalibrated" any more (temperature scaling is applied server-side). The landing demo result is
labeled "Example output … (illustrative)".

## 7. Dead code

`components/Footer.tsx`, `components/AnimatedSection.tsx` and `hooks/useCountUp.ts` are not
imported anywhere (`LandingPage.tsx` defines its own `useCountUp`). `react-type-animation`
appears to be unused as well. Confirm before removing.
