import { FACTS, SAMPLE } from "./facts";
import { SEED_READINGS } from "./seeds";

it("records the three served seeds", () => {
  expect(SEED_READINGS.map((s) => s.seed).join(", ")).toBe(FACTS.seeds.value);
});

it("the seeds' mean reproduces the sample response's window scores", () => {
  const served = SAMPLE.window_scores ?? [];
  expect(served.length).toBeGreaterThan(0);
  for (const r of SEED_READINGS) expect(r.windowScores).toHaveLength(served.length);
  served.forEach((window, w) => {
    for (const [label, value] of Object.entries(window)) {
      const mean = SEED_READINGS.reduce((sum, r) => sum + r.windowScores[w]![label]!, 0) / SEED_READINGS.length;
      expect(Math.abs(mean - value)).toBeLessThan(0.1);
    }
  });
});
