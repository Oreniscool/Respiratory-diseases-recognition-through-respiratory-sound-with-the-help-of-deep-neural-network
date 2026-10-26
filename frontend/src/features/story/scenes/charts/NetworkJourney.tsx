import { useMemo, type ReactNode } from "react";
import { Glyph, type GlyphName } from "../../../../components/glyphs";
import { classColor } from "../../../../components/classColors";
import { LAYER_COLORS } from "../../../three/layerColors";
import type { AudioAnalysis } from "../../../../lib/audio/analyze";
import { FeatureHeatmap } from "./FeatureHeatmap";
import { NetworkGraph } from "./NetworkGraph";

const FRAMES = 200;
const KERNELS = [3, 5, 11];
const CELLS = 20;

const normalise = (v: number[]) => {
  const hi = Math.max(...v, 1e-9);
  return v.map((x) => x / hi);
};
const movingAverage = (v: number[], k: number) =>
  v.map((_, t) => {
    const a = Math.max(0, t - (k >> 1)), b = Math.min(v.length, t + (k >> 1) + 1);
    let s = 0;
    for (let i = a; i < b; i++) s += v[i]!;
    return s / (b - a);
  });

function Row({ glyph, title, detail, children }: { glyph: GlyphName; title: string; detail: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-paper-raised text-ink" style={{ borderColor: LAYER_COLORS[glyph] }}>
          <Glyph name={glyph} size={15} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-semibold text-ink">{title}</span>
          <span className="block text-[11.5px] text-ink-muted">{detail}</span>
        </span>
      </div>
      <div className="relative min-w-0">{children}</div>
    </div>
  );
}

/**
 * Scene 6: one real window of a recording followed through RespiNet, under an animated graph of the network. The
 * final scores are real (RespiNet's recorded reading of that window); the middle rows illustrate what each layer does
 * to the time axis, derived from how fast the window's fingerprint changes, not from the network's activations.
 */
export function NetworkJourney({ analysis, windowIndex, windowCount, scores }: {
  analysis: AudioAnalysis; windowIndex: number; windowCount: number; scores: Record<string, number>;
}) {
  const data = useMemo(() => {
    const start = analysis.windowStarts[windowIndex] ?? 0;
    const window = analysis.features.slice(start, start + FRAMES);
    // how much the fingerprint changes from one frame to the next
    const change = window.map((f, t) => {
      const prev = window[Math.max(0, t - 1)]!;
      let s = 0;
      for (let k = 0; k < f.length; k++) s += (f[k]! - prev[k]!) ** 2;
      return Math.sqrt(s);
    });
    change[0] = change[1] ?? 0;
    const strips = KERNELS.map((k) => normalise(movingAverage(change, k)).map((v) => Float32Array.of(v)));
    const per = Math.ceil(window.length / CELLS);
    const cells = normalise(Array.from({ length: CELLS }, (_, i) => {
      const part = change.slice(i * per, (i + 1) * per);
      return part.reduce((a, b) => a + b, 0) / Math.max(1, part.length);
    }));
    return { window, strips, cells };
  }, [analysis, windowIndex]);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const gru = LAYER_COLORS.gru128!, gru2 = LAYER_COLORS.gru64!;

  return (
    <div className="space-y-4">
      <NetworkGraph scores={scores} />
      <Row glyph="conv" title="Convolutions" detail="kernels of 3, 5, 11 frames">
        <div className="space-y-1">
          {data.strips.map((rows, i) => (
            <div key={KERNELS[i]} className="flex items-center gap-2">
              <span className="tabular w-5 text-right text-[11px] text-ink-muted">{KERNELS[i]}</span>
              <div className="relative h-3.5 min-w-0 flex-1">
                <div data-strip className="h-full overflow-hidden rounded-sm border border-line"><FeatureHeatmap rows={rows} /></div>
                {/* the kernel reading the window as it slides, at its true width (k of 200 frames) */}
                <span data-kernel data-w={(KERNELS[i]! / FRAMES) * 100} aria-hidden="true"
                      className="absolute -top-0.5 -bottom-0.5 left-0 rounded-[3px] border-2 border-ink bg-white/40"
                      style={{ width: `${(KERNELS[i]! / FRAMES) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Row>
      <Row glyph="gru128" title="Two BiGRUs" detail="read forwards, then backwards">
        <div className="flex h-12 gap-[3px]">
          {data.cells.map((v, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span data-fwd className="flex-1 rounded-t-[3px]" style={{ background: gru, opacity: 0.18 + 0.82 * v }} />
              <span data-bwd className="flex-1 rounded-b-[3px]" style={{ background: gru2, opacity: 0.18 + 0.82 * v }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-muted"><span>forwards →</span><span>← backwards</span></div>
      </Row>
      <Row glyph="pooling" title="Dual pooling" detail="time is summarised away">
        <div className="flex h-12 items-stretch gap-3">
          <div className="relative min-w-0 flex-1 border-b border-line">
            <span data-pooled-note className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-muted">
              {FRAMES} frames → one summary of the window
            </span>
            {data.cells.map((v, i) => (
              <span key={i} data-tick className="absolute bottom-0 w-[3%] rounded-t-sm"
                    style={{ left: `${(i / CELLS) * 100}%`, height: `${15 + 85 * v}%`, background: LAYER_COLORS.pooling }} />
            ))}
          </div>
          <div className="flex w-36 shrink-0 flex-col justify-center gap-1">
            <span data-pooled className="rounded-md border border-line bg-paper-raised px-2 py-0.5 text-center text-[11px] font-semibold text-ink">attention average</span>
            <span data-pooled className="rounded-md border border-line bg-paper-raised px-2 py-0.5 text-center text-[11px] font-semibold text-ink">strongest moment</span>
          </div>
        </div>
      </Row>
      <Row glyph="dense" title="Dense layers" detail="one score per class">
        <ul className="m-0 list-none space-y-1 p-0">
          {ranked.map(([label, value]) => (
            <li key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[12.5px] text-ink">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: classColor(label) }} />{label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-track">
                <span data-bar className="block h-full rounded-full" style={{ width: `${Math.max(1, value)}%`, background: classColor(label) }} />
              </span>
              <span data-score className="tabular text-right">{value.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </Row>
      <p className="m-0 text-xs text-ink-muted">
        A COPD example from a test-split patient, window {windowIndex + 1} of {windowCount}. The scores are real (RespiNet's
        recorded reading of this window); the graph shows a few neurons per layer, and the rows illustrate what each layer
        does to time.
      </p>
    </div>
  );
}
