import type { BreathKind } from "../lib/audio/synthetic";

/** Scene 1 clips. `file` is set by Task 14 (real recordings); until then the visuals use synthetic audio. */
export const SCENE_CLIPS: { id: BreathKind; label: string; description: string; file: string | null }[] = [
  { id: "normal", label: "A normal breath", description: "Smooth airflow in and out.", file: null },
  { id: "crackles", label: "Crackles", description: "Short popping bursts, often while breathing in.", file: null },
  { id: "wheezes", label: "Wheezes", description: "Continuous, musical tones.", file: null },
];
