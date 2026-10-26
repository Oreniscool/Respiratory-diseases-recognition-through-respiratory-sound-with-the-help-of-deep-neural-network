import { melToHz, hzToMel } from "../../../../lib/audio/mel";
import type { AudioAnalysis } from "../../../../lib/audio/analyze";

const W = 640, H = 260, PAD = 34;

/** Average spectrum before (muted) and after (accent) the 100–2,000 Hz band-pass, on a mel frequency axis. */
export function SpectrumBand({ analysis }: { analysis: AudioAnalysis }) {
  const { raw, filtered } = analysis.spectrumDb;
  const maxMel = hzToMel(analysis.sampleRate / 2);
  const xOfHz = (hz: number) => PAD + (hzToMel(hz) / maxMel) * (W - 2 * PAD);
  const all = [...raw, ...filtered];
  const hi = Math.max(...all), lo = Math.max(Math.min(...all), hi - 80);
  const yOf = (db: number) => H - PAD - ((Math.max(db, lo) - lo) / (hi - lo)) * (H - 2 * PAD);
  const path = (v: Float32Array) =>
    Array.from(v, (db, k) => `${k ? "L" : "M"}${xOfHz(melToHz(((k + 0.5) / v.length) * maxMel)).toFixed(1)},${yOf(db).toFixed(1)}`).join("");
  const ticks = [100, 500, 1000, 2000, 5000, 10000];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      <rect data-band x={xOfHz(100)} y={PAD - 10} width={xOfHz(2000) - xOfHz(100)} height={H - 2 * PAD + 10} fill="#e9f7d4" />
      <text x={xOfHz(100) + 6} y={PAD + 4} style={{ font: "600 12px var(--font-sans)", fill: "var(--color-ink)" }}>kept: 100–2,000 Hz</text>
      <path data-raw d={path(raw)} fill="none" stroke="#9aa58a" strokeWidth={2} />
      <path data-filtered d={path(filtered)} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="var(--color-line)" />
      {ticks.map((hz) => (
        <text key={hz} x={xOfHz(hz)} y={H - PAD + 18} textAnchor="middle" style={{ font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" }}>
          {hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`}
        </text>
      ))}
    </svg>
  );
}
