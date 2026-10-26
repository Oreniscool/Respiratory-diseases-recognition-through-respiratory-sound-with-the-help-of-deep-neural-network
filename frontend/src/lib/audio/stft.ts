import FFT from "fft.js";

/** Power spectrogram like librosa.stft (centred, zero padding, periodic Hann): frames × (nFft/2 + 1). */
export function stftPower(x: Float32Array, nFft = 2048, hop = 512): Float32Array[] {
  const pad = nFft / 2;
  const padded = new Float32Array(x.length + nFft);
  padded.set(x, pad);
  const window = Float32Array.from({ length: nFft }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nFft));
  const fft = new FFT(nFft);
  const frame = new Float32Array(nFft);
  const out = fft.createComplexArray();
  const frames = 1 + Math.floor(x.length / hop);
  const bins = nFft / 2 + 1;
  const result: Float32Array[] = [];
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < nFft; i++) frame[i] = (padded[start + i] ?? 0) * window[i]!;
    fft.realTransform(out, frame);
    const power = new Float32Array(bins);
    for (let k = 0; k < bins; k++) power[k] = out[2 * k]! ** 2 + out[2 * k + 1]! ** 2;
    result.push(power);
  }
  return result;
}
