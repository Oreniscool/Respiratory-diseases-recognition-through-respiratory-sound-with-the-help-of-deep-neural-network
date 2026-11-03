import { useState } from "react";

const FRAMES = 80, ROWS = 16, CELL = 7;

/** A fixed pseudo-random generator so the illustration is reproducible for each "reshuffle". */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Illustration of SpecAugment: two time masks and two frequency masks blank parts of a feature window. */
export function MaskDemo({ freqMax, timeMax }: { freqMax: number; timeMax: number }) {
  const [round, setRound] = useState(1);
  const r = rng(round);
  // scale the real limits (bins of 120 features, frames of 200) to this 24 × 60 illustration
  const fScale = ROWS / 120, tScale = FRAMES / 200;
  const freq = Array.from({ length: 2 }, () => { const h = Math.max(1, Math.round(r() * freqMax * fScale)); return { at: Math.floor(r() * (ROWS - h)), h }; });
  const time = Array.from({ length: 2 }, () => { const w = Math.max(1, Math.round(r() * timeMax * tScale)); return { at: Math.floor(r() * (FRAMES - w)), w }; });
  const base = rng(3);
  const cells = Array.from({ length: ROWS * FRAMES }, () => base());
  return (
    <figure className="m-0 space-y-2">
      <svg viewBox={`0 0 ${FRAMES * CELL} ${ROWS * CELL}`} className="w-full rounded-md" role="img" aria-label="A feature window with two time masks and two frequency masks">
        {cells.map((v, i) => (
          <rect key={i} x={(i % FRAMES) * CELL} y={Math.floor(i / FRAMES) * CELL} width={CELL} height={CELL}
                fill="var(--color-accent)" fillOpacity={0.15 + 0.7 * v * (1 - Math.floor(i / FRAMES) / ROWS / 1.6)} />
        ))}
        {freq.map((m, i) => <rect key={`f${i}`} data-mask x={0} y={m.at * CELL} width={FRAMES * CELL} height={m.h * CELL} fill="var(--color-paper)" opacity={0.92} />)}
        {time.map((m, i) => <rect key={`t${i}`} data-mask x={m.at * CELL} y={0} width={m.w * CELL} height={ROWS * CELL} fill="var(--color-paper)" opacity={0.92} />)}
      </svg>
      <button type="button" onClick={() => setRound(round + 1)}
        className="rounded-full border border-ink px-3 py-1 text-sm font-semibold text-ink hover:bg-track">Reshuffle the masks</button>
    </figure>
  );
}
