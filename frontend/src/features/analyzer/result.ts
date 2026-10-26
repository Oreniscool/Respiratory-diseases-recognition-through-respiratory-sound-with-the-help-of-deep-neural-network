import type { PredictResult } from "../../lib/api/types";
import { memberTop } from "../../content/members";

type Scores = Record<string, number>;

const ranked = (p: Scores) => Object.entries(p).sort((a, b) => b[1] - a[1]);

export const topClass = (p: Scores): string => ranked(p)[0]![0];

export const topTwo = (p: Scores): [string, string] => {
  const [a, b] = ranked(p);
  return [a![0], b![0]];
};

/** How many fusion members' own top class matches the fused answer; null without member scores. */
export function agreement(r: PredictResult): { agree: number; total: number } | null {
  if (!r.members?.length) return null;
  const agree = r.members.filter((m) => memberTop(m).label === r.model_prediction).length;
  return { agree, total: r.members.length };
}

/** The leading class of each window (RespiNet ensemble); null without window scores. */
export function leadingPerWindow(r: PredictResult): string[] | null {
  if (!r.window_scores?.length) return null;
  return r.window_scores.map(topClass);
}

export function windowCounts(r: PredictResult): Record<string, number> | null {
  const leading = leadingPerWindow(r);
  if (!leading) return null;
  return leading.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One plain-language sentence for the verdict (research wording only). */
export function plainSentence(r: PredictResult): string {
  const [first, second] = topTwo(r.probabilities);
  if (r.uncertain) {
    return `The model is not sure: this recording sits between ${first.toUpperCase()} and ${second.toUpperCase()}, so it holds back instead of guessing.`;
  }
  const lead = `This recording sounds most like the ${r.model_prediction.toUpperCase()} recordings the model learned from.`;
  const votes = agreement(r);
  return votes
    ? `${lead} ${votes.agree} of ${votes.total} models point the same way, and the score is confident enough for the model to answer.`
    : `${lead} The score is confident enough for the model to answer.`;
}
