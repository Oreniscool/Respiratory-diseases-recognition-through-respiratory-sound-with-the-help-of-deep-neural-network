import { contrastRatio } from "./contrast";

const PAPER = "#f7faf0";

it("ink, muted ink and accent are readable on the paper; the bright fill is not", () => {
  expect(contrastRatio("#1e2b08", PAPER)).toBeGreaterThan(13);
  expect(contrastRatio("#3c5610", PAPER)).toBeGreaterThan(7);
  expect(contrastRatio("#198076", PAPER)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio("#93d52a", PAPER)).toBeLessThan(2);
});

it("is symmetric and 21:1 for black on white", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
});
