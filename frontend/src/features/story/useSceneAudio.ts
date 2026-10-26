import { useEffect, useState } from "react";
import type { AudioAnalysis } from "../../lib/audio/analyze";
import { analyzeInWorker } from "../../lib/audio/analyzeAsync";
import { ANALYSIS_RATE, decodeTo22050 } from "../../lib/audio/decode";
import { syntheticBreath, type BreathKind } from "../../lib/audio/synthetic";
import { SCENE_CLIPS } from "../../content/sceneClips";

const cache = new Map<string, Promise<AudioAnalysis>>();

/** One analysis per clip for the whole page, computed off the main thread. */
function loadSceneAudio(kind: BreathKind, file: string | null): Promise<AudioAnalysis> {
  const key = file ?? `synthetic:${kind}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const samples = file
        ? await decodeTo22050(await (await fetch(file)).blob())
        : syntheticBreath(kind, 8, ANALYSIS_RATE);
      return analyzeInWorker(samples, ANALYSIS_RATE);
    })();
    cache.set(key, pending);
  }
  return pending;
}

/** The analysis of a scene clip: the real recording when bundled, otherwise a synthetic illustration. */
export function useSceneAudio(kind: BreathKind = "normal"): { analysis: AudioAnalysis | null; synthetic: boolean } {
  const file = SCENE_CLIPS.find((c) => c.id === kind)?.file ?? null;
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSceneAudio(kind, file).then((a) => { if (!cancelled) setAnalysis(a); }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, file]);
  return { analysis, synthetic: !file };
}
