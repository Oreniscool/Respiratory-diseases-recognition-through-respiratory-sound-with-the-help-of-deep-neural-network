# RespiNet Presentation Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `frontend/` with a light-editorial, scroll-driven presentation of the served RespiNet model
(14 scenes, 3 of them 3D, keyboard presenter mode) that ends in a story-report analyzer for uploaded audio.

**Architecture:** React SPA built with Vite. One GSAP timeline pins every scene; presenter mode tweens scroll to
scene labels. One shared react-three-fiber canvas renders the three 3D scenes, with a 2D fallback. Audio
features for the visitor's file are computed in a Web Worker by pure TypeScript DSP that mirrors the server's
settings. All backend calls go through one client with a mock mode fed by recorded real responses.

**Tech Stack (exact versions):** react / react-dom 19.3.1, vite 8.3.5, @vitejs/plugin-react 6.1.2,
typescript **5.9.3** (typescript-eslint 8.72.0 supports < 6.1, so not TS 7), tailwindcss + @tailwindcss/vite
4.3.3, three 0.186.1, @types/three 0.186.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, gsap 3.15.0,
@gsap/react 2.1.2, lenis 1.3.27, motion 14.6.0, zustand 5.0.16, react-router 8.5.0, fft.js 4.0.4,
@fontsource-variable/fraunces 5.3.0, @fontsource-variable/inter 5.3.0, vitest 5.0.5, jsdom 30.1.3,
@testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, @playwright/test 1.64.1, eslint 10.13.0,
typescript-eslint 8.72.0. Node ≥ 22.12 (this machine: 22.23.3).

**Spec:** `docs/superpowers/specs/2026-10-26-respinet-frontend-rebuild-design.md`

**Deviation from the spec:** Meyda is dropped. Its mel filterbank and defaults differ from librosa's, so
`lib/audio` implements the server's exact settings itself (FFT 2,048, hop 512, 128 Slaney mel bands, 40
DCT-II coefficients). It is about 120 lines and fully testable. Everything else follows the spec.

## Global Constraints
- Palette tokens (spec §3): `--paper #f7faf0`, `--ink #1e2b08`, `--ink-muted #3c5610`, `--accent #198076`,
  `--fill #93d52a`, `--fill-strong #76aa22`, `--line #dfe9cc`, `--track #e7eed9`. Light theme only.
- The 500-step colours (`#93d52a`, `#2ad585`, `#2ad5c4`) never colour text.
- Class colours, fixed order: asthma `#2a78d6`, bronchial `#eb6834`, copd `#1baf7a`, healthy `#eda100`,
  pneumonia `#e87ba4`. Charts using them always have a legend with counts and tooltips.
- Fonts: Fraunces (headlines), Inter (UI), self-hosted via @fontsource; no CDN requests at runtime.
- Copy: "model score", "strongest match", "research prototype, not a diagnostic device". Never "diagnosis",
  "detects", "screening" or clinical-confidence wording. The 75.5% figure always reads "on 49 unseen patients
  from the same datasets".
- Every number shown comes from `src/content/facts.ts` (each entry has a `source`).
- 3D and network visuals carry the label "Illustration"; browser MFCCs carry "Approximation of the server's
  features".
- All HTTP in `src/lib/api/client.ts`. Timeout 120 000 ms. Dev proxy and nginx match `/explain` exactly.
- Lucide is not used; icons are inline SVG components in `src/components/icons.tsx`.
- `frontend/dist/` is committed after every task that changes `src/` (existing repo convention).
- Doc-sync rule (root `CLAUDE.md` §2): the chronicle gets an entry in Task 15.

## Review Focus
1. **Very short uploads** (under 4.6 s, i.e. fewer than 200 frames): one zero-padded window, and the replay
   draws without errors. Test in Task 6.
2. **Silent or near-silent audio:** every computed value stays finite (no NaN from log 0 or a zero
   standard deviation), and the fingerprint draws flat. Tests in Tasks 5 and 6.
3. **An "uncertain" response:** the story report shows "The model isn't sure" with the two closest classes,
   never a bare "UNCERTAIN" verdict. Test in Task 12.
4. **A response without `members` or `window_scores`** (unfused artifact or an older server): the vote and
   window sections are hidden and the rest renders. Test in Task 12.
5. **Presenter keys while a form control has focus, or pressed rapidly:** keys are ignored inside inputs and
   buttons' own activation, steps clamp at the first and last scene, and a press during a tween retargets
   instead of skipping two scenes. Test in Task 7.

---

### Task 1: Archive the old frontend and scaffold the new one

**Files:**
- Move: `frontend/` → `frontend-legacy/` (`git mv`)
- Create: `frontend/{package.json,index.html,vite.config.ts,tsconfig.json,eslint.config.js,vitest.setup.ts}`,
  `frontend/src/{main.tsx,App.tsx,vite-env.d.ts}`, `frontend/src/App.test.tsx`
- Copy back: `frontend-legacy/{nginx.conf,Dockerfile,.dockerignore}` → `frontend/`
- Modify: `.github/workflows/checks.yml` (frontend job: `npm ci`, `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build` in `frontend/`)

**Interfaces:**
- Produces: routes `/` → `<StoryPage/>` and `/analyze` → `<AnalyzePage/>` (placeholder components in
  `src/pages/` for now); npm scripts `dev`, `build` (`tsc -b && vite build`), `typecheck`, `lint`, `test`
  (`vitest run`), `e2e` (`playwright test`).

