import { analyze } from "./analyze";
import { frameCount, windowStarts } from "./windows";
import { SAMPLE } from "../../content/facts";

const SR = 22050;
const noise = (seconds: number) => Float32Array.from({ length: Math.round(SR * seconds) }, () => Math.random() * 2 - 1);
const allFinite = (rows: ArrayLike<number>[]) => rows.every((r) => Array.from(r).every(Number.isFinite));

it("reproduces the server's 30 windows for the 71.05 s sample", () => {
  const frames = frameCount(Math.round(71.05 * SR));
  expect(frames).toBe(3060);
  expect(windowStarts(frames)).toHaveLength(SAMPLE.windows_analyzed);
  expect(windowStarts(frames).at(-1)).toBe(2860);
});

it("a clip shorter than one window gets a single padded window (Review Focus 1)", () => {
  expect(windowStarts(frameCount(SR))).toEqual([0]);
  const result = analyze(noise(1), SR);
  expect(result.features).toHaveLength(44);
  expect(result.features[0]).toHaveLength(120);
  expect(allFinite(result.features)).toBe(true);
});

it("silence analyses to finite values (Review Focus 2)", () => {
  const result = analyze(new Float32Array(SR * 2), SR);
  expect(allFinite(result.features)).toBe(true);
  expect(allFinite(result.spectrogramDb)).toBe(true);
  expect(Array.from(result.waveform).every(Number.isFinite)).toBe(true);
});

it("summarises the waveform as 1,200 min/max pairs and caps the spectrogram at 400 frames", () => {
  const result = analyze(noise(30), SR);
  expect(result.waveform).toHaveLength(2400);
  expect(result.filtered).toHaveLength(2400);
  expect(result.spectrogramDb.length).toBeLessThanOrEqual(400);
  expect(result.spectrogramDb[0]).toHaveLength(128);
  expect(result.durationS).toBeCloseTo(30, 5);
});
