# Story expansion: a full-length presentation (addendum to 2026-10-26 design)

**Date:** 2026-11-03 · **Branch:** `story-expansion` (off `frontend-rebuild`) · **Status:** implemented

## Why

The 14-scene story went straight to the pipeline. The team presents the whole project to a panel in about 20 minutes,
so the story now tells it from the start, with the same kind of interactive infographics. Only content was added; the
design system, presenter keys, 3D scenes and analyzer are unchanged.

## Decisions (user, 2026-11-03)

- Add a **full chapter on the paper** (the Kaggle–ICBHI copy audit).
- **Open with the origin**: the 2020 paper's reported 95.67% and an interactive leak ladder.
- **Successes only**, as before: no limitations scene, nothing about other hospitals, children or SPRSound.
- Talking points are written separately, later.

## Structure

30 scenes in five chapters (`CHAPTERS` / `SCENES` in `frontend/src/features/story/scenes.ts`):

| Chapter | Scenes (new in bold) |
|---|---|
| 1 · Where it began | s00 Opening, s01 Listening, **origin**, **leaks**, **patients** |
| 2 · The discovery | **classes**, **match**, **gap**, **provenance**, **oneRecording**, **checks**, **consequence**, **paper** |
| 3 · From sound to features | s02 Data, s03 Cleaning, s04 Slicing, s05 Fingerprint |
| 4 · The model | s06 Network, **training**, **learning**, s07 Seeds, **selection**, s08 Vote, s09 Confidence, s10 Abstain |
| 5 · Results and the system | s11 Challenges, s12 Performance, **server**, s13 End to end, **takeaways** |

The original ids s00–s13 keep their ids and relative order. Eyebrows are generated ("Chapter n · …"); the presenter
strip groups the dots by chapter.

## Interactions

Leak ladder (split unit × checkpoint selection), patient split (random vs by patient), class Sankey (highlight) with an
"add Kaggle" toggle, a draggable |NCC| matcher (illustration), the NCC histogram (hover), provenance by class (select),
one recording's copies (point), C4 contrasts (two tabs), training curves (epoch slider), focal-loss γ slider,
SpecAugment reshuffle (illustration), model-selection variants (select), the server request path (click).
All controls are native buttons, checkboxes and range inputs, so the presenter keys still work.

## Data and checks

- Every new number is a `FACTS` entry with its source; research numbers come from tracked evidence
  (`research/EXPERIMENT_LEDGER.csv`, `research/CLAIM_EVIDENCE_MATRIX.csv`, `backend/data/*`, backend source constants).
- `frontend/scripts/story_data.py` writes `frontend/src/content/story-data.json` (histogram, the most-copied recording,
  the seed-42 training curve).
- `frontend/src/content/story.sources.test.ts` re-derives every new fact and the generated arrays; artifact-only checks
  skip without `backend/artifacts/latest`.
- `scenes-d.test.tsx` / `scenes-e.test.tsx` cover content, interactions, page order = `SCENES`, and the wording guard
  on every scene.

## Follow-up (same day): transitions, more 3D, repetition review

- **3D where it helps reading:** the leak ladder as a 3D bar grid (two factors at once: split unit × where the checkpoint
  is chosen, with the chance level as a plane) and the fingerprint as a landscape of one real window that morphs through
  mel → MFCC → full features. Both keep 2D fallbacks.
- **Transitions:** chapter cards at chapters 2–5, count-up numbers, visual slide-in; all in `timeline.ts`, all skipped
  with reduced motion.
- **No repetition:** duplicated notes removed, "Problems we fixed" narrowed to problems not told elsewhere, the server
  scene narrowed to its safety checks; a test guards against repeated paragraphs.
