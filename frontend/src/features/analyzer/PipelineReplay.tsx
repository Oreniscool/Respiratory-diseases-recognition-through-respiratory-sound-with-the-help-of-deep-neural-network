import { motion } from "motion/react";
import { useAudioAnalysis } from "../../hooks/useAudioAnalysis";
import { Waveform } from "../story/scenes/charts/Waveform";
import { FeatureHeatmap } from "../story/scenes/charts/FeatureHeatmap";

/** While the model runs: the visitor's own recording passing through the browser-side steps. */
export function PipelineReplay({ file }: { file: Blob }) {
  const analysis = useAudioAnalysis(file);
  const a = analysis.result;
  const status = analysis.status === "decoding" ? "Reading your recording…"
    : analysis.status === "analysing" ? "Computing the fingerprint in your browser…"
    : analysis.status === "error" ? "Your recording can't be drawn here, but the model still receives it."
    : "Waiting for the model…";
  const step = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.25 * i, duration: 0.5 } });
  return (
    <div className="space-y-5" aria-live="polite">
      <p className="m-0 flex items-center gap-2 text-ink"><span className="size-2 animate-pulse rounded-full bg-accent" />{status}</p>
      {a && (
        <div className="grid gap-5">
          <motion.div {...step(0)}><p className="mb-1 text-sm font-semibold text-ink">Your recording · {a.durationS.toFixed(1)} s</p><Waveform peaks={a.waveform} height={70} color="#9aa58a" /></motion.div>
          <motion.div {...step(1)}><p className="mb-1 text-sm font-semibold text-ink">After the 100–2,000 Hz band-pass</p><Waveform peaks={a.filtered} height={70} /></motion.div>
          <motion.div {...step(2)}><p className="m-0 text-sm text-ink"><strong className="tabular">{a.windowStarts.length}</strong> window{a.windowStarts.length === 1 ? "" : "s"} of 200 frames</p></motion.div>
          <motion.div {...step(3)} className="space-y-1">
            <p className="m-0 text-sm font-semibold text-ink">The fingerprint (120 numbers per frame)</p>
            <div className="h-40 overflow-hidden rounded-lg border border-line"><FeatureHeatmap rows={a.features} /></div>
            <p className="m-0 text-xs text-ink-muted">Computed in your browser: an approximation of the server's features.</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
