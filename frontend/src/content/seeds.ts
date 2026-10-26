import data from "./sample-seeds.json";

/** Each RespiNet seed's own reading of the sample recording, window by window (frontend/scripts/seed_windows.py). */
export type SeedReading = { seed: number; windowScores: Record<string, number>[] };

export const SEED_SOURCE: string = data.source;
export const SEED_READINGS: SeedReading[] = data.seeds.map((s) => ({ seed: Number(s.seed), windowScores: s.window_scores }));

export const topOf = (scores: Record<string, number>): [string, number] =>
  Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