- [ ] **Step 1:** `git mv frontend frontend-legacy`, then copy back `nginx.conf`, `Dockerfile` and
  `.dockerignore`. Commit: `chore(frontend): archive the old frontend as frontend-legacy`.
- [ ] **Step 2:** Create `package.json` with the exact versions above (no `^`), `"type": "module"`. Run
  `npm install` and commit the lockfile.
- [ ] **Step 3:** `vite.config.ts`: react + tailwind plugins; dev proxy to `http://localhost:5001` for
  `/health`, `/predict`, and `'^/explain$'` (exact, see the comment in `frontend-legacy/vite.config.ts`);
  vitest block `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`, `exclude: ['e2e/**']`.
  `tsconfig.json` strict, `noUncheckedIndexedAccess: true`.
- [ ] **Step 4: Write the failing test** `src/App.test.tsx`:
```tsx
it("routes / to the story and /analyze to the analyzer", () => {
  render(<MemoryRouter initialEntries={["/analyze"]}><AppRoutes /></MemoryRouter>);
  expect(screen.getByTestId("analyze-page")).toBeInTheDocument();
});
```
- [ ] **Step 5:** Run `npm test` → FAIL (`AppRoutes` missing). Implement `export function AppRoutes()` in
  `App.tsx` and placeholder pages with `data-testid="story-page"` / `"analyze-page"`. Unknown paths redirect to
  `/`. Run `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 6:** Update CI, commit `feat(frontend): scaffold React 19 + Vite 8 app` (include `dist/`).

### Task 2: Design tokens, fonts and shared components

**Files:**
- Create: `src/styles/{tokens.css,global.css}`, `src/components/{Button,Card,ScoreBar,Ring,Badge,Legend,SceneFrame,icons}.tsx`,
  `src/components/classColors.ts`, `src/components/components.test.tsx`, `src/styles/contrast.test.ts`

**Interfaces:**
- Produces:
  - `CLASS_COLORS: Record<'asthma'|'bronchial'|'copd'|'healthy'|'pneumonia', string>` and
    `classColor(name: string): string` (unknown class → `#55623f`);
  - `<ScoreBar label value highlight? />` (value in %, text in ink, the bar fill `--fill-strong`, or
    `--accent` when `highlight`);
  - `<Ring value size? />`;
  - `<Badge tone="accent"|"muted">`;
  - `<Legend items={{label, color, count}[]} />`;
  - `<SceneFrame id label summary illustration?>` (a section with `data-scene={id}`, a screen-reader-only
    `summary`, and an "Illustration" tag when `illustration`);
  - `contrastRatio(a: string, b: string): number` in `src/styles/contrast.ts`.

- [ ] **Step 1: Failing tests.**
  - `contrast.test.ts`: `contrastRatio('#1e2b08','#f7faf0') > 13`, `('#3c5610', paper) > 7`,
    `('#198076', paper) >= 4.5`, `('#93d52a', paper) < 2`.
  - `components.test.tsx`: `ScoreBar` renders `"copd"` and `"87.0%"` and its text node has no inline colour
    from `CLASS_COLORS`; `SceneFrame` with `illustration` shows the text "Illustration"; `Legend` shows
    `"copd 25"`.
- [ ] **Step 2:** `npm test` → FAIL. Implement. Tokens are CSS variables in `tokens.css`, exposed to Tailwind
  through `@theme`. Import the fonts in `main.tsx`. Type scale: Fraunces 500 for h1/h2, Inter 400/600 body.
- [ ] **Step 3:** `npm test` → PASS. Commit `feat(frontend): design tokens and shared components`.

### Task 3: Facts and reasons with sources, plus the fact check

**Files:**
- Create: `src/content/{facts.ts,why.ts,facts.test.ts}`, `scripts/check-facts.mjs`
- Copy: `documentation/frontend_sample_predict.json` → `src/content/sample-predict.json` (keep the original;
  `check-facts.mjs` asserts they are identical)

**Interfaces:**
- Produces: `type Fact = { value: number | string; display: string; source: string }`;
  `FACTS: Record<FactKey, Fact>`; `WHY: Record<WhyKey, { text: string; source: string }>`;
  `SAMPLE: PredictResult` (typed import of the sample JSON, type from Task 4's `types.ts`; create
  `types.ts` here if Task 4 is not done yet).
