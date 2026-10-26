import { useEffect, useRef } from "react";

/** Sequential single-hue ramp (paper → accent → deep accent) for a value in [0, 1]. */
const STOPS = [[247, 250, 240], [190, 230, 127], [25, 128, 118], [17, 85, 78]] as const;
function ramp(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i]!, b = STOPS[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** A frames × rows matrix drawn as a heatmap (low rows at the bottom). */
export function FeatureHeatmap({ rows, maxFrames = 400, className = "" }: { rows: Float32Array[]; maxFrames?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || rows.length === 0) return;
    const step = Math.max(1, Math.ceil(rows.length / maxFrames));
    const frames = Math.ceil(rows.length / step);
    const height = rows[0]!.length;
    el.width = frames;
    el.height = height;
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) for (const v of r) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const img = ctx.createImageData(frames, height);
    for (let f = 0; f < frames; f++) {
      const r = rows[f * step]!;
      for (let k = 0; k < height; k++) {
        const [cr, cg, cb] = ramp((r[k]! - lo) / (hi - lo || 1));
        const o = ((height - 1 - k) * frames + f) * 4;
        img.data[o] = cr; img.data[o + 1] = cg; img.data[o + 2] = cb; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [rows, maxFrames]);
  return <canvas ref={canvas} className={`block h-full w-full rounded-md [image-rendering:pixelated] ${className}`} aria-hidden="true" />;
}
