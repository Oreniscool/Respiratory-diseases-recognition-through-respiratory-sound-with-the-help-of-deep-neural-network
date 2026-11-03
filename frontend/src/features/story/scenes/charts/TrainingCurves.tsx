import { useState } from "react";
import type { TrainingCurve } from "../../../../content/storyData";
import { Legend } from "../../../../components/Legend";
import { LABEL, SMALL } from "./chartText";

const W = 520, H = 170, PAD_L = 40, PAD_R = 12, PAD_T = 14, PAD_B = 24;

function Panel({ title, train, val, epoch, restored, format, lo, hi }: {
  title: string; train: number[]; val: number[]; epoch: number; restored: number; format: (v: number) => string; lo: number; hi: number;
}) {
  const n = train.length;
  const x = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const line = (data: number[]) => data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} per epoch, training and validation`}>
      <text x={PAD_L} y={10} style={LABEL}>{title}</text>
      <rect data-patience x={x(restored - 1)} y={PAD_T} width={x(n - 1) - x(restored - 1)} height={H - PAD_T - PAD_B} fill="var(--color-fill)" fillOpacity={0.15} />
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
          <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" style={SMALL}>{format(v)}</text>
        </g>
      ))}
      <path data-curve d={line(train)} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1.5} />
      <path data-curve d={line(val)} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <line x1={x(restored - 1)} x2={x(restored - 1)} y1={PAD_T} y2={H - PAD_B} stroke="var(--color-accent-deep)" strokeDasharray="4 3" />
      <line x1={x(epoch - 1)} x2={x(epoch - 1)} y1={PAD_T} y2={H - PAD_B} stroke="var(--color-ink)" />
      <circle cx={x(epoch - 1)} cy={y(val[epoch - 1]!)} r={4} fill="var(--color-accent)" stroke="var(--color-paper)" strokeWidth={2} />
      {[1, Math.round(n / 2), n].map((e) => <text key={e} x={x(e - 1)} y={H - 8} textAnchor="middle" style={SMALL}>{e}</text>)}
    </svg>
  );
}

/** Accuracy and loss per epoch (seed 42); the dashed line is the restored epoch, the shaded band the patience window. */
export function TrainingCurves({ curve, patience }: { curve: TrainingCurve; patience: number }) {
  const [epoch, setEpoch] = useState(curve.restoredEpoch);
  const losses = [...curve.loss, ...curve.valLoss];
  const i = epoch - 1;
  return (
    <figure className="m-0 space-y-3 rounded-xl border border-line bg-paper-raised p-5">
      <Legend items={[{ label: "training", color: "var(--color-ink-soft)" }, { label: "validation", color: "var(--color-accent)" }]} />
      <Panel title="Accuracy" train={curve.accuracy} val={curve.valAccuracy} epoch={epoch} restored={curve.restoredEpoch}
        format={(v) => `${Math.round(v * 100)}%`} lo={0} hi={1} />
      <Panel title="Loss" train={curve.loss} val={curve.valLoss} epoch={epoch} restored={curve.restoredEpoch}
        format={(v) => v.toFixed(2)} lo={Math.min(...losses)} hi={Math.max(...losses)} />
      <label className="block text-sm text-ink">
        <span className="font-semibold">Epoch <span className="tabular">{epoch}</span></span>
        <input type="range" min={1} max={curve.epochs} value={epoch} onChange={(e) => setEpoch(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--color-accent)]" aria-valuetext={`epoch ${epoch}`} />
      </label>
      <p data-epoch-readout aria-live="polite" className="tabular m-0 text-sm text-ink">
        Validation accuracy {(curve.valAccuracy[i]! * 100).toFixed(1)}% · training accuracy {(curve.accuracy[i]! * 100).toFixed(1)}%
        {epoch === curve.restoredEpoch && " · the epoch that was kept"}
      </p>
      <figcaption className="text-xs text-ink-muted">
        Dashed line: epoch {curve.restoredEpoch}, the best on validation, restored and saved. Shaded: the {curve.epochs - curve.restoredEpoch} epochs
        that followed without improvement (patience {patience}). Accuracy here is per 4.6-second window, not per patient.
      </figcaption>
    </figure>
  );
}
