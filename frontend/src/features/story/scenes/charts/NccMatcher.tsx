import { useMemo, useState } from "react";
import { SMALL } from "./chartText";

const N = 360, CLIP_AT = 210, CLIP_LEN = 60;

/** A fixed, breath-like test signal (deterministic): bursts of noise under a slow envelope. */
function signal(): number[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: N }, (_, i) => {
    const envelope = 0.35 + 0.65 * Math.abs(Math.sin((i / N) * Math.PI * 5));
    return envelope * (0.6 * rand() + 0.4 * Math.sin(i * 0.45) * Math.sin(i * 0.07));
  });
}

/** |Normalized cross-correlation| of the clip with the recording window starting at each offset (as in the audit). */
export function nccCurve(recording: number[], clip: number[]): number[] {
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const cm = mean(clip);
  const cd = clip.map((v) => v - cm);
  const cn = Math.sqrt(cd.reduce((s, v) => s + v * v, 0));
  return Array.from({ length: recording.length - clip.length + 1 }, (_, t) => {
    const w = recording.slice(t, t + clip.length);
    const wm = mean(w);
    let num = 0, wn = 0;
    for (let i = 0; i < clip.length; i++) { const d = w[i]! - wm; num += cd[i]! * d; wn += d * d; }
    return Math.abs(num / (cn * Math.sqrt(wn) || 1));
  });
}

const W = 560, WAVE_H = 70, CURVE_H = 110;

/** Illustration: slide a clip along a recording; the cross-correlation peaks where the clip was cut from. */
export function NccMatcher({ threshold }: { threshold: number }) {
  const recording = useMemo(() => signal(), []);
  const clip = useMemo(() => recording.slice(CLIP_AT, CLIP_AT + CLIP_LEN), [recording]);
  const curve = useMemo(() => nccCurve(recording, clip), [recording, clip]);
  const [offset, setOffset] = useState(40);
  const score = curve[offset]!;
  const x = (i: number) => (i / (N - 1)) * W;
  const wave = (data: number[], start: number, mid: number, amp: number) =>
    data.map((v, i) => `${i ? "L" : "M"}${x(start + i).toFixed(1)},${(mid - v * amp).toFixed(1)}`).join("");
  const cy = (v: number) => WAVE_H * 2 + 30 + (1 - v) * CURVE_H;
  const curvePath = curve.map((v, t) => `${t ? "L" : "M"}${x(t + CLIP_LEN / 2).toFixed(1)},${cy(v).toFixed(1)}`).join("");
  const match = score >= threshold;
  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${WAVE_H * 2 + 40 + CURVE_H}`} className="w-full" role="img"
           aria-label={`A clip slid along a recording; cross-correlation at this position ${score.toFixed(2)}`}>
        <text x={0} y={12} style={SMALL}>ICBHI recording</text>
        <path d={wave(recording, 0, WAVE_H / 2 + 14, 22)} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1} />
        <rect x={x(offset)} y={16} width={x(CLIP_LEN)} height={WAVE_H - 4} fill="var(--color-fill)" fillOpacity={0.18}
              stroke={match ? "var(--color-accent)" : "var(--color-line)"} strokeWidth={1.5} rx={4} />
        <text x={0} y={WAVE_H + 22} style={SMALL}>Kaggle clip (slide it)</text>
        <path data-ncc-clip d={wave(clip, offset, WAVE_H + 50, 22)} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
        <line x1={0} x2={W} y1={cy(threshold)} y2={cy(threshold)} stroke="var(--color-warn)" strokeDasharray="5 4" />
        <text x={W} y={cy(threshold) - 5} textAnchor="end" style={SMALL}>copy threshold {threshold}</text>
        <line x1={0} x2={W} y1={cy(0)} y2={cy(0)} stroke="var(--color-line)" />
        <path d={curvePath} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1.2} />
        <circle cx={x(offset + CLIP_LEN / 2)} cy={cy(score)} r={5} fill={match ? "var(--color-accent)" : "var(--color-ink-soft)"} stroke="var(--color-paper)" strokeWidth={2} />
        <text x={0} y={WAVE_H * 2 + 24} style={SMALL}>Normalised cross-correlation at each position</text>
      </svg>
      <label className="block text-sm text-ink">
        <span className="sr-only">Clip position</span>
        <input type="range" min={0} max={curve.length - 1} value={offset} onChange={(e) => setOffset(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]" aria-valuetext={`score ${score.toFixed(2)}`} />
      </label>
      <p data-ncc-score aria-live="polite" className="m-0 text-sm text-ink">
        Score here: <span className="tabular font-semibold">{score.toFixed(2)}</span>
        {match ? ". Above the threshold: the clip is a copy of this part of the recording." : ". No match at this position."}
      </p>
    </figure>
  );
}

export const MATCH_AT = CLIP_AT;
