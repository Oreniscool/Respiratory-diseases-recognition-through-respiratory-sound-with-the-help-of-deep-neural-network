/** Deterministic synthetic breath sounds, used for scene visuals until real clips are bundled (Task 14). */
export type BreathKind = "normal" | "crackles" | "wheezes";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function syntheticBreath(kind: BreathKind, seconds = 8, sr = 22050): Float32Array {
  const rand = mulberry32(kind === "normal" ? 11 : kind === "crackles" ? 23 : 37);
  const n = Math.round(seconds * sr);
  const out = new Float32Array(n);
  let lp = 0;
  let crackle = 0;
  let cracklePhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const cycle = Math.abs(Math.sin(Math.PI * 0.25 * t)); // one breath every 4 s
    const env = 0.06 + 0.94 * cycle ** 1.6;
    lp += 0.07 * (rand() * 2 - 1 - lp); // low-passed noise sounds like airflow
    let v = lp * env * 2.4;
    if (kind === "wheezes") v += 0.32 * env * Math.sin(2 * Math.PI * (430 + 30 * Math.sin(2 * Math.PI * 4 * t)) * t);
    if (kind === "crackles") {
      if (crackle <= 0 && cycle > 0.4 && rand() < 7 / sr) { crackle = Math.round(0.015 * sr); cracklePhase = 0; }
      if (crackle > 0) {
        v += 0.9 * Math.exp(-cracklePhase / (0.004 * sr)) * Math.sin((2 * Math.PI * 650 * cracklePhase) / sr);
        cracklePhase += 1;
        crackle -= 1;
      }
    }
    out[i] = v;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  return out.map((v) => (0.9 * v) / (peak || 1));
}
