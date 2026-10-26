import { bandpass } from "./bandpass";
import { cmvn } from "./cmvn";
import { deltas } from "./deltas";
import { melPower, mfccFromLogMel, powerToDb } from "./mfcc";
import { stftPower } from "./stft";
import { windowStarts } from "./windows";

export type AudioAnalysis = {
  durationS: number;
  sampleRate: number;
  /** min/max pairs of the raw waveform (1,200 points → 2,400 values) */
  waveform: Float32Array;
  /** the same for the band-passed signal */
  filtered: Float32Array;
  /** mel dB (128 bands), averaged down to at most 400 frames for drawing */
  spectrogramDb: Float32Array[];
  /** frames × 120: 40 MFCC, Δ, Δ², then CMVN (what the network receives) */
  features: Float32Array[];
  windowStarts: number[];
};

const POINTS = 1200;
const MAX_DRAW_FRAMES = 400;

function peaks(x: Float32Array, points = POINTS): Float32Array {
  const out = new Float32Array(points * 2);
  const step = x.length / points;
  for (let p = 0; p < points; p++) {
    const a = Math.floor(p * step), b = Math.max(a + 1, Math.floor((p + 1) * step));
    let lo = 0, hi = 0;
    for (let i = a; i < b && i < x.length; i++) {
      const v = x[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out[2 * p] = lo;
    out[2 * p + 1] = hi;
  }
  return out;
}

function shrink(rows: Float32Array[], max = MAX_DRAW_FRAMES): Float32Array[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  return Array.from({ length: max }, (_, i) => {
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    const acc = new Float32Array(rows[0]!.length);
    for (let r = a; r < b; r++) for (let k = 0; k < acc.length; k++) acc[k]! += rows[r]![k]! / (b - a);
    return acc;
  });
}

/** The server's feature pipeline (band-pass → MFCC + Δ + Δ² → CMVN → windows), plus drawing summaries. */
export function analyze(samples: Float32Array, sr: number): AudioAnalysis {
  const filtered = bandpass(samples, sr);
  const logMel = powerToDb(melPower(stftPower(filtered), sr));
  const base = mfccFromLogMel(logMel);
  const d1 = deltas(base, 1);
  const d2 = deltas(base, 2);
  const stacked = base.map((row, t) => {
    const f = new Float32Array(row.length * 3);
    f.set(row, 0);
    f.set(d1[t]!, row.length);
    f.set(d2[t]!, row.length * 2);
    return f;
  });
  return {
    durationS: samples.length / sr,
    sampleRate: sr,
    waveform: peaks(samples),
    filtered: peaks(filtered),
    spectrogramDb: shrink(logMel),
    features: cmvn(stacked),
    windowStarts: windowStarts(stacked.length),
  };
}
