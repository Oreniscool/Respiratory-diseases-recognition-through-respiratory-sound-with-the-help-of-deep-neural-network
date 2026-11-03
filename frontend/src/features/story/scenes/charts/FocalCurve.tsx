import { useState } from "react";
import { LABEL, SMALL } from "./chartText";

const W = 480, H = 190, PAD_L = 44, PAD_B = 36, PAD_T = 14, PAD_R = 14;

/** Weight focal loss gives an example the model already gets right with probability p: (1 − p)^γ. */
export const focalWeight = (p: number, gamma: number) => Math.pow(1 - p, gamma);

/** A weight as a readable percentage: 100%, 32%, 1%, 0.03%. */
export function share(weight: number): string {
  const v = weight * 100;
  return `${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(1)}%`;
}

/** Focal-loss weight against the model's confidence in the right class; γ = 0 is plain cross-entropy. */
export function FocalCurve({ served }: { served: number }) {
  const [gamma, setGamma] = useState(served);
  const x = (p: number) => PAD_L + p * (W - PAD_L - PAD_R);
  const y = (w: number) => PAD_T + (1 - w) * (H - PAD_T - PAD_B);
  const line = (g: number) => Array.from({ length: 101 }, (_, i) => i / 100)
    .map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(focalWeight(p, g)).toFixed(1)}`).join("");
  const easy = focalWeight(0.9, gamma);
  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Focal-loss weight with gamma ${gamma}`}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
            <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" style={SMALL}>{v}</text>
            <text x={x(v)} y={H - PAD_B + 16} textAnchor="middle" style={SMALL}>{v * 100}%</text>
          </g>
        ))}
        <path d={line(0)} fill="none" stroke="var(--color-ink-soft)" strokeDasharray="5 4" />
        <text x={x(0.98)} y={y(1) + 14} textAnchor="end" style={SMALL}>plain cross-entropy (γ = 0)</text>
        <path data-focal d={line(gamma)} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
        <circle cx={x(0.9)} cy={y(easy)} r={5} fill="var(--color-accent)" stroke="var(--color-paper)" strokeWidth={2} />
        <text x={(PAD_L + W) / 2} y={H - 4} textAnchor="middle" style={LABEL}>How sure the model already is of the right class</text>
        <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} style={LABEL}>Weight in training</text>
      </svg>
      <label className="block text-sm text-ink">
        <span className="font-semibold">Focus γ = <span className="tabular">{gamma.toFixed(1)}</span></span>
        {gamma === served && <span className="text-ink-muted"> (the value RespiNet uses)</span>}
        <input type="range" min={0} max={5} step={0.5} value={gamma} onChange={(e) => setGamma(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--color-accent)]" />
      </label>
      <p data-focal-readout aria-live="polite" className="m-0 text-sm text-ink">
        An example it already gets right at 90% counts <span className="tabular font-semibold">{share(easy)}</span> as much as a total miss.
      </p>
    </figure>
  );
}
