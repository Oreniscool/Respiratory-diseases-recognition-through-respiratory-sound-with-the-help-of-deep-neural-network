import { useMemo } from "react";
import { GLYPHS, type GlyphName } from "../../../../components/glyphs";
import { classColor } from "../../../../components/classColors";
import { LAYER_COLORS } from "../../../three/layerColors";

const W = 772, H = 200, TOP = 18, BOTTOM = 168;
/** network columns (a few neurons each stand in for the real widths), then the five outputs */
const COLUMNS: { glyph: GlyphName; nodes: number }[] = [
  { glyph: "fingerprint", nodes: 6 },
  { glyph: "conv", nodes: 5 },
  { glyph: "gru128", nodes: 6 },
  { glyph: "gru64", nodes: 5 },
  { glyph: "pooling", nodes: 3 },
  { glyph: "dense", nodes: 4 },
];
const OUT = COLUMNS.length;
const colX = (c: number) => 46 + c * 96;
const nodeY = (i: number, n: number) => (n === 1 ? (TOP + BOTTOM) / 2 : TOP + ((BOTTOM - TOP) * i) / (n - 1));
const PULSES = 9;

/**
 * An animated graph of RespiNet: columns of neurons joined edge to edge, signals flowing through, and the five
 * output neurons sized by RespiNet's real scores for the window. Each column carries its layer's icon and colour.
 * `data-col` lets the scene light up a column while the matching row below is explained.
 */
export function NetworkGraph({ scores }: { scores: Record<string, number> }) {
  const outputs = useMemo(() => Object.entries(scores).sort((a, b) => b[1] - a[1]), [scores]);
  const sizes = [...COLUMNS.map((c) => c.nodes), outputs.length];
  const points = sizes.map((n, c) => Array.from({ length: n }, (_, i) => ({ x: colX(c), y: nodeY(i, n) })));
  // signals: deterministic paths through one neuron per column, most of them ending at the strongest class
  const pulses = useMemo(() => Array.from({ length: PULSES }, (_, p) => {
    const route = sizes.map((n, c) => (c === OUT ? (p % 3 === 2 ? (p % outputs.length) : 0) : (p * 7 + c * 3) % n));
    return route.map((i, c) => `${c ? "L" : "M"}${colX(c)},${nodeY(i, sizes[c]!)}`).join("");
  }), [outputs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const color = (c: number) => (c === OUT ? "#1e2b08" : LAYER_COLORS[COLUMNS[c]!.glyph]!);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
           aria-label="RespiNet drawn as a network: input, convolutions, two BiGRUs, pooling and dense layers, ending in five class scores">
        {points.slice(0, -1).map((col, c) => (
          <g key={c} data-edges={c} stroke="#c9d6b3" strokeWidth={0.8}>
            {col.flatMap((a, i) => points[c + 1]!.map((b, j) => (
              <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={1} strokeDasharray="1" />
            )))}
          </g>
        ))}
        <g className="motion-reduce:hidden" data-pulses>
          {pulses.map((d, p) => (
            <circle key={p} r={3.2} fill="#2ad5c4" stroke="#198076" strokeWidth={1}>
              <animateMotion dur="2.6s" begin={`${(p * 2.6) / PULSES}s`} repeatCount="indefinite" path={d} />
            </circle>
          ))}
        </g>
        {points.slice(0, -1).map((col, c) => (
          <g key={c} data-col={c}>
            {col.map((p, i) => (
              <g key={i} data-node>
                <circle data-halo cx={p.x} cy={p.y} r={12} fill={color(c)} opacity={0} />
                <circle cx={p.x} cy={p.y} r={6.5} fill="#ffffff" stroke={color(c)} strokeWidth={2.2} />
              </g>
            ))}
          </g>
        ))}
        <g data-col={OUT}>
          {outputs.map(([label, value], i) => {
            const p = points[OUT]![i]!;
            return (
              <g key={label} data-node>
                <circle data-halo cx={p.x} cy={p.y} r={14} fill={classColor(label)} opacity={0} />
                <circle cx={p.x} cy={p.y} r={4 + 7 * (value / 100)} fill={classColor(label)} stroke="#ffffff" strokeWidth={1.5} />
                <text data-out x={p.x + 16} y={p.y + 4} style={{ font: "600 12.5px var(--font-sans)", fill: "var(--color-ink)" }}>
                  {label} <tspan style={{ fontWeight: 400 }}>{value.toFixed(1)}%</tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="relative h-7" aria-hidden="true">
        {COLUMNS.map((c, i) => (
          <span key={c.glyph} className="absolute top-0 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-paper-raised text-ink"
                style={{ left: `${(colX(i) / W) * 100}%`, borderColor: LAYER_COLORS[c.glyph] }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={GLYPHS[c.glyph]} />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
