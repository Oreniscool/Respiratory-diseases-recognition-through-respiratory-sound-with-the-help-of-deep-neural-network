# Frontend rebuild: brief and resume point

Written 2026-10-26 so the work can continue on another machine (the assistant's memory is local to one
machine; this file travels with git). Status: **built (2026-10-26)** on branch `frontend-rebuild`, per the spec and plan in `docs/superpowers/`. See `frontend/CLAUDE.md` for how it works and how to run it.
code change so far is the backend payload addition below.

## The request
Archive the current frontend (`frontend/`, about 5.3k lines of React 19 + Vite 6 with hand-written CSS) and
build a fresh one with the best technologies for the job. Plan first; nothing is built until the written
design and the implementation plan are approved (superpowers brainstorming process, architectural path).

## Decisions so far (the user's answers)
- **Audience:** project heads judging a presentation or demo.
- **Focus:** the *current model*, in detail and with eye-catching animation: how it works step by step
  (audio, bandpass filter, windowing, MFCC features, Conv1D + BiGRU network, four-member fusion,
  temperature calibration, abstention) and *why* each choice was made. Source every "why" from
  `research/DECISION_LOG.md` and `documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md`;
  invent nothing.
- **Ending:** a live analyzer. The user uploads audio and gets a clear, understandable model output.
- **Research:** deliberately light. One compact section (what was tested, where the model stops working).
  The research files and figures stay in the repo, not in the UI.
- **Navigation:** scroll-driven pinned scenes plus a keyboard presenter mode (arrow keys step scene by scene).
- **Constraints that stay:** research-only wording ("research prototype, not a diagnostic device") and a
  short, honest "what it can't do yet" scene: the model did not transfer to two outside hospitals, one of
  them children in Shanghai (see `research/CLAIM_EVIDENCE_MATRIX.csv` C-32 and C-38). Do not imply it works
  on new hospitals or children.

## What the backend gives the frontend
`POST /predict` (multipart `file`) returns the fused scores, uncertainty, duration, windows and the first
10 MFCC values. **Added 2026-10-26** (additive, nothing else changed):
- `members`: one `{name, kind, weight, probabilities}` per fusion member (`respinet`, `yamnet`, `opera_ce`,
  `hear`) with each member's own calibrated scores in % and its share of the vote;
- `window_scores`: the RespiNet ensemble's per-window class scores in %.

Recombining the member scores with their weights and the fused temperature (0.5489) reproduces the fused
output exactly (checked on the served model). `POST /explain` returns base64 spectrogram, saliency and
overlay images (RespiNet only). The network's internal activations are not exposed, so animations *inside*
the model must be schematic and labelled as such; waveform, spectrogram and MFCC for the user's own upload can
be computed in the browser and are real.

A good story beat: on the sample recording the members disagree (RespiNet copd 63.6%, YAMNet copd 95.3%,
HeAR copd 87.1%, OPERA-CE healthy 56.7%) and the fusion settles on copd 87.0%. That shows why a fusion exists.

## Working without the model
`backend/artifacts/latest/` (the 1.3 GB served model, HeAR is gated on Hugging Face) is gitignored, so a
fresh clone cannot run inference (the server answers 503, by design). To build the UI anyway, use
`documentation/frontend_sample_predict.json`, a recorded real response (a COPD recording from ICBHI). Mock
`/predict` with it in the dev server.

## Still to decide (in this order)
1. Look and feel. The assistant planned to offer a browser mockup tab to compare visual directions.
2. Two or three technology approaches with a recommendation (candidates: React 19 + Vite + TypeScript;
   GSAP ScrollTrigger or framer-motion for scroll scenes; canvas, SVG or Three.js (react-three-fiber) for the
   pipeline visuals; Tailwind 4; Web Audio for the client-side waveform and spectrogram).
3. The sectioned design, then the written spec in `docs/superpowers/specs/`, then the implementation plan.
4. Archive the old frontend (it is committed, including `dist/`) before the new one is scaffolded.

## Resume prompt (paste into a new session on the other machine)
> Read `documentation/FRONTEND_REBUILD_BRIEF.md`, the spec and the plan in `docs/superpowers/`, and continue
> from the plan's first unchecked task (only after the user has approved the plan).
