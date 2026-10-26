# frontend/CLAUDE.md — RespiNet presentation frontend

Loaded when working inside `frontend/`. Read the root [`../CLAUDE.md`](../CLAUDE.md) first. Built 2026-10-26 from
[`../docs/superpowers/specs/2026-10-26-respinet-frontend-rebuild-design.md`](../docs/superpowers/specs/2026-10-26-respinet-frontend-rebuild-design.md)
and its plan. The previous app is archived, unbuilt, in [`../frontend-legacy/`](../frontend-legacy/).

## 1. What it is
A light-editorial presentation of the served model (14 full-screen scenes, 2 of them 3D: lungs and the vote, each animating in real time when it opens) with a keyboard
presenter mode, ending in an analyzer that turns an uploaded/recorded/demo recording into a "story report".
Routes: `/` story (the analyzer closes it), `/analyze` the analyzer alone. Dev only: `/__stage?group=lungs|fusion&progress=0.6`.

## 2. Stack and commands
React 19.3, Vite 8, TypeScript **5.9** (typescript-eslint supports < 6.1, not TS 7), Tailwind 4 (tokens via `@theme`),
react-three-fiber 9 + drei 10 (three 0.186), GSAP 3.15 + ScrollTrigger, Lenis, Motion 14, Zustand 5, React Router 8,
fft.js, self-hosted Fraunces/Inter (`@fontsource-variable`). Node ≥ 22.12. Versions are pinned exactly.

```bash
npm ci
npm run dev          # :5173, proxies /health, /predict and exactly ^/explain$ to :5001
npm test             # Vitest (jsdom); includes the fact check and, if present locally, the librosa parity check
npm run check:facts  # src/content/facts.ts vs the evidence files and backend/artifacts/latest (skips when absent)
npm run lint && npm run typecheck && npm run build   # dist/ is COMMITTED: rebuild and commit after src changes
CHROMIUM_PATH=~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome npm run e2e      # mock-mode build in dist-e2e/
E2E_GPU=1 CHROMIUM_PATH=… npm run e2e -- -g fps        # real GPU, asserts ≥ 50 fps (run on the presentation laptop)
E2E_REAL_BACKEND=1 E2E_BASE_URL=http://127.0.0.1:5173 npm run e2e -- analyzer.real   # dev server + live backend
backend/venv/bin/python -I frontend/scripts/prepare_clips.py   # from the repo root, backend up: re-pick clips (--scene-only: scene excerpts only)
backend/venv/bin/python -I frontend/scripts/seed_windows.py    # from the repo root: per-seed window scores for scene 7
```

## 3. Layout (one job per folder)
| Path | Job |
|---|---|
| `src/content/` | `facts.ts` (every on-screen number with its source), `why.ts` (sourced reasons), `challenges.ts`, `members.ts`, `clips.json` + `clips.provenance.json` (generated), `sample-predict.json` (copy of `documentation/frontend_sample_predict.json`) |
| `src/lib/api/` | the only backend client: `getHealth`, `predict(file, name, demoClipId?)`, `explain`; `OfflineError` for network failures, 502/503/504 and any failed `/health`; mock mode (`VITE_MOCK_API=1` or `setMockMode`) |
| `src/lib/audio/` | DSP mirroring the server (band-pass, STFT, 128 Slaney mel, DCT-II MFCC, Savitzky-Golay deltas, CMVN, windows) and `analyzeInWorker` |
| `src/features/story/` | `scenes.ts` (ids s00–s13), `timeline.ts` (`useSceneTimeline`: plays the scene's timeline and text reveal in real time each time the scene opens), presenter store/keys/strip, `scenes/S00…S13` |
| `src/features/three/` | one shared canvas (`Stage`), `Lungs` (+ `lungAnatomy.ts`, shared with the 2D fallback), `FusionVote`, `glyphTexture`, `layerColors`, projected DOM labels (`labels.tsx`), `Fallback2D` |
| `src/features/analyzer/` | `analyzerStore`, `Analyzer`, `Recorder`, `PipelineReplay`, `ResultView` (Verdict, MemberVotes, WindowStrip, AllScores), `ExplainPanel` |
| `public/audio`, `public/demo` | test-split clips and their recorded real `/predict` responses; `CREDITS.md` |

## 4. Rules that are easy to break
- **No number without a `FACTS` entry**, and `facts.sources.test.ts` must pass; never type a metric into a scene.
- **Research wording**: "strongest match", "model score", "research prototype, not a diagnostic device"; the 75.5%
  always says "on 49 unseen patients from the same datasets". No limitations scene (user decision); no claims about
  other hospitals or children.
- **Colour**: bright fills (`#93d52a`, `#2ad585`, `#2ad5c4`) never carry text; class colours come from
  `components/classColors.ts` with a legend; text stays ink.
- **Scenes**: pass the `useSceneTimeline` ref to `SceneFrame`; a scene "opens" while the line at 40% of the viewport
  is inside it, and its timeline then plays from the start in seconds (scaled by `PACE`). Never tie animation to scroll
  position again (presenter steps squeezed it into the scroll tween). Text that should reveal gets `data-reveal`;
  charts whose data arrives later pass `deps`; 3D scenes pass `minDuration` because their `progress` is the timeline's.
- **Icons**: layer and model icons live in `components/glyphs.tsx` and mean one thing everywhere (DOM and 3D textures).
- **Audio** plays through `components/AudioPlayer.tsx` (one clip at a time, waveform = seek bar, live visualiser); never
  a bare `<audio controls>`. Don't put a CSS `transition` on an element a GSAP timeline animates (it left scene 7's
  cards stuck invisible): animate a wrapper.
- **Scene 7** reads `content/sample-seeds.json` (`scripts/seed_windows.py`; its mean must reproduce `SAMPLE.window_scores`,
  `seeds.test.ts`). Re-run the script if the served model or the sample response changes.
- **Scene 6** (`charts/NetworkJourney.tsx` + `NetworkGraph.tsx`) shows the demo-copd clip's window 2: its recorded
  `window_scores` are real; the graph (a few neurons per layer) and the conv/GRU/pooling rows are labelled illustrations. Keep that distinction in the copy.
- **Heavy work off the main thread**: audio analysis goes through `analyzeInWorker`; blocking the first render made
  the page ignore keys for 3 s once.
- **No drei `<Html>`** (one React root per label lost labels under StrictMode) and no drei `<Text>`/`<Environment
  preset>` (they download fonts/HDRs from CDNs): use `labels.tsx` and `<Lightformer>`.
- **`window_scores` are the RespiNet ensemble's**, not the fusion's ("RespiNet's reading of each window").
- **Demo clips** come from test-split patients and show the model's real answer, picked by audio quality only.

## 5. Gotchas
- Mock mode is build-time (`import.meta.env`): e2e builds to `dist-e2e/` so the committed `dist/` stays a normal build.
- Headless Chromium renders WebGL in software (~20 fps); use `E2E_GPU=1` for real frame rates.
- Playwright's own browsers are not installed here; point `CHROMIUM_PATH` at a local Chromium.
- In the dev server, `window.__presenter` exposes the presenter store for debugging.
