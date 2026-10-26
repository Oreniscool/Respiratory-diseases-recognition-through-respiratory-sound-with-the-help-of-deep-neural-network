import { LUNGS, bronchialTree, radialProfile, rhoOf, type LungShape } from "./lungAnatomy";

/** Signed angle steps along the outline as seen from the centre. */
function angleSteps(shape: LungShape): number[] {
  const [cx, cy] = shape.centre;
  const a = shape.outline.map(([x, y]) => Math.atan2(y - cy, x - cx));
  return a.map((v, i) => {
    let d = a[(i + 1) % a.length]! - v;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  });
}

it.each(Object.entries(LUNGS))("the %s lung outline is star-shaped around its centre", (_, shape) => {
  const steps = angleSteps(shape);
  const sign = Math.sign(steps.reduce((s, d) => s + d, 0));
  // every step turns the same way (the 3D surface is built by stretching a sphere along these rays)
  expect(steps.every((d) => Math.sign(d) === sign && Math.abs(d) > 1e-5)).toBe(true);
  expect(Math.abs(steps.reduce((s, d) => s + d, 0))).toBeCloseTo(2 * Math.PI, 6);
});

it("grows a branching airway tree that stays inside the lungs", () => {
  const tree = bronchialTree();
  expect(tree.length).toBeGreaterThan(60);
  const right = radialProfile(LUNGS.right), left = radialProfile(LUNGS.left);
  for (const b of tree.slice(3)) {
    const [x, y] = b.end;
    const rho = x < 0 ? rhoOf(LUNGS.right, right, [x, y]) : rhoOf(LUNGS.left, left, [x, y]);
    expect(rho).toBeLessThan(0.95);
  }
});
