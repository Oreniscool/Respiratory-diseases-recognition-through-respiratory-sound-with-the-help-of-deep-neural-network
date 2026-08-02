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
