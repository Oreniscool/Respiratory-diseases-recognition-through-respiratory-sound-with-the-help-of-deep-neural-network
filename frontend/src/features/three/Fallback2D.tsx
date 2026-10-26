import { useMemo } from "react";
import { SAMPLE } from "../../content/facts";
import { memberLabel, memberTop } from "../../content/members";
import { classColor } from "../../components/classColors";
import { GLYPHS, type GlyphName } from "../../components/glyphs";
import { LUNGS, bronchialTree } from "./lungAnatomy";
import type { StageGroup } from "./stage";

/** 2D versions of the three 3D scenes, for browsers without WebGL and for reduced motion. */
export function Fallback2D({ group }: { group: StageGroup | null }) {
  if (!group) return null;
  return (
    <div data-testid="stage-fallback" className="flex h-full w-full items-center justify-center p-8">
      {group === "lungs" && <LungsSvg />}
      {group === "fusion" && <FusionSvg />}
    </div>
  );
}

const pathOf = (points: [number, number][], close = false) =>
  `M${points.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join("L")}${close ? "Z" : ""}`;

/** The same anatomical outline, fissures and airway tree as the 3D lungs, seen from the front. */
function LungsSvg() {
  const tree = useMemo(() => bronchialTree(), []);
  return (
    <svg viewBox="-2.3 -2.6 4.6 4.75" className="h-[70vh] max-h-[560px] w-auto" aria-hidden="true">
      {Object.entries(LUNGS).map(([side, lung]) => (
        <g key={side}>
          <path d={pathOf(lung.outline, true)} fill="#e7eed9" stroke="#76aa22" strokeWidth={0.02} />
          {lung.fissures.map((f, i) => <path key={i} d={pathOf(f)} fill="none" stroke="#76aa22" strokeWidth={0.018} />)}
        </g>
      ))}
      <g stroke="#198076" strokeLinecap="round">
        {tree.map((b, i) => (
          <line key={i} x1={b.start[0]} y1={-b.start[1]} x2={b.end[0]} y2={-b.end[1]} strokeWidth={Math.max(0.008, b.r0 * 1.8)} />
        ))}
      </g>
    </svg>
  );
}

/** A glyph inside a round badge, centred at (x, y) with radius r, in the SVG's own units. */
function Badge({ name, x, y, r, color }: { name: GlyphName; x: number; y: number; r: number; color: string }) {
  const s = (r * 1.2) / 24;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={color} strokeWidth={2} />
      <path d={GLYPHS[name]} transform={`translate(${x - 12 * s} ${y - 12 * s}) scale(${s})`} fill="none" stroke={color}
            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** The score gauge: a clockwise arc from 12 o'clock. */
function arcPath(cx: number, cy: number, r: number, fraction: number) {
  const f = Math.min(0.9999, fraction);
  const a = -Math.PI / 2 + f * 2 * Math.PI;
  return `M${cx},${cy - r} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
}

function FusionSvg() {
  const members = SAMPLE.members ?? [];
  const fused = SAMPLE.probabilities[SAMPLE.model_prediction] ?? SAMPLE.confidence;
  const medallion = (key: string, glyph: GlyphName, cx: number, r: number, label: string, score: number, title: string, accent = false) => (
    <g key={key}>
      <circle cx={cx} cy={110} r={r * 1.3} fill="none" stroke="#e7eed9" strokeWidth={r * 0.12} />
      <path d={arcPath(cx, 110, r * 1.3, score / 100)} fill="none" stroke={classColor(label)} strokeWidth={r * 0.18} strokeLinecap="round" />
      <Badge name={glyph} x={cx} y={110} r={r} color="#1e2b08" />
      <text x={cx} y={110 + r * 1.3 + 24} textAnchor="middle" style={{ font: "600 13px var(--font-sans)", fill: accent ? "#198076" : "#1e2b08" }}>{title}</text>
      <text x={cx} y={110 + r * 1.3 + 42} textAnchor="middle" style={{ font: "12px var(--font-sans)", fill: "#3c5610" }}>{label} {score.toFixed(1)}%</text>
    </g>
  );
  return (
    <svg viewBox="0 0 760 240" className="w-full max-w-3xl" aria-hidden="true">
      {members.map((m, i) => {
        const top = memberTop(m);
        return medallion(m.name, (["respinet", "yamnet", "opera_ce", "hear"].includes(m.name) ? m.name : "respinet") as GlyphName,
          70 + i * 130, 34, top.label, top.score, memberLabel(m.name));
      })}
      {members.map((m, i) => (
        <path key={m.name} d={`M${70 + i * 130},${66} C${70 + i * 130},${20 - i * 4} 560,${10 + i * 6} 610,${52}`} fill="none" stroke="#2ad5c4" strokeWidth={2} />
      ))}
      {medallion("fused", "fused", 660, 50, SAMPLE.model_prediction, fused, "Fused", true)}
    </svg>
  );
}
