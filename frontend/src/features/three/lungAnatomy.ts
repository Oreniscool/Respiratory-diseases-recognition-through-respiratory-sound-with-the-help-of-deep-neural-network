/**
 * A front-view anatomical model of the lungs, shared by the 3D scene and its 2D fallback (no three.js here).
 * World units; x to the viewer's right, so the patient's right lung (three lobes, wider) sits at negative x
 * and the left lung (two lobes, cardiac notch, lingula) at positive x.
 */
export type P2 = [number, number];
export type P3 = [number, number, number];

export type LungShape = {
  /** the closed outline, sampled finely */
  outline: P2[];
  /** the point the outline is star-shaped around (every ray from it crosses the outline once) */
  centre: P2;
  /** half-thickness front to back */
  depth: number;
  /** fissures between the lobes, as front-view polylines */
  fissures: P2[][];
};

/** Closed Catmull-Rom spline through the control points. */
function closedSpline(points: P2[], perSegment: number): P2[] {
  const n = points.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i - 1 + n) % n]!, points[i]!, points[(i + 1) % n]!, points[(i + 2) % n]!];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Open Catmull-Rom spline (end points repeated). */
function openSpline(points: P2[], perSegment: number): P2[] {
  const ext = [points[0]!, ...points, points[points.length - 1]!];
  const out: P2[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1]!, ext[i]!, ext[i + 1]!, ext[i + 2]!];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

const RIGHT: LungShape = {
  outline: closedSpline([
    [-0.8, 1.62], [-0.5, 1.45], [-0.36, 1.0], [-0.3, 0.35], [-0.32, -0.4], [-0.4, -1.15], [-0.58, -1.42],
    [-1.0, -1.34], [-1.5, -1.52], [-1.86, -1.76], [-2.02, -1.1], [-1.95, -0.2], [-1.72, 0.62], [-1.35, 1.25], [-1.05, 1.58],
  ], 24),
  centre: [-1.15, -0.15],
  depth: 0.78,
  fissures: [
    openSpline([[-2.0, 0.3], [-1.72, -0.22], [-1.38, -0.75], [-1.0, -1.3]], 12), // oblique
    openSpline([[-1.72, -0.22], [-1.1, -0.05], [-0.32, 0.02]], 12), // horizontal
  ],
};

const LEFT: LungShape = {
  outline: closedSpline([
    [0.78, 1.68], [1.05, 1.62], [1.38, 1.3], [1.72, 0.68], [1.92, -0.2], [1.98, -1.15], [1.84, -1.82], [1.45, -1.6],
    [1.0, -1.45], [0.64, -1.5], [0.55, -1.22], [0.72, -0.84], [0.5, -0.45], [0.34, 0.3], [0.36, 1.0], [0.5, 1.45],
  ], 24),
  centre: [1.3, -0.45],
  depth: 0.72,
  fissures: [openSpline([[1.97, 0.6], [1.55, -0.35], [1.2, -1.0], [1.0, -1.45]], 12)], // oblique
};

export const LUNGS = { right: RIGHT, left: LEFT } as const;

/** Outline radius as a function of angle around the lung's centre. */
export function radialProfile(shape: LungShape): (angle: number) => number {
  const [cx, cy] = shape.centre;
  const pts = shape.outline
    .map(([x, y]) => ({ a: Math.atan2(y - cy, x - cx), r: Math.hypot(x - cx, y - cy) }))
    .sort((p, q) => p.a - q.a);
  const wrapped = [{ a: pts[pts.length - 1]!.a - 2 * Math.PI, r: pts[pts.length - 1]!.r }, ...pts, { a: pts[0]!.a + 2 * Math.PI, r: pts[0]!.r }];
  return (angle) => {
    let lo = 0, hi = wrapped.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (wrapped[mid]!.a <= angle) lo = mid; else hi = mid;
    }
    const p = wrapped[lo]!, q = wrapped[hi]!;
    const t = q.a === p.a ? 0 : (angle - p.a) / (q.a - p.a);
    return p.r + (q.r - p.r) * t;
  };
}

/** Front-to-back half-thickness at a normalised radius (0 centre, 1 edge): a full, rounded pillow. */
export const thickness = (shape: LungShape, rho: number) => shape.depth * Math.pow(Math.max(0, 1 - rho * rho), 0.62);

