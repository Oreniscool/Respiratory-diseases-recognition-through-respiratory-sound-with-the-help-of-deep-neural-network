# RespiNet frontend rebuild: design

Date: 2026-10-26 · Status: draft for review · Decisions recorded with the user in a brainstorming session
(summary in `documentation/FRONTEND_REBUILD_BRIEF.md`).

## 1. Goal and audience
A fresh frontend that **presents the current RespiNet model** to project heads in a live presentation or
demo: how it works, step by step, and why each design choice was made, with eye-catching animation. It ends
in a **live analyzer** that turns an uploaded recording into a clear, understandable model output.

Success means a presenter can walk the audience from "what a stethoscope hears" to "the model's answer on
your recording" in one continuous story, every number on screen is traceable to an artifact or decision,
and the demo still works if the backend is down.

## 2. Decisions
| Topic | Decision |
|---|---|
| Audience | Project heads; presentation/demo. Model-focused, light on research |
| Story | Scroll-driven pinned scenes, one per pipeline stage (§4) |
| Navigation | Scroll story **plus** a keyboard presenter mode on the same timeline |
| Visual direction | Light editorial (serif headlines, calm paper), **light theme only** |
| Palette | The user's palette (§3), paper `#f7faf0` ("softer") |
| 3D | **Hybrid**: 3D only for the hero scenes (opening, inside the network, the four models voting) |
| Lungs | Stylized, generated in code (no third-party model) |
| Result layout | **Story report**: one column revealed top to bottom (§5) |
| Research content | No "limitations" scene (user decision). The 75.5% figure is labelled with its true scope and the research-prototype tag stays (§7) |
| Old frontend | Archived with `git mv frontend frontend-legacy` (history kept) |

## 3. Visual system
**Type.** Fraunces (headlines, serif) and Inter (UI and body), self-hosted via `@fontsource` packages so an
offline presentation laptop renders correctly (no font CDN).