- Fact keys and values (verbatim from spec §4; `source` = the path or ID in the spec's table):
  `recordings 1551`, `patients 244`, `icbhi 920/126`, `kaggleRemainder 568/97`, `kauh 63/21`,
  `splitPatients 146/49/49`, `splitRecordings 837/325/389`, `bandLowHz 100`, `bandHighHz 2000`,
  `filterOrder 4`, `sampleRate 22050`, `windowFrames 200`, `windowHop 100`, `hopSamples 512`, `nFft 2048`,
  `nMels 128`, `nMfcc 40`, `featuresPerFrame 120`, `parameters 458701`, `seeds "42, 43, 44"`,
  `fusedTemperature 0.5489`, `memberTemperatures {respinet 0.9099, yamnet 1.0570, opera_ce 1.5085, hear 1.0973}`,
  `minConfidence 0.6629`, `maxEntropy 0.506`, `coverage 0.80`, `eceTest 0.0743`, `nllBefore 0.5675`,
  `nllAfter 0.4643`, `patientAccuracy 0.7551`, `patientBalancedAccuracy 0.7487`, `ciLow 0.633`,
  `ciHigh 0.878`, `testPatients 49`, `copiedClips 631`, `kaggleClips 1211`, `copiedCopd 401`,
  `kauhCutClips 316`, `byteDuplicates 12`, `labelCollapse "27–29%"`, `earlyStopFrom 0.41`, `earlyStopTo 0.59`,
  `patienceFrom 12`, `patienceTo 18`, `tf32Drift 2.2e-3`, `headCheckTol 1e-4`, `inflatedScore "82%"`.
  The `WHY` keys are `patientSplit`, `removeCopies`, `bandpass`, `residualSkip`, `dualPooling`, `fusion`,
  `calibration` and `abstention`, with texts paraphrasing the spec's §4 and their cited sources.

- [ ] **Step 1: Failing test** `facts.test.ts`: every `FACTS` and `WHY` entry has a non-empty `source`;
  `SAMPLE.prediction === "copd"`, `SAMPLE.confidence === 87`, `SAMPLE.members?.length === 4`; the display for
  `patientAccuracy` is `"75.5%"`; no `WHY.text` contains `diagnos`.
- [ ] **Step 2:** `npm test` → FAIL; implement; → PASS.
- [ ] **Step 3:** `scripts/check-facts.mjs` (`npm run check:facts`) checks the following, exits non-zero on any
  mismatch, and prints the facts it checked:
  - the two sample JSONs are identical;
  - if `../backend/artifacts/latest/` exists, the facts match `test_metrics.json` (patient accuracy,
    balanced accuracy, the CI, recording-level ECE), `calibration.json` (temperature, `validation_nll_*`),
    `model_metadata.json["preprocessing"]` and `["fusion"]` temperatures (rounded to 4 dp);
  - `../backend/data/kaggle_icbhi_overlap.summary.json` (`clips`, `overlaps`, `by_class.copd.overlaps`) and
    `kaggle_kauh_overlap.summary.json` (`overlaps`).

  Run it locally → all pass. Commit `feat(frontend): sourced facts and the fact check`.

### Task 4: API client, types and mock mode

**Files:**
- Create: `src/lib/api/{types.ts,client.ts,mock.ts,client.test.ts}`

**Interfaces:**
- Produces (`types.ts`):
```ts
export interface MemberScore { name: string; kind: string; weight: number; probabilities: Record<string, number> }
export interface PredictResult {
  prediction: string; model_prediction: string; confidence: number; probabilities: Record<string, number>;
  uncertain: boolean; uncertainty: { normalized_entropy: number; min_confidence: number; max_normalized_entropy: number };
  members?: MemberScore[]; window_scores?: Record<string, number>[];
  duration_s: number; sample_rate: number; windows_analyzed: number; valid_frames: number[]; research_only: boolean;
}
export interface ExplainResult { prediction: string; confidence: number; spectrogram: string; saliency: string;
  overlay: string; saliency_class: string; attribution_scope?: string; attribution_warning?: string }
export interface Health { ready: boolean; model_contract: string; classes: string[] }
```
- Produces (`client.ts`): `REQUEST_TIMEOUT_MS = 120_000`; `class ApiError extends Error { status: number }`;
  `class OfflineError extends Error`; `class TimeoutError extends Error`; `getHealth(): Promise<Health>`
  (throws `OfflineError` on network failure, a 503, or `model_contract !== "verified-metadata"`);
  `predict(file: Blob, filename: string): Promise<PredictResult>`;
  `explain(file: Blob, filename: string): Promise<ExplainResult>`. Mock mode is on when
  `import.meta.env.VITE_MOCK_API === "1"` or `setMockMode(true)` was called.
- Produces (`mock.ts`): `mockPredict(clipId?: string): Promise<PredictResult>` (a known demo clip → its
  recorded response from Task 14; otherwise `SAMPLE`), `mockHealth(): Health`.

- [ ] **Step 1: Failing tests** (`fetch` stubbed with `vi.stubGlobal`):
  - a 400 with `{error:"Unsupported file"}` rejects `ApiError` with `message === "Unsupported file"` and
    `status === 400`;
  - a 503 → `OfflineError`;
  - fetch rejecting `TypeError` → `OfflineError`;
  - an abort with `name === "TimeoutError"` → `TimeoutError`;
  - `getHealth` with `model_contract: "unverified"` → `OfflineError`;
  - with `setMockMode(true)`, `predict` resolves `SAMPLE` without calling fetch;
  - `predict` sends a `FormData` with field `file` and `denoise` `"0"`.
- [ ] **Step 2:** FAIL → implement (`AbortSignal.timeout(REQUEST_TIMEOUT_MS)`) → PASS. Commit
  `feat(frontend): API client with mock mode`.

### Task 5: DSP that mirrors the server

**Files:**
- Create: `src/lib/audio/{bandpass.ts,stft.ts,mel.ts,mfcc.ts,deltas.ts,cmvn.ts,dsp.test.ts}`

**Interfaces:**
- Produces:
  - `bandpass(x: Float32Array, sr: number, low = 100, high = 2000): Float32Array`;
  - `stftPower(x: Float32Array, nFft = 2048, hop = 512): Float32Array[]` (frames × 1025; centred with
    `nFft/2` zero padding, as librosa ≥ 0.10 does; periodic Hann window; uses fft.js);
  - `melFilterbank(sr: number, nFft = 2048, nMels = 128): Float32Array[]` (Slaney mel scale and Slaney area
    normalization, fmin 0, fmax sr/2; matches `librosa.filters.mel` defaults);
  - `powerToDb(m: Float32Array[]): Float32Array[]` (ref 1, amin 1e-10, top_db 80);
  - `mfcc(power: Float32Array[], sr: number, nMfcc = 40): Float32Array[]` (frames × 40; mel → dB → DCT-II
    `ortho`);
  - `deltas(f: Float32Array[], order: 1 | 2, width = 9): Float32Array[]` (Savitzky-Golay derivative,
    edge mode `interp`, as `librosa.feature.delta`);
  - `cmvn(f: Float32Array[], eps = 1e-8): Float32Array[]` (per feature over all frames, as
    `preprocessing.apply_cmvn`).
- Band-pass approach (spec §4 scene 3, a labelled approximation of the server's 4th-order Butterworth
  `sosfiltfilt`): a 4th-order Butterworth high-pass at `low` cascaded with a 4th-order Butterworth low-pass
  at `high`. Each is two RBJ biquads with Q = 0.5412 and 1.3066, run forward then backward (zero phase).

- [ ] **Step 1: Failing tests** (`dsp.test.ts`; signals synthesized at 22 050 Hz):
  - RMS of `bandpass` of a 1 s 50 Hz sine < 0.1 × input RMS; of 500 Hz within ±1 dB; of 6 kHz < 0.1 ×;
  - `stftPower` of 22 050 samples has `1 + floor(22050/512) = 44` frames of length 1025;
  - `melFilterbank(22050)` has 128 rows of 1025, every row has a positive sum, row peaks increase
    monotonically;
  - `mfcc` of a 1 s 1 kHz sine → 44 × 40 and all finite;
  - **Review Focus 2:** `mfcc` of 1 s of zeros → all finite, coefficient 0 equal across frames; `cmvn` of a
    constant matrix → all zeros (finite);
  - `deltas` of a feature rising by 1 per frame → interior values 1 ± 1e-6;
  - `cmvn` output: per-column mean |m| < 1e-5 and std within 1e-3 of 1.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Parity check against librosa** (local, not CI). Write `scripts/dsp-parity.py` (run with
  `backend/venv/bin/python -I`). It writes `/tmp/respinet-parity.json` with librosa's MFCC (40 × frames, CMVN off) for
  `backend/dataset/ICBHI_as_folders/copd/218_1b1_Al_sc_Meditron.wav` loaded at 22 050 Hz. Then add
  `dsp.parity.test.ts`, which skips when the file is absent, and assert mean absolute difference < 0.5 dB-units
  on coefficients 1–12 over the same input samples (pass the decoded samples through the JSON too). Record the
  measured number in the commit message.
- [ ] **Step 4:** Commit `feat(frontend): browser DSP mirroring the server's MFCC settings`.

### Task 6: Analysis pipeline, worker and decoding

**Files:**
- Create: `src/lib/audio/{windows.ts,analyze.ts,worker.ts,decode.ts,analyze.test.ts}`,
  `src/hooks/useAudioAnalysis.ts`

**Interfaces:**
- Consumes: Task 5 functions.
- Produces:
  - `frameCount(nSamples: number, hop = 512): number` = `1 + Math.floor(nSamples / hop)`;
  - `windowStarts(totalFrames: number, maxLen = 200, hop = 100): number[]` (starts every `hop` while a full
    window fits, plus a final start anchored at `totalFrames - maxLen`; `[0]` when
    `totalFrames <= maxLen`, as `preprocessing.window_feature_sequence`);
  - `type AudioAnalysis = { durationS: number; sampleRate: number; waveform: Float32Array; filtered: Float32Array; spectrogramDb: Float32Array[]; features: Float32Array[]; windowStarts: number[] }`.
    `waveform` and `filtered` are min/max peak pairs, 1 200 points; `spectrogramDb` is mel dB averaged down to
    ≤ 400 frames; `features` is frames × 120 (MFCC, Δ, Δ², then CMVN);
  - `analyze(samples: Float32Array, sr: number): AudioAnalysis` (pure);
  - `decodeTo22050(file: Blob): Promise<Float32Array>` (an `OfflineAudioContext` at 22 050 Hz, mono mix);
  - `useAudioAnalysis(file: Blob | null): { status: "idle"|"decoding"|"analysing"|"done"|"error"; result?: AudioAnalysis; error?: string }`
    (runs `analyze` in `worker.ts` via `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`).

- [ ] **Step 1: Failing tests** (`analyze.test.ts`):
  - `frameCount(Math.round(71.05 * 22050)) === 3060` and
    `windowStarts(3060).length === SAMPLE.windows_analyzed` (30, the server's value);
  - `windowStarts(3060).at(-1) === 2860`;
  - **Review Focus 1:** a 1 s noise clip → `windowStarts(frameCount(22050))` equals `[0]`, and `analyze`
    returns `features.length === 44` with all values finite;
  - **Review Focus 2:** `analyze` of 2 s of zeros returns finite arrays throughout;
  - `analyze(...).waveform.length === 2400` (1 200 min/max pairs).
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): audio analysis pipeline in a worker`.

### Task 7: Scene engine and presenter mode

**Files:**
- Create: `src/features/story/{timeline.ts,useStoryTimeline.ts,StoryShell.tsx}`,
  `src/features/story/presenter/{presenterStore.ts,usePresenterKeys.ts,ProgressStrip.tsx,presenter.test.ts}`,
  `src/hooks/useReducedMotion.ts`

**Interfaces:**
- Produces:
  - `SCENES: readonly { id: string; label: string }[]` (14 entries, ids `s00`…`s13`, in spec §4 order);
  - `registerScene(id: string, build: (tl: gsap.core.Timeline) => void): void`;
  - `<StoryShell>` (sets up Lenis + ScrollTrigger once, renders children and the `ProgressStrip`);
  - `usePresenter` (a zustand store) with state `{ active: boolean; index: number }` and actions
    `toggle()`, `exit()`, `next()`, `prev()`, `goTo(i: number)`. Indexes clamp to `[0, 13]`, and `goTo`
    scrolls to the scene's ScrollTrigger start through Lenis (`lenis.scrollTo(y, { duration: 0.9 })`; a new
    call retargets the running tween);
  - `handlePresenterKey(e: KeyboardEvent, store): boolean` (pure, returns whether it handled the key);
  - `useReducedMotion(): boolean`.
- Keys: `p`/`P` toggle; while active `ArrowRight`, `PageDown`, space → `next`; `ArrowLeft`, `PageUp` →
  `prev`; `Home`/`End` → first/last; `Escape` → `exit`. With reduced motion, scenes are not scrubbed; each
  scene's timeline plays once on enter (cross-fade).

- [ ] **Step 1: Failing tests** (`presenter.test.ts`):
  - `next()` 20 times from 0 → index 13; `prev()` at 0 → 0;
  - `handlePresenterKey` with `p` toggles `active`;
  - **Review Focus 5:** the key is ignored (returns false, no state change) when `e.target` is an `INPUT`,
    `TEXTAREA`, `SELECT` or `[contenteditable]`, or for space when the target is a `BUTTON`; with
    `e.repeat === true` only one step occurs per 250 ms (fake timers);
  - keys other than `p` do nothing while `active === false`.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): scene timeline and presenter mode`.

### Task 8: 3D stage with 2D fallback

**Files:**
- Create: `src/features/three/{StageCanvas.tsx,Lungs.tsx,NetworkFlow.tsx,FusionVote.tsx,Fallback2D.tsx,stage.ts,stage.test.tsx}`,
  `src/hooks/useWebGL.ts`

**Interfaces:**
- Consumes: `SAMPLE.members` (Task 3), `classColor` (Task 2), `usePresenter`/scroll progress (Task 7).
- Produces:
  - `stageFor(sceneId: string): "lungs" | "network" | "fusion" | null` (`s00` → lungs, `s06` → network,
    `s08` → fusion, all other scenes → null);
  - `useStage` (a zustand store) with `{ group, progress }` set by the 3D scenes' ScrollTriggers;
  - `<Stage/>`, which lazy-imports `StageCanvas` (`React.lazy`) only when `useWebGL()` is true and not
    reduced motion, and otherwise renders `<Fallback2D group={group}/>`;
  - `useWebGL(): boolean`.
- Visual spec:
  - *Lungs:* two lobes built procedurally from deformed `SphereGeometry` (right lobe slightly larger, a medial
    notch), a translucent `MeshPhysicalMaterial` (transmission 0.6, roughness 0.35, colour `#e7eed9`), a
    bronchial tree of `TubeGeometry` branches in `#198076` grown by L-system depth 4, a breathing scale of
    ±4% at 0.25 Hz, and sound rings (expanding `RingGeometry`, `#93d52a`, opacity fading).
  - *NetworkFlow:* five labelled slabs (Multi-scale conv, BiGRU-128, BiGRU-64, Dual pooling, Dense) with
    particles flowing left to right driven by `progress`, a residual arc bypassing BiGRU-128, and five output
    bars.
  - *FusionVote:* four pillars labelled RespiNet / YAMNet / OPERA-CE / HeAR whose heights are the sample's
    member top scores, coloured by each member's top class, converging into one fused bar of 87.0%.
  - Soft studio lighting on the paper background; `frameloop="demand"`; `dpr={[1, 1.75]}`.
  - When `group` is `null` the canvas is hidden and invalidates no frames (zero GPU work between 3D scenes).

- [ ] **Step 1: Failing tests** (`stage.test.tsx`): `stageFor` for all 14 ids; with `group === null` the canvas wrapper has `hidden`; with `useWebGL` mocked
  false, `<Stage/>` renders `Fallback2D` (`data-testid="stage-fallback"`) and never imports `three`
  (`vi.mock("three", () => { throw new Error("imported") })`); `Fallback2D group="fusion"` shows the four
  member names and `"87.0%"`.
- [ ] **Step 2:** FAIL → implement → PASS. Visual check: `npm run dev`, scroll through scenes 0, 6 and 8, and
  screenshot each (Task 15 automates this). Commit `feat(frontend): 3D stage with 2D fallback`.

### Task 9: Scenes 0–5 (opening to fingerprint)

**Files:**
- Create: `src/features/story/scenes/{S00Opening,S01Listening,S02Data,S03Cleaning,S04Slicing,S05Fingerprint}.tsx`,
  `src/features/story/scenes/{scenes-a.test.tsx,charts/DotField.tsx,charts/SpectrumBand.tsx,charts/WindowSlider.tsx,charts/FeatureHeatmap.tsx}`,
  `src/pages/StoryPage.tsx` (replaces the placeholder)

**Interfaces:**
- Consumes: `SceneFrame` and the components (Task 2), `FACTS`/`WHY` (Task 3), `registerScene` (Task 7),
  `<Stage/>` (Task 8), `analyze` (Task 6) on the bundled scene-1 clip (Task 14) for the real waveforms in
  scenes 3–5. Until Task 14, use a synthetic breath signal.
- Scene content is the spec §4 table rows 0–5. Animations: S02 dots (one per patient, 244) split into three
  bins 146/49/49, coloured by source; S03 spectrum with the 100–2,000 Hz band shading in and the outside
  fading; S04 a 200-frame window sliding by 100 over the waveform; S05 spectrogram → 128 mel rows → 40 MFCC
  rows morph, with Δ and Δ² stacking into 120.

- [ ] **Step 1: Failing test** (`scenes-a.test.tsx`; GSAP mocked to a no-op timeline): rendering
  `<StoryPage/>` shows, in order, the texts "How a machine listens to your lungs",
  "research prototype, not a diagnostic device", "1,551", "244", "146", "100–2,000 Hz", "200 frames",
  "120"; every scene from s00 to s05 has a non-empty screen-reader summary; S05 shows
  "Approximation of the server's features".
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): scenes 0–5`.

### Task 10: Scenes 6–10 (network to abstention)

**Files:**
- Create: `src/features/story/scenes/{S06Network,S07Seeds,S08Vote,S09Confidence,S10Abstain}.tsx`,
  `charts/ReliabilityChart.tsx`, `charts/AbstainGauge.tsx`, `scenes-b.test.tsx`

**Interfaces:**
- Consumes: as Task 9; `SAMPLE.members`.
- Content: spec §4 rows 6–10.
  - *S08:* shows each member's name, its one-line description (RespiNet "our network · MFCC fingerprint",
    YAMNet "Google · everyday sounds", OPERA-CE "pretrained on breathing sounds", HeAR "Google · health
    acoustics"), its top class and score, then "3 of 4 agree" and the fused "copd 87.0%"; its *why* is
    `WHY.fusion`.
  - *S09:* a reliability chart (one series, accent colour, diagonal reference) built from the test-set
    calibration bins, if `test_metrics.json` exposes them. Otherwise a schematic labelled "Illustration",
    with the real ECE and NLL numbers.
  - *S10:* a gauge with the two thresholds and the sample's position (87.0 / 0.30).

- [ ] **Step 1:** Check whether `backend/artifacts/latest/test_metrics.json` has reliability bins
  (`grep -n "bins\|reliability" …`). Record the choice in the S09 file header comment.
- [ ] **Step 2: Failing test** (`scenes-b.test.tsx`): texts "458,701", "42, 43, 44", "56.7%" (OPERA-CE),
  "3 of 4 agree", "87.0%", "0.5489", "66.3%", "0.51"; S06 and S08 carry "Illustration" (S08's 3D only; its
  numbers are real); no text matches `/diagnos|detects/i`.
- [ ] **Step 3:** FAIL → implement → PASS. Commit `feat(frontend): scenes 6–10`.

### Task 11: Scenes 11–13 (challenges, performance, end to end)

**Files:**
- Create: `src/features/story/scenes/{S11Challenges,S12Performance,S13EndToEnd}.tsx`,
  `src/content/challenges.ts`, `scenes-c.test.tsx`

**Interfaces:**
- Produces: `CHALLENGES: { id: string; problem: string; fix: string; source: string }[]`, six entries in spec
  §4 scene 11 order, numbers taken from `FACTS`.
- Content: spec §4 rows 11–13. S11 cards flip from problem to fix as the scene scrolls (a stagger of 0.15).
  S12 shows "75.5%" with "on 49 unseen patients from the same datasets", the CI 63.3–87.8%, balanced
  accuracy 74.9% and a per-class recall bar list from `test_metrics.json` (copied into `FACTS` in Task 3 if
  missing: add a `perClassRecallPatient` fact then). S13 is an animated pipeline strip that runs on `SAMPLE`:
  71 s → 22.05 kHz / 16 kHz → band-pass → 30 windows → 200 × 120 → 3 RespiNets + 3 embedding models → 4
  member scores → fusion → T 0.5489 → check → "Strongest match: COPD". It ends with a "Try it with your own
  recording" button to `/analyze`.

- [ ] **Step 1: Failing test** (`scenes-c.test.tsx`): six challenge cards, each with a problem and a fix;
  the texts "631", "1,211", "401", "316", "27–29%" and "41% → 59%" appear; "75.5%" and "on 49 unseen patients
  from the same datasets" are in the same element; S13 shows "30 windows" and "Strongest match: COPD"; no
  card mentions other hospitals or children (`/hospital|children|SPRSound/i` absent).
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): scenes 11–13`.

