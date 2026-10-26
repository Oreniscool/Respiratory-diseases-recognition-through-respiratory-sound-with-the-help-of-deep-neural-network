/** Slaney mel scale and filterbank, matching librosa.filters.mel defaults (htk=False, norm="slaney"). */
const F_SP = 200 / 3;
const MIN_LOG_HZ = 1000;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOG_STEP = Math.log(6.4) / 27;

export const hzToMel = (hz: number) => (hz < MIN_LOG_HZ ? hz / F_SP : MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOG_STEP);
export const melToHz = (mel: number) => (mel < MIN_LOG_MEL ? mel * F_SP : MIN_LOG_HZ * Math.exp(LOG_STEP * (mel - MIN_LOG_MEL)));

const cache = new Map<string, Float32Array[]>();

export function melFilterbank(sr: number, nFft = 2048, nMels = 128): Float32Array[] {
  const key = `${sr}|${nFft}|${nMels}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bins = nFft / 2 + 1;
  const fftFreqs = Array.from({ length: bins }, (_, k) => (k * sr) / nFft);
  const maxMel = hzToMel(sr / 2);
  const melF = Array.from({ length: nMels + 2 }, (_, i) => melToHz((i * maxMel) / (nMels + 1)));
  const bank: Float32Array[] = [];
  for (let m = 0; m < nMels; m++) {
    const [lo, mid, hi] = [melF[m]!, melF[m + 1]!, melF[m + 2]!];
    const enorm = 2 / (hi - lo);
    const row = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const f = fftFreqs[k]!;
      const weight = Math.max(0, Math.min((f - lo) / (mid - lo), (hi - f) / (hi - mid)));
      row[k] = weight * enorm;
    }
    bank.push(row);
  }
  cache.set(key, bank);
  return bank;
}
