import { melFilterbank } from "./mel";

/** librosa.power_to_db(S, ref=1.0, amin=1e-10, top_db=80). */
export function powerToDb(m: Float32Array[], amin = 1e-10, topDb = 80): Float32Array[] {
  let max = -Infinity;
  const db = m.map((row) => row.map((v) => {
    const d = 10 * Math.log10(Math.max(amin, v));
    if (d > max) max = d;
    return d;
  }));
  const floor = max - topDb;
  return db.map((row) => row.map((v) => Math.max(v, floor)));
}

/** mel power spectrogram (frames × nMels) from a power spectrogram (frames × bins). */
export function melPower(power: Float32Array[], sr: number, nMels = 128): Float32Array[] {
  const bank = melFilterbank(sr, (power[0]!.length - 1) * 2, nMels);
  return power.map((frame) => Float32Array.from(bank, (row) => {
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k]! * frame[k]!;
    return s;
  }));
}

/** librosa.feature.mfcc defaults (128 mel bands, DCT-II "ortho"): frames × nMfcc. */
export function mfcc(power: Float32Array[], sr: number, nMfcc = 40, nMels = 128): Float32Array[] {
  const logMel = powerToDb(melPower(power, sr, nMels));
  const basis = Array.from({ length: nMfcc }, (_, k) => {
    const scale = k === 0 ? Math.sqrt(1 / nMels) : Math.sqrt(2 / nMels);
    return Float64Array.from({ length: nMels }, (_, n) => scale * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * nMels)));
  });
  return logMel.map((frame) => Float32Array.from(basis, (b) => {
    let s = 0;
    for (let n = 0; n < nMels; n++) s += b[n]! * frame[n]!;
    return s;
  }));
}