### Task 12: Result view (story report)

**Files:**
- Create: `src/features/analyzer/{result.ts,ResultView.tsx,Verdict.tsx,MemberVotes.tsx,WindowStrip.tsx,AllScores.tsx,result.test.ts,ResultView.test.tsx}`

**Interfaces:**
- Consumes: `PredictResult`, `MemberScore` (Task 4); `ScoreBar`, `Ring`, `Legend`, `classColor` (Task 2).
- Produces (`result.ts`, pure):
  - `topClass(p: Record<string, number>): string`;
  - `topTwo(p): [string, string]`;
  - `agreement(r: PredictResult): { agree: number; total: number } | null` (`null` without members; compares
    each member's top class with `r.model_prediction`);
  - `leadingPerWindow(r): string[] | null`;
  - `windowCounts(r): Record<string, number> | null`;
  - `formatDuration(s: number): string` (`71.05 → "1:11"`);
  - `plainSentence(r): string`.
- Produces: `<ResultView result={r} onExplain?={() => void} />`. Its sections reveal in order on scroll
  (Motion `whileInView`): Verdict → votes → window strip → all scores. The window-strip caption is exactly
  "RespiNet's reading of each window".

- [ ] **Step 1: Failing tests.**
  - `result.test.ts` on `SAMPLE`: `agreement` → `{agree: 3, total: 4}`; `windowCounts` →
    `{copd: 25, healthy: 5}`; `formatDuration(71.05) === "1:11"`; `topTwo(SAMPLE.probabilities)` →
    `["copd", "healthy"]`.
  - `ResultView.test.tsx`: renders "COPD", "87%", "3 of 4 agree", "RespiNet's reading of each window",
    "research prototype, not a diagnostic device".
  - **Review Focus 3:** with `{...SAMPLE, prediction: "uncertain", uncertain: true}` it renders
    "The model isn't sure", "copd" and "healthy" as the two closest, and the thresholds (66.3%, 0.51); there is
    no "UNCERTAIN" headline.
  - **Review Focus 4:** with `members` and `window_scores` deleted, it renders the verdict and all scores, and
    the vote and window sections are absent (no crash).
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): story-report result view`.

### Task 13: Analyzer flow

**Files:**
- Create: `src/features/analyzer/{Uploader.tsx,Recorder.tsx,DemoPicker.tsx,PipelineReplay.tsx,ExplainPanel.tsx,analyzerStore.ts,analyzer.test.tsx}`,
  `src/pages/AnalyzePage.tsx` (replaces the placeholder); story scene "Try it" mounts the same `<Analyzer/>`

**Interfaces:**
- Consumes: `predict`, `explain`, `getHealth`, `setMockMode`, the errors (Task 4); `useAudioAnalysis` (Task 6);
  `ResultView` (Task 12); the demo clips (Task 14: `DEMO_CLIPS` in `src/content/demoClips.ts`). Until Task 14
  lands, create `demoClips.ts` with one entry `{ id: "demo-copd", label: "COPD example", file: "", predictFile: "", source: "ICBHI", patientId: "102004" }`
  answered by `SAMPLE`; Task 14 overwrites the file.
- Produces: `useAnalyzer` (a zustand store) with
  `{ phase: "pick"|"running"|"done"|"error"; file?: Blob; name?: string; result?: PredictResult; error?: {kind: "offline"|"rejected"|"timeout"|"mic"; message: string} }`
  and actions `start(file, name)`, `startDemo(id)`, `reset()`.
- Behaviour:
  - accept `.wav .flac .ogg .mp3 .webm .m4a` (the `accept` attribute and an extension check before upload);
  - `PipelineReplay` animates waveform → filtered → windows → fingerprint from `useAudioAnalysis` while
    `predict` runs;
  - on mount, `getHealth()`; if it throws `OfflineError`, show the offline banner and the demo button before
    any upload;
  - on `OfflineError` show "The model is offline" with a "Use demo mode" button (`setMockMode(true)` then
    `startDemo`);
  - on `ApiError` show its message and the accepted formats;
  - on `TimeoutError` show a retry;
  - microphone denied → `kind: "mic"`, upload and demo stay enabled;
  - `ExplainPanel` calls `explain` on demand and shows the overlay image labelled
    "Where RespiNet listened (RespiNet only)".

- [ ] **Step 1: Failing tests** (`analyzer.test.tsx`, client mocked):
  - uploading `x.txt` shows the formats message without calling `predict`;
  - `getHealth` rejecting `OfflineError` on mount shows "The model is offline" before any upload;
  - `predict` rejecting `OfflineError` shows "The model is offline" and "Use demo mode", and clicking it shows
    the result;
  - `ApiError("Not a lung sound", 422)` shows that message;
  - a successful `predict` shows `ResultView`;
  - `getUserMedia` rejecting `NotAllowedError` shows the mic message and the upload remains enabled.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(frontend): analyzer flow with offline and demo modes`.

