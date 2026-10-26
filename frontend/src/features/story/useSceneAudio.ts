import { useEffect, useMemo, useState } from "react";
import { analyze, type AudioAnalysis } from "../../lib/audio/analyze";
import { syntheticBreath, type BreathKind } from "../../lib/audio/synthetic";
import { SCENE_CLIPS } from "../../content/sceneClips";
import { useAudioAnalysis } from "../../hooks/useAudioAnalysis";

const SR = 22050;

/** The analysis of a scene clip: the real recording when bundled, otherwise a synthetic illustration. */
export function useSceneAudio(kind: BreathKind = "normal"): { analysis: AudioAnalysis | null; synthetic: boolean } {
  const file = SCENE_CLIPS.find((c) => c.id === kind)?.file ?? null;
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    fetch(file).then((r) => r.blob()).then((b) => { if (!cancelled) setBlob(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [file]);
  const real = useAudioAnalysis(blob);
  const synthetic = useMemo(() => (file ? null : analyze(syntheticBreath(kind, 8, SR), SR)), [file, kind]);
  return { analysis: file ? real.result ?? null : synthetic, synthetic: !file };
}