/** The normalised radius of a front-view point (above 1 means outside the outline). */
export function rhoOf(shape: LungShape, profile: (a: number) => number, [x, y]: P2): number {
  const dx = x - shape.centre[0], dy = y - shape.centre[1];
  return Math.hypot(dx, dy) / profile(Math.atan2(dy, dx));
}

export type Branch = { start: P3; end: P3; r0: number; r1: number; leaf: boolean };

/** Deterministic pseudo-random numbers, so the tree looks the same on every load. */
function random(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const norm = (v: P3): P3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Rodrigues rotation of v around the unit axis k. */
function rotate(v: P3, k: P3, angle: number): P3 {
  const c = Math.cos(angle), s = Math.sin(angle), kxv = cross(k, v), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  return [0, 1, 2].map((i) => v[i]! * c + kxv[i]! * s + k[i]! * d * (1 - c)) as P3;
}

/**
 * The airways: trachea, the two main bronchi (the right one shorter and steeper), the lobar bronchi, then
 * repeated bifurcation, clipped to the inside of each lung.
 */
export function bronchialTree(): Branch[] {
  const out: Branch[] = [];
  const rand = random(7);
  const inside = (shape: LungShape, profile: (a: number) => number, p: P3, margin: number) => {
    const rho = rhoOf(shape, profile, [p[0], p[1]]);
    return rho < margin && Math.abs(p[2]) < thickness(shape, rho) * 0.85;
  };

  function grow(shape: LungShape, profile: (a: number) => number, start: P3, dir: P3, length: number, radius: number, depth: number) {
    // near the edge, shorten the branch rather than stop: the tree keeps dividing into the periphery
    let end: P3 | null = null;
    for (const k of [1, 0.6, 0.35]) {
      const p: P3 = [start[0] + dir[0] * length * k, start[1] + dir[1] * length * k, start[2] + dir[2] * length * k];
      if (inside(shape, profile, p, 0.88)) { end = p; length *= k; break; }
    }
    if (!end) return;
    const leaf = depth === 0;
    out.push({ start, end, r0: radius, r1: radius * 0.86, leaf });
    if (leaf) return;
    // seen from the front, so the tree fans out in the picture plane with a little depth for volume
    const spread = 0.4 + rand() * 0.18;
    for (const sign of [-1, 1]) {
      const turned = rotate(dir, [0, 0, 1], sign * spread * (sign < 0 ? 1.1 : 0.9));
      const child = norm([turned[0], turned[1], turned[2] * 0.5 + (rand() - 0.5) * 0.35]);
      grow(shape, profile, end, child, length * (0.7 + rand() * 0.1), Math.max(0.006, radius * 0.7), depth - 1);
    }
  }

  const carina: P3 = [0, 0.82, -0.05];
  out.push({ start: [0, 2.45, -0.05], end: carina, r0: 0.125, r1: 0.118, leaf: false });
  const sides = [
    { shape: RIGHT, hilum: [-0.62, 0.42, -0.05] as P3, lobes: [[[-0.55, 0.85, 0.05], 0.42], [[-0.9, -0.3, 0.2], 0.45], [[-0.3, -1, -0.15], 0.62]] as [P3, number][] },
    { shape: LEFT, hilum: [0.74, 0.34, -0.05] as P3, lobes: [[[0.42, 0.9, 0.05], 0.42], [[0.85, -0.35, 0.15], 0.45], [[0.3, -1, -0.1], 0.66]] as [P3, number][] },
  ];
  for (const { shape, hilum, lobes } of sides) {
    const profile = radialProfile(shape);
    out.push({ start: carina, end: hilum, r0: 0.095, r1: 0.085, leaf: false });
    // right: upper, middle, lower lobe; left: upper (with its lingular division) and lower lobe
    for (const [lobe, length] of lobes) {
      grow(shape, profile, hilum, norm(lobe), length, 0.058, 7);
    }
  }
  return out;
}

/** Points on the front surface of a lung, for drawing the fissures in 3D. */
export function onFrontSurface(shape: LungShape, profile: (a: number) => number, points: P2[], lift = 0.01): P3[] {
  const [cx, cy] = shape.centre;
  return points.map(([x, y]) => {
    const rho = rhoOf(shape, profile, [x, y]);
    // pull a point that ends on or past the edge just inside it
    const k = rho > 0.97 ? 0.97 / rho : 1;
    return [cx + (x - cx) * k, cy + (y - cy) * k, thickness(shape, Math.min(rho, 0.97)) + lift];
  });
}