**Colour roles** (from the user's ramps; contrast measured on the paper colour):
| Token | Value | Use | Contrast on paper |
|---|---|---|---|
| `--paper` | `#f7faf0` | page background | — |
| `--ink` | `#1e2b08` (text-900) | body text, headlines | 14:1 |
| `--ink-muted` | `#3c5610` (text-800) | secondary text | 7.8:1 |
| `--accent` | `#198076` (accent-700) | eyebrows, links, waveforms, the leading score | 4.5:1 (text ≥ 14 px semibold or large only) |
| `--fill` / `--fill-strong` | `#93d52a` / `#76aa22` (primary-500/600) | bars, highlights, chips, 3D glow | fills only, never text |
| `--line`, `--track` | `#dfe9cc`, `#e7eed9` | borders, bar tracks | — |

**Rule:** the bright 500 steps (lime `#93d52a`, green `#2ad585`, teal `#2ad5c4`) are below 2:1 on the paper;
they colour fills, strokes and 3D light only. Text always uses `--ink`, `--ink-muted` or `--accent`.

**Class colours** (charts that need identity, e.g. the per-window strip). Fixed order, validated with the
dataviz palette validator on `#f7faf0`: all checks pass, worst adjacent colour-blind ΔE 9.1.
| asthma | bronchial | copd | healthy | pneumonia |
|---|---|---|---|---|
| `#2a78d6` | `#eb6834` | `#1baf7a` | `#eda100` | `#e87ba4` |

Three are below 3:1 on the paper (the validator's WARN), so every chart using them carries a legend with
counts and per-mark tooltips. Single-series charts (class scores, member scores) use one hue and direct labels.

## 4. The story (scenes 0–11, then the analyzer)
Each scene is pinned while its animation plays against scroll progress, and is one presenter-mode step.
◆ = 3D. "Real" = drawn from actual data or the visitor's recording; "Illustration" = a labelled schematic.
The *why* lines are paraphrased from the cited source; scenes without a recorded reason state only *what*.

| # | Scene | Content | Real? | Source of numbers / why |
|---|---|---|---|---|
| 0 | ◆ Opening | Stylized translucent lungs breathing on the paper; sound rings; title "How a machine listens to your lungs"; "Research prototype, not a diagnostic device" | Illustration | — |
| 1 | Listening to lungs | What a stethoscope hears: a normal breath vs crackles and wheezes, playable | Real clips (§6.4) | — |
| 2 | The data | 1,551 recordings from 244 patients (ICBHI 920/126, Kaggle remainder 568/97, KAUH 63/21) as dots flying into train/val/test 146/49/49 patients. *Why patients, not recordings:* a patient may never be on both sides. *Why some clips were removed:* copies of the same audio under different IDs | Real counts | `dataset_audit.json`, `split_summary.json`; D-01, D-02 |
| 3 | Cleaning the signal | 4th-order Butterworth band-pass 100–2,000 Hz on the spectrum. *Why:* without it the model learned heartbeat thuds below 100 Hz and noise above 2 kHz | Real recording | `model_metadata.json["preprocessing"]`; chronicle §1 item 5 (line 77) |
| 4 | Slicing time | Resample to 22,050 Hz; 200-frame windows (≈4.6 s, hop 512) sliding by 100 frames (50% overlap) | Real recording | `preprocessing` |
| 5 | The sound fingerprint | Spectrogram (FFT 2,048, hop 512) → 128 mel bands (librosa's default; the configured `n_mels = 64` applies only to the log-mel variant) → 40 MFCCs + Δ + Δ² = 120 numbers per frame → CMVN normalization | Real recording (browser approximation, labelled) | `preprocessing` |
| 6 | ◆ Inside RespiNet | The 200 × 120 fingerprint flows through: multi-scale convolutions (kernels 3/5/11: patterns at several time scales) → BiGRU-128 (reads the breath forwards and backwards) → residual skip (*why:* keeps fine texture the GRU would discard) → BiGRU-64 → dual pooling, attention ‖ max (*why:* a single attention average diluted short crackles) → Dense 128 → 64 → five scores. 458,701 parameters | Illustration of the real architecture | `model_summary.txt`; chronicle lines 140, 142, 287 |
| 7 | Three of them | Three copies trained with seeds 42/43/44, window scores averaged | Real setup | `model_metadata.json["fusion"]`; D-21 |
| 8 | ◆ Four models vote | RespiNet, YAMNet (Google, everyday sounds), OPERA-CE (pretrained on respiratory sounds), HeAR (Google, health acoustics) each score; equal weights; the fusion settles. On the sample: three say copd, OPERA-CE says healthy 56.7%, fused copd 87.0%. *Why fusion:* chosen by a rule fixed before the comparison, using patient-grouped cross-validation (stated as procedurally chosen, not as a significant improvement, per D-27 / C-22) | Real scores | `documentation/frontend_sample_predict.json`; D-05, D-21, D-27 |
| 9 | Honest confidence | Temperature scaling (fused T = 0.5489, fit on validation data) shown on a reliability chart; expected calibration error 0.074 on the test recordings; validation NLL 0.568 → 0.464. *Why:* raw scores are not probabilities | Real calibration | `calibration.json`, `test_metrics.json`; chronicle §5.3 |
| 10 | Knowing when to abstain | Answer "uncertain" when the top score < 66.3% or normalized entropy > 0.506 (set for 80% coverage on validation) | Real thresholds | `calibration.json`; chronicle line 426 |
| 11 | How well it does | **75.5% patient accuracy on 49 unseen patients from the same datasets** (95% CI 63.3–87.8%); balanced accuracy 74.9%; per-class view | Real test metrics | `test_metrics.json` |
| — | Try it | The analyzer (§5) | Real | — |

All numbers live in `src/content/facts.ts`, each with its source path; the *why* lines in `src/content/why.ts`
with their decision or chronicle reference.

## 5. The analyzer (story report)
Input: upload (`.wav .flac .ogg .mp3 .webm .m4a`), record from the microphone, or a demo clip.
1. **Pipeline replay** on the visitor's recording while `/predict` runs: waveform → band-pass → windows →
   MFCC fingerprint, computed in the browser (Web Worker).
2. **Verdict**: ring with the fused score, "Strongest match: COPD", "calibrated model score · research
   prototype, not a diagnostic device", a plain-language sentence, and the abstention check (score vs
   66.3%, uncertainty vs 0.51), duration, windows and sample rate.
3. **How the four models voted**: four cards (name, one-line description, top class and score,
   agrees/disagrees), "3 of 4 agree".
4. **Through the recording**: one cell per window coloured by the leading class, legend with counts,
   tooltips. Caption: *RespiNet's reading of each window* (`window_scores` are the RespiNet ensemble's,
   not the fusion's).
5. **All five scores** after fusion and calibration.
6. Optional **"Where the model listened"**: `/explain` saliency over the spectrogram (RespiNet only, labelled).

Each block reveals in sequence as the visitor scrolls. An **uncertain** result shows "The model isn't sure",
the two closest classes and why it held back.

## 6. Architecture
### 6.1 Stack
React 19, Vite, TypeScript (strict), Tailwind CSS 4 (tokens from §3), react-three-fiber + drei (3D), GSAP +
ScrollTrigger (scene timeline), Lenis (smooth scroll), Motion (UI transitions), Meyda (browser MFCC),
Zustand (state), React Router, Vitest + Testing Library, Playwright, ESLint. Exact versions are fixed in the
implementation plan after checking current releases.

### 6.2 Layout
```text
frontend/
├── index.html · package.json · package-lock.json · tsconfig.json · vite.config.ts · eslint.config.js
├── nginx.conf · Dockerfile                 # carried over, including the exact-match /explain proxy
├── public/audio/                           # demo and scene-1 clips + LICENSE notes (§6.4)
└── src/
    ├── main.tsx · App.tsx                  # routes: "/" story, "/analyze" analyzer
    ├── styles/tokens.css · global.css
    ├── content/facts.ts · why.ts
    ├── lib/api/client.ts · types.ts · mock.ts
    ├── lib/audio/decode.ts · bandpass.ts · windows.ts · spectrogram.ts · mfcc.ts · worker.ts (+ tests)
    ├── features/story/scenes/S00Opening.tsx … S11Performance.tsx · timeline.ts · presenter/
    ├── features/three/StageCanvas.tsx · Lungs.tsx · NetworkFlow.tsx · FusionVote.tsx · Fallback2D.tsx
    ├── features/analyzer/Uploader.tsx · PipelineReplay.tsx · ResultView.tsx · MemberVotes.tsx · WindowStrip.tsx
    ├── components/                         # Button, Card, ScoreBar, Ring, Badge, SceneFrame, Legend
    └── hooks/                              # useReducedMotion, usePresenter, useAudioAnalysis, useWebGL
```

### 6.3 Scene engine and presenter mode
`timeline.ts` builds one GSAP timeline; every scene registers a label and its tweens, pinned with
ScrollTrigger. Presenter mode (`P` toggles; → / ← / space step; `Esc` exits; progress strip at the bottom)
tweens the scroll position to the next or previous label, so scroll and keys share one implementation. One
full-screen `<Canvas>` sits behind the page; scenes 0, 6 and 8 tell it which 3D group to show, and it renders
on demand and only while a 3D scene is near the viewport. three.js is a lazy chunk.

### 6.4 Data and API
`lib/api/client.ts` is the only module that calls the backend: `GET /health`, `POST /predict`
(multipart `file`), `POST /explain`. Types mirror `backend/server.py`, including the 2026-10-26 fields
`members[{name, kind, weight, probabilities}]` and `window_scores`. Timeout 120 s.
**Mock mode** (`VITE_MOCK_API=1`, and automatically offered when `/health` fails) answers from recorded real
responses. Demo clips must be (a) from **test-split patients** (never seen in training) and (b) from a source
whose licence allows redistribution: KAUH (CC BY 4.0) qualifies; ICBHI audio is included only if its licence
is confirmed to allow it. Each demo clip ships with its own recorded real `/predict` response, captured from
the served model, and an attribution line on the page.

## 7. Content rules
- Research-only wording everywhere ("model score", "strongest match", "research prototype, not a
  diagnostic device"); never "diagnosis", "detects disease" or clinical-confidence language.
- The 75.5% figure always carries its scope: unseen patients *from the same datasets*. No claims about other
  hospitals, devices or children.
- 3D and network animations are labelled illustrations; browser-computed MFCCs are labelled approximations.
- No number without an entry in `facts.ts`.

## 8. Failure states
| Situation | Behaviour |
|---|---|
| Backend down or model missing (503) | Analyzer: "The model is offline" + demo mode. Story unaffected |
| File rejected (400/415/422) | The server's message, plus the accepted formats |
| Slow inference | Pipeline replay plays during the wait; timeout 120 s with a retry |
| Abstention | "The model isn't sure" state (§5) |
| No WebGL / weak GPU | `Fallback2D` illustrations of the same 3D scenes |
| `prefers-reduced-motion` | Scenes cross-fade instead of scrubbing; 3D still frames |
| Microphone denied | Upload and demo stay available, with a short explanation |

## 9. Performance and accessibility
60 fps target on an integrated GPU, measured on the presentation laptop; lazy three.js; on-demand rendering;
audio analysis in a Web Worker. Keyboard access throughout, visible focus, a text summary per scene for
screen readers, the §3 contrast rule, and colour never the only carrier of meaning.

## 10. Testing
- **Vitest:** `lib/audio` on synthetic signals (MFCC settings mirror the server: FFT 2,048, hop 512, 128 mel bands, 40 coefficients) (the band-pass suppresses a 50 Hz tone and passes 500 Hz; a
  71 s clip gives 30 windows, matching the server's response for the sample); the API client in mock mode;
  the result view's derived values (agreement count, leading class per window) from the recorded response.
- **Content check:** a script compares `facts.ts` with its sources (sample response always; backend
  artifacts when present locally, skipped otherwise).
- **Playwright:** the story loads with no console errors; presenter mode reaches every scene; the analyzer
  completes in mock mode and, locally, against the real backend.
- **CI** (`.github/workflows/checks.yml`): typecheck, lint, Vitest, build for `frontend/`; `frontend-legacy/`
  is not built.

## 11. Documentation
Chronicle entry (frontend workflow change), a rewritten `frontend/CLAUDE.md`, the root `CLAUDE.md` repository
map, README, and `documentation/FRONTEND_REBUILD_BRIEF.md` pointing to this spec.

## 12. Out of scope
The research documents and figures in the UI; a dark theme; the LLM report/summary flow of the old frontend
(`/summarize`); backend changes beyond those already made.