### Task 14: Demo and scene clips with recorded responses

**Files:**
- Create: `frontend/scripts/prepare_clips.py`, `frontend/public/audio/{scene1-normal,scene1-crackles,scene1-wheezes}.mp3`,
  `frontend/public/audio/demo-<class>.mp3` (5), `frontend/public/demo/demo-<class>.json` (5),
  `frontend/public/audio/CREDITS.md`, `src/content/demoClips.ts`, `src/content/demoClips.test.ts`

**Interfaces:**
- Produces: `DEMO_CLIPS: { id: "demo-asthma"|"demo-bronchial"|"demo-copd"|"demo-healthy"|"demo-pneumonia"; label: string; file: string; predictFile: string; source: string; patientId: string }[]`;
  `SCENE_CLIPS: { normal, crackles, wheezes }` (file paths).
- `prepare_clips.py` (run from the repo root with `backend/venv/bin/python -I frontend/scripts/prepare_clips.py`;
  needs `backend/dataset/` and a running server on :5001):
  - **Demo candidates:** rows of `backend/artifacts/latest/split_manifest.csv` with `split == "test"`
    (asthma 61, bronchial 17, copd 230, healthy 25, pneumonia 56 recordings available).
  - **Quality score per candidate:** peak < 0.99 full-scale (no clipping); RMS of the 100–2,000 Hz band ≥ 10×
    the RMS outside it; duration 8–90 s. Pick the highest-scoring recording per class, without looking at the
    model's answer.
  - **Scene-1 excerpts:** ICBHI `.txt` annotations (columns start, end, crackles, wheezes) from test-split
    ICBHI recordings; take one cycle run with `0 0`, one with `1 0`, one with `0 1`, 8–12 s, cut on cycle
    boundaries.
  - **Processing (ffmpeg):** `loudnorm=I=-20:TP=-2`, 50 ms fades in and out, mono 22 050 Hz MP3 at 96 kbps.
  - **Recorded responses:** POST each *processed* demo file to `http://127.0.0.1:5001/predict` and save the
    JSON to `public/demo/`.
  - **Provenance:** write `src/content/demoClips.ts` with each clip's source dataset, original file name and
    patient ID, and `CREDITS.md` naming ICBHI 2017, KAUH (Mendeley Data, doi:10.17632/jwyy9np4gv.3,
    CC BY 4.0) and Kaggle Asthma Detection V2.
