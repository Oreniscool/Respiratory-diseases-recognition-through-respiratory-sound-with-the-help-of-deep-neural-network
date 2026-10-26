/** preprocessing.apply_cmvn: per feature over all frames, population std, eps 1e-8. */
export function cmvn(f: Float32Array[], eps = 1e-8): Float32Array[] {
  const frames = f.length;
  const dims = f[0]?.length ?? 0;
  const mean = new Float64Array(dims);
  const sq = new Float64Array(dims);
  // sum first, divide once (as numpy): an incremental mean leaves rounding residue on constant input
  for (const row of f) for (let d = 0; d < dims; d++) mean[d]! += row[d]!;
  for (let d = 0; d < dims; d++) mean[d]! /= frames;
  for (const row of f) for (let d = 0; d < dims; d++) sq[d]! += (row[d]! - mean[d]!) ** 2;
  for (let d = 0; d < dims; d++) sq[d]! /= frames;
  return f.map((row) => Float32Array.from(row, (v, d) => (v - mean[d]!) / (Math.sqrt(sq[d]!) + eps)));
}
