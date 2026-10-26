import { SAMPLE } from "../../content/facts";
import { DEMO_CLIPS } from "../../content/demoClips";
import type { Health, PredictResult } from "./types";

const recorded = new Map<string, Promise<PredictResult>>();

/** A demo clip's response recorded from the real model; the bundled sample for anything else. */
export async function mockPredict(clipId?: string): Promise<PredictResult> {
  const clip = DEMO_CLIPS.find((c) => c.id === clipId);
  if (!clip) return SAMPLE;
  let pending = recorded.get(clip.id);
  if (!pending) {
    pending = fetch(clip.predictFile).then((r) => {
      if (!r.ok) throw new Error(`recorded response missing: ${clip.predictFile}`);
      return r.json() as Promise<PredictResult>;
    });
    recorded.set(clip.id, pending);
  }
  return pending;
}

export function mockHealth(): Health {
  return { ready: true, model_contract: "verified-metadata", classes: Object.keys(SAMPLE.probabilities) };
}
