import { SAMPLE } from "../../content/facts";
import type { Health, PredictResult } from "./types";

/** Recorded real responses for the bundled demo clips, keyed by clip id (filled in by Task 14). */
const RECORDED: Record<string, PredictResult> = {};

export function registerRecorded(id: string, result: PredictResult): void {
  RECORDED[id] = result;
}

export async function mockPredict(clipId?: string): Promise<PredictResult> {
  return (clipId && RECORDED[clipId]) || SAMPLE;
}

export function mockHealth(): Health {
  return { ready: true, model_contract: "verified-metadata", classes: Object.keys(SAMPLE.probabilities) };
}