- The page shows whatever answer the model gave; nothing is re-picked based on correctness.

- [ ] **Step 1: Failing test** (`demoClips.test.ts`): five demo clips, one per class; each `predictFile`
  exists under `public/demo/` and parses to a `PredictResult` with 4 members; every clip's `patientId`
  appears with `split === "test"` in a copy of the manifest rows saved by the script as
  `src/content/demoClips.provenance.json`.
- [ ] **Step 2:** Start the backend (`cd backend && source venv/bin/activate && python server.py`), run the
  script, stop the server (by port, never `pkill -f`). The test → PASS. Listen to all eight clips once and
  check each waveform in the UI.
- [ ] **Step 3:** Update `mock.ts` so `mockPredict(id)` returns the recorded response for that clip. Commit
  `feat(frontend): demo and scene clips with recorded real responses`.

### Task 15: End-to-end tests, Docker, documentation

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/{story.spec.ts,analyzer.spec.ts}`
- Modify:
  - `documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md` (entry before
    `## 9. Comprehensive Synthesis`);
  - `frontend/CLAUDE.md` (rewrite for the new app, in `frontend/`);
  - root `CLAUDE.md` (§1 table, §4 map, §8 `frontend/dist` and legacy notes);
  - `README.md` (frontend section);
  - `documentation/FRONTEND_REBUILD_BRIEF.md` (status: built).

