import type { BreathKind } from "../lib/audio/synthetic";
import clips from "./clips.json";

/** Scene 1 clips: annotated ICBHI excerpts from test-split patients (frontend/scripts/prepare_clips.py). */
export const SCENE_CLIPS: { id: BreathKind; label: string; description: string; file: string | null }[] = [
  { id: "normal", label: "A normal breath", description: "Smooth airflow in and out.", file: clips.scene.normal ?? null },
  { id: "crackles", label: "Crackles", description: "Short popping bursts, often while breathing in.", file: clips.scene.crackles ?? null },
  { id: "wheezes", label: "Wheezes", description: "Continuous, musical tones.", file: clips.scene.wheezes ?? null },
];
