import type { AudioAnalysis } from "../../lib/audio/analyze";
import { fingerprintStages, ROWS, TIME } from "./fingerprintGrid";

const frames = (n: number, rows: number) => Array.from({ length: n }, (_, t) => Float32Array.from({ length: rows }, (_, r) => Math.sin(t / 7) * (r + 1)));

it("builds three TIME × ROWS stages scaled to [0, 1] from one window", () => {
  const analysis = { spectrogramDb: frames(300, 128), features: frames(300, 120) } as unknown as AudioAnalysis;
  const stages = fingerprintStages(analysis);
  expect(stages).toHaveLength(3);
  for (const s of stages) {
    expect(s).toHaveLength(TIME * ROWS);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.5);
  }
});
