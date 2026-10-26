import { CLASS_COLORS } from "../../../../components/classColors";

/** One dot per patient: first grouped by source, then (animated by the scene) moved into the three splits. */
export const SOURCES = [
  { id: "icbhi", label: "ICBHI 2017", patients: 126, color: CLASS_COLORS.asthma },
  { id: "kaggle", label: "Kaggle remainder", patients: 97, color: CLASS_COLORS.bronchial },
  { id: "kauh", label: "KAUH (Jordan)", patients: 21, color: CLASS_COLORS.healthy },
] as const;
export const SPLITS = [
  { id: "train", label: "Training", patients: 146 },
  { id: "val", label: "Validation", patients: 49 },
  { id: "test", label: "Test", patients: 49 },
] as const;

const W = 640;
const GAP = 13;

function grid(count: number, x0: number, y0: number, cols: number) {
  return Array.from({ length: count }, (_, i) => ({ x: x0 + (i % cols) * GAP, y: y0 + Math.floor(i / cols) * GAP }));
}

/** Source layout and split layout for every dot (dots are dealt round-robin so splits mix sources). */
export function dotLayout() {
  const source: { x: number; y: number; color: string }[] = [];
  let x = 10;
  for (const s of SOURCES) {
    const cols = s.patients > 50 ? 12 : 6;
    grid(s.patients, x, 70, cols).forEach((p) => source.push({ ...p, color: s.color }));
    x += cols * GAP + 40;
  }
  const split: { x: number; y: number }[] = [];
  let bx = 10;
  const cells = SPLITS.map((s) => {
    const cols = s.patients > 100 ? 12 : 6;
    const g = grid(s.patients, bx, 70, cols);
    bx += cols * GAP + 40;
    return g;
  });
  const order = [...cells[0]!.map((p) => p), ...cells[1]!, ...cells[2]!];
  // deal: interleave so each split receives dots from every source group
  const dealt = order.map((_, i) => order[(i * 97) % order.length]!);
  split.push(...dealt);
  return { source, split };
}

export function DotField() {
  const { source } = dotLayout();
  const splitLabelsX = [10, 10 + 12 * GAP + 40, 10 + 12 * GAP + 40 + 6 * GAP + 40];
  const sourceLabelsX = [10, 10 + 12 * GAP + 40, 10 + 12 * GAP + 40 + 12 * GAP + 40];
  return (
    <svg viewBox={`0 0 ${W} 330`} className="w-full" aria-hidden="true">
      <g data-source-labels>
        {SOURCES.map((s, i) => (
          <text key={s.id} x={sourceLabelsX[i]} y={50} style={{ font: "600 13px var(--font-sans)", fill: "var(--color-ink)" }}>
            {s.label} · {s.patients}
          </text>
        ))}
      </g>
      <g data-split-labels opacity={0}>
        {SPLITS.map((s, i) => (
          <text key={s.id} x={splitLabelsX[i]} y={50} style={{ font: "600 13px var(--font-sans)", fill: "var(--color-ink)" }}>
            {s.label} · {s.patients}
          </text>
        ))}
      </g>
      {source.map((p, i) => <circle key={i} data-dot cx={p.x} cy={p.y} r={4.6} fill={p.color} />)}
    </svg>
  );
}