**Interfaces:**
- Consumes: everything above.
- Playwright: `use.launchOptions.executablePath` from `process.env.CHROMIUM_PATH` when set (this machine:
  `~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`); the `webServer` runs `npm run preview`
  with `VITE_MOCK_API=1` built first.

- [ ] **Step 1: Write the e2e specs.**
  - `story.spec.ts`: `/` loads with no console errors and no request to a font CDN. Pressing `p` then
    `ArrowRight` 13 times reaches `data-scene="s13"` in view. `End`/`Home` work. Take a full-page screenshot
    of each scene into `e2e/__screenshots__/` (gitignored) for the visual review.
  - `analyzer.spec.ts` (mock): `/analyze` → pick "demo-copd" → the result shows "Strongest match", text matching
    `/\d of 4 agree/` and the strip legend. A reload of `/analyze` returns 200.
  - `analyzer.real.spec.ts`, skipped unless `E2E_REAL_BACKEND=1`: upload
    `backend/dataset/ICBHI_as_folders/copd/218_1b1_Al_sc_Meditron.wav` through the dev server and expect
    "87%".
- [ ] **Step 2:** Run `npm run e2e` → PASS. Run the real-backend spec with the server and dev server up →
  PASS, then stop both servers.
- [ ] **Step 3: Frame rate.** In `story.spec.ts` add `fps while scrolling 3D scenes`: count `requestAnimationFrame`
  callbacks for 3 s while `mouse.wheel` scrolls through s06 and s08; assert ≥ 50 fps on this machine and log the
  value. Before the presentation, repeat on the presenting laptop (`npm run e2e -- -g fps`).
- [ ] **Step 4:** Review the screenshots. Fix overlaps or overflow at 1280 × 800 and 1920 × 1080 (projector
  sizes) and at 390 × 844 (phone width, no horizontal scroll).
- [ ] **Step 5: Docker.**
  - Run `docker compose build frontend && docker compose up -d`.
  - Check that `curl -s -o /dev/null -w '%{http_code}' localhost:8080/analyze` returns 200 and
    `curl -X POST localhost:8080/explain` returns 400 from the backend.
  - Run `BASE=http://127.0.0.1:8080` against the real-backend spec, then `docker compose down`.
- [ ] **Step 6:** Write the docs. Run `npm run check:facts`, `npm run typecheck`, `npm run lint`,
  `npm test` and `npm run build`. From `backend/`, also run `venv/bin/ruff check .` and `venv/bin/pytest -q`.
  Commit `docs(frontend): new presentation frontend; e2e and Docker verified` together with `dist/`.
