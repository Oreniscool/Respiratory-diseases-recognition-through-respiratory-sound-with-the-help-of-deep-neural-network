import { bandpass } from "./bandpass";
import { stftPower } from "./stft";
import { melFilterbank } from "./mel";
import { mfcc } from "./mfcc";
import { deltas } from "./deltas";
import { cmvn } from "./cmvn";

const SR = 22050;
const sine = (hz: number, seconds = 1) =>
  Float32Array.from({ length: Math.round(SR * seconds) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR));
const rmsMiddle = (x: Float32Array) => {
  const a = Math.floor(x.length / 4), b = Math.floor((3 * x.length) / 4);
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! ** 2;
  return Math.sqrt(s / (b - a));
};

describe("bandpass (100–2,000 Hz)", () => {
  it("suppresses a 50 Hz hum", () => expect(rmsMiddle(bandpass(sine(50), SR))).toBeLessThan(0.1 * rmsMiddle(sine(50))));
  it("passes 500 Hz within 1 dB", () => {
    const db = 20 * Math.log10(rmsMiddle(bandpass(sine(500), SR)) / rmsMiddle(sine(500)));
    expect(Math.abs(db)).toBeLessThan(1);
  });
  it("suppresses 6 kHz", () => expect(rmsMiddle(bandpass(sine(6000), SR))).toBeLessThan(0.1 * rmsMiddle(sine(6000))));
});

it("stftPower frames a 1 s clip like librosa (centred, hop 512)", () => {
  const frames = stftPower(sine(440));
  expect(frames).toHaveLength(1 + Math.floor(22050 / 512));
  expect(frames[0]).toHaveLength(1025);
});

it("the mel filterbank has 128 non-empty rows whose peaks rise with frequency", () => {
  const fb = melFilterbank(SR);
  expect(fb).toHaveLength(128);
  expect(fb[0]).toHaveLength(1025);
  const peaks = fb.map((row) => row.indexOf(Math.max(...row)));
  fb.forEach((row) => expect(row.reduce((a, b) => a + b, 0)).toBeGreaterThan(0));
  for (let i = 1; i < peaks.length; i++) expect(peaks[i]!).toBeGreaterThan(peaks[i - 1]!);
});

it("mfcc of a 1 kHz tone is 44 × 40 and finite", () => {
  const m = mfcc(stftPower(sine(1000)), SR);
  expect(m).toHaveLength(44);
  expect(m[0]).toHaveLength(40);
  expect(m.every((row) => row.every(Number.isFinite))).toBe(true);
});

it("silence stays finite (Review Focus 2)", () => {
  const m = mfcc(stftPower(new Float32Array(SR)), SR);
  expect(m.every((row) => row.every(Number.isFinite))).toBe(true);
  expect(new Set(m.map((row) => row[0]!.toFixed(6))).size).toBe(1);
  const constant = Array.from({ length: 10 }, () => Float32Array.from([3, 3, 3]));
  expect(cmvn(constant).every((row) => row.every((v) => v === 0))).toBe(true);
});

it("first-order deltas of a ramp are 1", () => {
  const ramp = Array.from({ length: 30 }, (_, t) => Float32Array.from([t, 2 * t]));
  const d = deltas(ramp, 1);
  for (let t = 4; t < 26; t++) {
    expect(d[t]![0]).toBeCloseTo(1, 6);
    expect(d[t]![1]).toBeCloseTo(2, 6);
  }
  expect(d[0]![0]).toBeCloseTo(1, 6); // interp edges fit the same line
});

it("second-order deltas of a parabola t² are 2", () => {
  const parabola = Array.from({ length: 30 }, (_, t) => Float32Array.from([t * t]));
  expect(deltas(parabola, 2)[15]![0]).toBeCloseTo(2, 5);
});

it("cmvn gives zero mean and unit variance per feature", () => {
  const f = Array.from({ length: 50 }, (_, t) => Float32Array.from([Math.sin(t), t * 0.3 + 5]));
  const out = cmvn(f);
  for (const col of [0, 1]) {
    const v = out.map((r) => r[col]!);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    expect(Math.abs(mean)).toBeLessThan(1e-5);
    expect(Math.abs(std - 1)).toBeLessThan(1e-3);
  }
});
