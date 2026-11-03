import { useState } from "react";
import { CLASS_COLORS, type ClassName } from "../../../../components/classColors";
import { LABEL, SMALL } from "./chartText";

/** How ICBHI's eight diagnoses map to the five project classes (research/LABEL_MAPPING.md §2). */
export const DIAGNOSIS_TO_CLASS: Record<string, ClassName> = {
  COPD: "copd", Healthy: "healthy", URTI: "bronchial", Bronchiectasis: "bronchial", Bronchiolitis: "bronchial",
  Pneumonia: "pneumonia", LRTI: "bronchial", Asthma: "asthma",
};
const CLASS_ORDER: ClassName[] = ["copd", "healthy", "bronchial", "pneumonia", "asthma"];

const W = 560, H = 330, TOP = 24, GAP = 7, NODE = 12, MIN = 3;

/** Node and band positions for the Sankey (a plain function, so the component itself never mutates during render). */
export function sankeyLayout(diagnoses: Record<string, number>) {
  const total = Object.values(diagnoses).reduce((a, b) => a + b, 0);
  const names = CLASS_ORDER.flatMap((c) => Object.keys(diagnoses).filter((d) => DIAGNOSIS_TO_CLASS[d] === c));
  const usable = H - TOP - 10 - GAP * (names.length - 1);
  const scale = (usable - MIN * names.length) / total;
  const h = (count: number) => MIN + count * scale;
  const left: { d: string; y: number; h: number }[] = [];
  let y = TOP;
  for (const d of names) {
    left.push({ d, y, h: h(diagnoses[d]!) });
    y += h(diagnoses[d]!) + GAP;
  }
  const rightGap = (H - TOP - 10 - left.reduce((a, n) => a + n.h, 0)) / (CLASS_ORDER.length - 1);
  const right: { c: ClassName; y: number; h: number; patients: number }[] = [];
  let ry = TOP;
  for (const c of CLASS_ORDER) {
    const members = names.filter((d) => DIAGNOSIS_TO_CLASS[d] === c);
    const node = { c, y: ry, h: members.reduce((a, d) => a + h(diagnoses[d]!), 0), patients: members.reduce((a, d) => a + diagnoses[d]!, 0) };
    right.push(node);
    ry += node.h + rightGap;
  }
  // where each diagnosis's band lands on its class node, stacked in the left nodes' order
  const target = left.map((n, i) => {
    const c = DIAGNOSIS_TO_CLASS[n.d]!;
    const before = left.slice(0, i).filter((m) => DIAGNOSIS_TO_CLASS[m.d] === c).reduce((a, m) => a + m.h, 0);
    return right.find((r) => r.c === c)!.y + before;
  });
  return { left, right, target };
}

/** Sankey of patients: ICBHI diagnosis (left) → project class (right). Choose a class to highlight its sources. */
export function ClassSankey({ diagnoses }: { diagnoses: Record<string, number> }) {
  const [focus, setFocus] = useState<ClassName | null>(null);
  const { left, right, target } = sankeyLayout(diagnoses);
  const x0 = 150, x1 = W - 150;

  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ICBHI diagnoses mapped to five classes, by patients">
        <text x={x0 - 10} y={12} textAnchor="end" style={SMALL}>ICBHI diagnosis · patients</text>
        <text x={x1 + 10} y={12} style={SMALL}>Project class · patients</text>
        {left.map((n, i) => {
          const c = DIAGNOSIS_TO_CLASS[n.d]!;
          const ty = target[i]!;
          const dim = focus !== null && focus !== c;
          const mid = (x0 + NODE + x1) / 2;
          return (
            <g key={n.d} data-flow opacity={dim ? 0.15 : 1}>
              <path d={`M${x0 + NODE},${n.y} C${mid},${n.y} ${mid},${ty} ${x1},${ty} L${x1},${ty + n.h} C${mid},${ty + n.h} ${mid},${n.y + n.h} ${x0 + NODE},${n.y + n.h} Z`}
                fill={CLASS_COLORS[c]} fillOpacity={0.35} />
              <rect x={x0} y={n.y} width={NODE} height={n.h} fill={CLASS_COLORS[c]} />
              <text x={x0 - 8} y={n.y + n.h / 2 + 4} textAnchor="end" style={LABEL}>{n.d} <tspan style={SMALL}>{diagnoses[n.d]}</tspan></text>
              <title>{`${n.d}: ${diagnoses[n.d]} patients → ${c}`}</title>
            </g>
          );
        })}
        {right.map((n) => (
          <g key={n.c} opacity={focus !== null && focus !== n.c ? 0.25 : 1}>
            <rect x={x1} y={n.y} width={NODE} height={n.h} fill={CLASS_COLORS[n.c]} />
            <text x={x1 + NODE + 8} y={n.y + n.h / 2 + 4} style={LABEL}>{n.c} <tspan style={SMALL}>{n.patients}</tspan></text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Highlight a class">
        {CLASS_ORDER.map((c) => (
          <button key={c} type="button" aria-pressed={focus === c} onClick={() => setFocus(focus === c ? null : c)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${focus === c ? "border-ink font-semibold text-ink" : "border-line text-ink"}`}>
            <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: CLASS_COLORS[c] }} />{c}
          </button>
        ))}
      </div>
    </figure>
  );
}

/** Recordings per class: ICBHI alone, or with the Kaggle set's clips stacked on top. */
export function ClassBars({ icbhi, kaggle, added }: { icbhi: Record<string, number>; kaggle: Record<string, number>; added: boolean }) {
  const max = Math.max(...CLASS_ORDER.map((c) => (icbhi[c] ?? 0) + (kaggle[c] ?? 0)));
  return (
    <ul className="m-0 list-none space-y-1.5 p-0" aria-label="Recordings per class">
      {CLASS_ORDER.map((c) => {
        const a = icbhi[c] ?? 0, b = added ? kaggle[c] ?? 0 : 0;
        return (
          <li key={c} className="grid grid-cols-[6rem_1fr_6.5rem] items-center gap-3 text-sm text-ink">
            <span>{c}</span>
            <span className="flex h-3 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <span className="block h-3 transition-[width] duration-700 ease-out-soft" style={{ width: `${(a / max) * 100}%`, background: CLASS_COLORS[c] }} />
              <span className="block h-3 transition-[width] duration-700 ease-out-soft" style={{ width: `${(b / max) * 100}%`, background: CLASS_COLORS[c], opacity: 0.4 }} />
            </span>
            <span className="tabular text-right">{a.toLocaleString("en-US")}{added && <span className="text-ink-muted"> + {b.toLocaleString("en-US")}</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}
