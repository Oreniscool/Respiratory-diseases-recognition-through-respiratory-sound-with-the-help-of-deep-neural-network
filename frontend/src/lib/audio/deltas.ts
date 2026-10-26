/**
 * librosa.feature.delta(width=9, mode="interp"): a Savitzky-Golay derivative (polyorder = order) along
 * time. Edge frames evaluate the polynomial fitted to the first/last `width` frames, as scipy's "interp".
 */
function savgolWeights(width: number, x0: number, order: number): Float64Array {
  // least squares fit of degree `order` over positions 0..width-1, derivative `order` evaluated at x0
  const p = order + 1;
  const a = Array.from({ length: width }, (_, i) => Array.from({ length: p }, (_, j) => (i - x0) ** j));
  const ata = Array.from({ length: p }, (_, r) => Array.from({ length: p }, (_, c) => a.reduce((s, row) => s + row[r]! * row[c]!, 0)));
  const inv = invert(ata);
  let factorial = 1;
  for (let i = 2; i <= order; i++) factorial *= i;
  return Float64Array.from({ length: width }, (_, i) => factorial * inv[order]!.reduce((s, v, j) => s + v * a[i]![j]!, 0));
}

function invert(m: number[][]): number[][] {
  const n = m.length;
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
    [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
    const d = aug[col]![col]!;
    for (let c = 0; c < 2 * n; c++) aug[col]![c]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r]![col]!;
      for (let c = 0; c < 2 * n; c++) aug[r]![c]! -= f * aug[col]![c]!;
    }
  }
  return aug.map((row) => row.slice(n));
}

export function deltas(f: Float32Array[], order: 1 | 2, width = 9): Float32Array[] {
  const frames = f.length;
  const dims = f[0]?.length ?? 0;
  // very short inputs: shrink the window to the largest odd size that fits, or return zeros
  let w = Math.min(width, frames % 2 === 1 ? frames : frames - 1);
  if (w <= order) return f.map(() => new Float32Array(dims));
  if (w % 2 === 0) w -= 1;
  const half = (w - 1) / 2;
  const centre = savgolWeights(w, half, order);
  const out = f.map(() => new Float32Array(dims));
  for (let t = 0; t < frames; t++) {
    let start = t - half;
    let weights = centre;
    if (t < half) { start = 0; weights = savgolWeights(w, t, order); }
    else if (t >= frames - half) { start = frames - w; weights = savgolWeights(w, t - start, order); }
    const row = out[t]!;
    for (let i = 0; i < w; i++) {
      const src = f[start + i]!;
      const wi = weights[i]!;
      for (let d = 0; d < dims; d++) row[d]! += wi * src[d]!;
    }
  }
  return out;
}
