import { agreement, formatDuration, leadingPerWindow, plainSentence, topClass, topTwo, windowCounts } from "./result";
import { SAMPLE } from "../../content/facts";

it("derives the story-report values from the recorded sample", () => {
  expect(topClass(SAMPLE.probabilities)).toBe("copd");
  expect(topTwo(SAMPLE.probabilities)).toEqual(["copd", "healthy"]);
  expect(agreement(SAMPLE)).toEqual({ agree: 3, total: 4 });
  expect(windowCounts(SAMPLE)).toEqual({ copd: 25, healthy: 5 });
  expect(leadingPerWindow(SAMPLE)).toHaveLength(30);
  expect(formatDuration(71.05)).toBe("1:11");
  expect(formatDuration(5)).toBe("0:05");
});

it("returns null for fields an older server does not send", () => {
  const { members: _m, window_scores: _w, ...older } = SAMPLE;
  expect(agreement(older)).toBeNull();
  expect(leadingPerWindow(older)).toBeNull();
  expect(windowCounts(older)).toBeNull();
});

it("writes a plain sentence without diagnostic language", () => {
  expect(plainSentence(SAMPLE)).toMatch(/COPD/);
  expect(plainSentence(SAMPLE)).toMatch(/3 of 4/);
  expect(plainSentence({ ...SAMPLE, prediction: "uncertain", uncertain: true })).toMatch(/not sure/i);
  for (const r of [SAMPLE, { ...SAMPLE, prediction: "uncertain", uncertain: true }]) expect(plainSentence(r)).not.toMatch(/diagnos/i);
});
