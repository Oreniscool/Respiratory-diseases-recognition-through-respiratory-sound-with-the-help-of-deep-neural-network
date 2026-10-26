/**
 * Approximation of the server's 4th-order Butterworth band-pass (scipy `sosfiltfilt`, 100–2,000 Hz):
 * a 4th-order Butterworth high-pass cascaded with a 4th-order low-pass, each two RBJ biquads with the
 * Butterworth Qs, run forward and backward for zero phase.
 */
const BUTTERWORTH_Q = [0.5412, 1.3066] as const;

type Coefficients = [b0: number, b1: number, b2: number, a1: number, a2: number];

function biquad(kind: "lowpass" | "highpass", f0: number, sr: number, q: number): Coefficients {
  const w0 = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b1] = kind === "lowpass" ? [(1 - cos) / 2, 1 - cos] : [(1 + cos) / 2, -(1 + cos)];
  return [b0 / a0, b1 / a0, b0 / a0, (-2 * cos) / a0, (1 - alpha) / a0];
}

function run(x: Float64Array, [b0, b1, b2, a1, a2]: Coefficients): void {
  let z1 = 0, z2 = 0; // transposed direct form II
  for (let i = 0; i < x.length; i++) {
    const input = x[i]!;
    const out = b0 * input + z1;
    z1 = b1 * input - a1 * out + z2;
    z2 = b2 * input - a2 * out;
    x[i] = out;
  }
}

export function bandpass(x: Float32Array, sr: number, low = 100, high = 2000): Float32Array {
  const sections = [
    ...BUTTERWORTH_Q.map((q) => biquad("highpass", low, sr, q)),
    ...BUTTERWORTH_Q.map((q) => biquad("lowpass", high, sr, q)),
  ];
  const y = Float64Array.from(x);
  for (const s of sections) run(y, s);
  y.reverse();
  for (const s of sections) run(y, s);
  y.reverse();
  return Float32Array.from(y);
}
