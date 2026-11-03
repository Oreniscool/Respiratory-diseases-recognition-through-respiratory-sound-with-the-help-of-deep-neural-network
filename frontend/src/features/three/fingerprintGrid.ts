import type { AudioAnalysis } from "../../lib/audio/analyze";
import { mfccFromLogMel } from "../../lib/audio/mfcc";

/** Time points and feature rows of the terrain (one 200-frame window, every second frame, rows resampled to 120). */
export const TIME = 100;
export const ROWS = 120;
const WINDOW = 200;

/** Linear resampling of one frame's values to `n` rows. */
function resample(frame: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const x = (k / (n - 1)) * (frame.length - 1);
    const i = Math.floor(x), f = x - i;
    out[k] = frame[i]! * (1 - f) + (frame[Math.min(frame.length - 1, i + 1)] ?? frame[i]!) * f;
  }
  return out;
}

/** Scale to [0, 1] between the 2nd and 98th percentiles, so a few extreme values don't flatten the rest. */
function normalise(values: Float32Array): Float32Array {
  const sorted = Float32Array.from(values).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)]!, hi = sorted[Math.floor(sorted.length * 0.98)]!;
  return values.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))));
}

/** One stage of the fingerprint as a TIME × ROWS grid (row-major by feature row), lightly smoothed, values in [0, 1]. */
function grid(frames: Float32Array[]): Float32Array {
  const out = new Float32Array(TIME * ROWS);
  const span = Math.min(WINDOW, frames.length);
  const step = span / TIME;
  for (let t = 0; t < TIME; t++) {
    // average the frames that fall into this time point (2 per point for a full window), so detail isn't aliased
    const from = Math.floor(t * step), to = Math.max(from + 1, Math.floor((t + 1) * step));
    const slice = frames.slice(from, to);
    if (!slice.length) continue;
    const mean = new Float32Array(slice[0]!.length);
    for (const f of slice) for (let k = 0; k < mean.length; k++) mean[k]! += f[k]! / slice.length;
    const column = resample(mean, ROWS);
    for (let r = 0; r < ROWS; r++) out[r * TIME + t] = column[r]!;
  }
  return normalise(blur(out));
}

/** A 3 × 3 box blur over the grid, for display only: it keeps the shape and removes frame-to-frame jitter. */
function blur(g: Float32Array): Float32Array {
  const out = new Float32Array(g.length);
  for (let r = 0; r < ROWS; r++) {
    for (let t = 0; t < TIME; t++) {
      let sum = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dt = -1; dt <= 1; dt++) {
        const rr = r + dr, tt = t + dt;
        if (rr < 0 || rr >= ROWS || tt < 0 || tt >= TIME) continue;
        sum += g[rr * TIME + tt]!; n++;
      }
      out[r * TIME + t] = sum / n;
    }
  }
  return out;
}

/** Standardise each coefficient over time, as CMVN does, so the first MFCC (overall loudness) doesn't dwarf the rest. */
function perRow(frames: Float32Array[]): Float32Array[] {
  const n = frames[0]?.length ?? 0;
  const mean = new Float32Array(n), sd = new Float32Array(n);
  for (const f of frames) for (let k = 0; k < n; k++) mean[k]! += f[k]! / frames.length;
  for (const f of frames) for (let k = 0; k < n; k++) sd[k]! += (f[k]! - mean[k]!) ** 2 / frames.length;
  return frames.map((f) => f.map((v, k) => (v - mean[k]!) / (Math.sqrt(sd[k]!) || 1)));
}

/** The three stages the scene steps through: mel bands, MFCCs, and the full 120-number frames (MFCC + Δ + Δ², already CMVN). */
export function fingerprintStages(analysis: AudioAnalysis): [Float32Array, Float32Array, Float32Array] {
  const window = (frames: Float32Array[]) => frames.slice(0, WINDOW);
  return [grid(analysis.spectrogramDb), grid(perRow(window(mfccFromLogMel(analysis.spectrogramDb)))), grid(analysis.features)];
}
