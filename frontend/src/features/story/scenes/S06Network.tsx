import { useEffect, useState } from "react";
import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, WHY } from "../../../content/facts";
import { DEMO_CLIPS } from "../../../content/demoClips";
import { Glyph, type GlyphName } from "../../../components/glyphs";
import type { PredictResult } from "../../../lib/api/types";
import { LAYER_COLORS } from "../../three/layerColors";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useClipAudio } from "../useSceneAudio";
import { NetworkJourney } from "./charts/NetworkJourney";

const STEPS: { title: string; text: string; glyphs: GlyphName[] }[] = [
  { title: "Multi-scale convolutions", text: "kernels of 3, 5 and 11 frames pick out short and longer sound patterns", glyphs: ["conv"] },
  { title: "BiGRU-128", text: "reads the window forwards and backwards in time", glyphs: ["gru128"] },
  { title: "BiGRU-64 and dual pooling", text: "summarise the whole window into one description", glyphs: ["gru64", "pooling"] },
  { title: "Dense layers", text: "turn that description into five scores", glyphs: ["dense"] },
];

const CLIP = DEMO_CLIPS.find((c) => c.id === "demo-copd") ?? null;
/** the second window: a full 200-frame window from inside the recording */
const WINDOW = 1;

export function S06Network() {
  const analysis = useClipAudio(CLIP?.file ?? null);
  const [result, setResult] = useState<PredictResult | null>(null);
  useEffect(() => {
    if (!CLIP) return;
    let cancelled = false;
    fetch(CLIP.predictFile).then((r) => r.json()).then((r: PredictResult) => { if (!cancelled) setResult(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const windowIndex = Math.min(WINDOW, (result?.window_scores?.length ?? 1) - 1);
  const scores = result?.window_scores?.[windowIndex];

  const ref = useSceneTimeline<HTMLElement>("s06", (tl, root) => {
    const q = (s: string) => root.querySelectorAll(s);
    tl.from(q("[data-step]"), { x: -16, opacity: 0.25, stagger: 0.3, duration: 0.4 }, 0);
    if (!q("[data-col]").length) return;
    // light up graph column c while its row below is being explained
    const lit = (c: number, at: string | number = "<") => tl.to(q(`[data-col="${c}"] [data-halo]`), { opacity: 0.22, duration: 0.3 }, at);
    const unlit = (c: number) => tl.to(q(`[data-col="${c}"] [data-halo]`), { opacity: 0, duration: 0.3 }, ">");
    // the graph builds column by column: neurons appear, then the edges to the next layer draw in
    q("[data-col]").forEach((col, c) => {
      tl.from(col.querySelectorAll("[data-node]"), { opacity: 0, scale: 0.4, transformOrigin: "center", stagger: 0.02, duration: 0.2 }, c ? ">-0.08" : 0);
      const edges = root.querySelector(`[data-edges="${c}"]`);
      if (edges) tl.fromTo(edges.querySelectorAll("line"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.25, ease: "none" }, ">-0.08");
    });
    tl.from(q("[data-pulses]"), { opacity: 0, duration: 0.4 }, ">-0.1")
      // the three kernels slide across the window while their pattern strips fill in
      .from(q("[data-kernel]"), { opacity: 0, duration: 0.25 });
    lit(1);
    tl.fromTo(q("[data-kernel]"), { left: "0%" }, { left: (_: number, el: HTMLElement) => `${100 - Number(el.dataset.w)}%`, duration: 1.2, ease: "none" }, "<")
      .from(q("[data-strip]"), { clipPath: "inset(0 100% 0 0)", duration: 1.2, ease: "none" }, "<")
      .to(q("[data-kernel]"), { opacity: 0, duration: 0.25 });
    unlit(1);
    // the GRUs read forwards, then backwards
    lit(2);
    tl.from(q("[data-fwd]"), { opacity: 0, stagger: 0.03, duration: 0.2 }, "<");
    unlit(2);
    lit(3);
    tl.from(q("[data-bwd]"), { opacity: 0, stagger: { each: 0.03, from: "end" }, duration: 0.2 }, "<");
    unlit(3);
    // pooling folds the time axis into one summary
    lit(4);
    tl.from(q("[data-tick]"), { opacity: 0, duration: 0.3 }, "<")
      .to(q("[data-tick]"), { left: "97%", opacity: 0, stagger: { each: 0.015, from: "end" }, duration: 0.5, ease: "power2.in" })
      .from(q("[data-pooled]"), { opacity: 0, scale: 0.7, stagger: 0.12, duration: 0.3 })
      .from(q("[data-pooled-note]"), { opacity: 0, duration: 0.3 }, "<");
    unlit(4);
    // the dense layers give the five scores
    lit(5);
    lit(6, "<");
    tl.from(q("[data-bar]"), { scaleX: 0, transformOrigin: "left center", stagger: 0.07, duration: 0.5 }, "<")
      .from(q("[data-score]"), { opacity: 0, stagger: 0.07, duration: 0.3 }, "<");
    unlit(5);
    tl.to(q(`[data-col="6"] [data-halo]`), { opacity: 0, duration: 0.3 }, "<");
  }, { deps: [analysis, scores] });

  return (
    <SceneFrame ref={ref} id="s06" label="Inside RespiNet" illustration
      summary="One 4.6-second window of a COPD example followed through RespiNet: its 200 by 120 fingerprint, multi-scale convolutions, two bidirectional GRUs, dual pooling that removes time, and dense layers giving RespiNet's five scores for that window.">
        <SceneColumns eyebrow="Step 6 · The network" title="Inside RespiNet"
          visual={analysis && scores && (
            <NetworkJourney analysis={analysis} windowIndex={windowIndex} windowCount={result?.window_scores?.length ?? 1} scores={scores} />
          )}>
          <ol className="m-0 list-none space-y-3 p-0">
            {STEPS.map((s) => (
              <li key={s.title} data-step className="flex gap-3">
                <span className="mt-0.5 flex shrink-0 gap-1">
                  {s.glyphs.map((g) => (
                    <span key={g} className="flex size-7 items-center justify-center rounded-full border-2 bg-paper-raised text-ink" style={{ borderColor: LAYER_COLORS[g] }}>
                      <Glyph name={g} size={16} />
                    </span>
                  ))}
                </span>
                <span><strong>{s.title}</strong> {s.text}.</span>
              </li>
            ))}
          </ol>
          <Why>{WHY.residualSkip.text}</Why>
          <Why>{WHY.dualPooling.text}</Why>
          <p className="text-sm"><span className="tabular font-semibold text-ink">{FACTS.parameters.display}</span> learned parameters.</p>
        </SceneColumns>
    </SceneFrame>
  );
}
