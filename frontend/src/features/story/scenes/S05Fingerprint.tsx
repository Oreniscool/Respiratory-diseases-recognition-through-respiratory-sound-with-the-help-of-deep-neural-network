import { useMemo } from "react";
import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { FACTS } from "../../../content/facts";
import { mfccFromLogMel } from "../../../lib/audio/mfcc";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useSceneAudio } from "../useSceneAudio";
import { FeatureHeatmap } from "./charts/FeatureHeatmap";

const STAGES = [
  { id: "mel", title: `${FACTS.nMels.display} mel bands`, detail: "how loud each pitch band is, frame by frame" },
  { id: "mfcc", title: `${FACTS.nMfcc.display} MFCCs`, detail: "the shape of the spectrum, compressed" },
  { id: "full", title: `+ Δ and Δ²: ${FACTS.featuresPerFrame.display} numbers per frame`, detail: "how the shape changes, and how fast; normalised per recording (CMVN)" },
];

export function S05Fingerprint() {
  const { analysis } = useSceneAudio("normal");
  const mfcc = useMemo(() => (analysis ? mfccFromLogMel(analysis.spectrogramDb) : []), [analysis]);
  const ref = useSceneTimeline<HTMLElement>("s05", (tl, root) => {
    const layers = root.querySelectorAll("[data-layer]");
    const labels = root.querySelectorAll("[data-stage]");
    layers.forEach((layer, i) => {
      if (i === 0) return;
      tl.to(layers[i - 1]!, { opacity: 0, duration: 0.5 }, "+=0.4")
        .fromTo(layer, { opacity: 0, scaleY: 0.6 }, { opacity: 1, scaleY: 1, duration: 0.6 }, "<")
        .to(labels[i - 1]!, { opacity: 0.35, duration: 0.3 }, "<")
        .fromTo(labels[i]!, { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, "<");
    });
  }, { length: 200, deps: [analysis] });
  return (
    <SceneFrame ref={ref} id="s05" label="The sound fingerprint" summary="The spectrogram becomes 128 mel bands, then 40 MFCCs, then 120 numbers per frame with their rates of change.">
        <SceneColumns eyebrow="Step 5 · Features" title="The sound fingerprint"
          visual={analysis && (
            <div className="space-y-4">
              <div className="relative h-64 overflow-hidden rounded-xl border border-line bg-paper-raised">
                <div data-layer className="absolute inset-0 origin-bottom"><FeatureHeatmap rows={analysis.spectrogramDb} /></div>
                <div data-layer className="absolute inset-0 origin-bottom opacity-0"><FeatureHeatmap rows={mfcc} /></div>
                <div data-layer className="absolute inset-0 origin-bottom opacity-0"><FeatureHeatmap rows={analysis.features} /></div>
              </div>
              <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                {STAGES.map((s, i) => (
                  <li key={s.id} data-stage className={i === 0 ? "" : "opacity-35"}>
                    <div className="text-sm font-semibold text-ink">{s.title}</div>
                    <div className="text-xs text-ink-muted">{s.detail}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}>
          <p>
            Each window becomes a picture of the sound: a spectrogram (FFT {FACTS.nFft.display}, hop {FACTS.hopSamples.display}),
            squeezed into <strong>{FACTS.nMels.display} mel bands</strong> that space pitches the way hearing does, then
            summarised as <strong>{FACTS.nMfcc.display} MFCCs</strong>.
          </p>
          <p>
            Adding how those numbers change (Δ) and how fast that changes (Δ²) gives <strong>{FACTS.featuresPerFrame.display}</strong> numbers per
            frame: a 200 × 120 fingerprint per window.
          </p>
          <Badge>Approximation of the server's features</Badge>
        </SceneColumns>
    </SceneFrame>
  );
}
