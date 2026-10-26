import type { ReliabilityBin } from "../../../../content/facts";

const W = 440, H = 360, PAD = 48;

/** Calibration curve of the test recordings: mean score per bin against how often the model was right. */
export function ReliabilityChart({ bins }: { bins: ReliabilityBin[] }) {
  const x = (v: number) => PAD + v * (W - 2 * PAD);
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const maxCount = Math.max(...bins.map((b) => b.count));
  const line = bins.map((b, i) => `${i ? "L" : "M"}${x(b.meanConfidence).toFixed(1)},${y(b.accuracy).toFixed(1)}`).join("");
  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Reliability chart of the test recordings">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
            <text x={x(0) - 8} y={y(v) + 4} textAnchor="end" style={{ font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" }}>{v * 100}%</text>
            <text x={x(v)} y={y(0) + 18} textAnchor="middle" style={{ font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" }}>{v * 100}%</text>
          </g>
        ))}
        <line data-diagonal x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#9aa58a" strokeDasharray="5 5" />
        <text x={x(0.98)} y={y(0.98) - 8} textAnchor="end" style={{ font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" }}>perfect calibration</text>
        <path data-curve d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        {bins.map((b) => (
          <circle key={b.lower} data-bin cx={x(b.meanConfidence)} cy={y(b.accuracy)} r={5 + 7 * Math.sqrt(b.count / maxCount)}
                  fill="var(--color-accent)" fillOpacity={0.85} stroke="var(--color-paper)" strokeWidth={2}>
            <title>{`scores ${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}%: ${b.count} recordings, mean score ${(b.meanConfidence * 100).toFixed(0)}%, right ${(b.accuracy * 100).toFixed(0)}%`}</title>
          </circle>
        ))}
        <text x={W / 2} y={H - 8} textAnchor="middle" style={{ font: "600 12px var(--font-sans)", fill: "var(--color-ink)" }}>Model score</text>
        <text x={14} y={H / 2} textAnchor="middle" transform={`rotate(-90 14 ${H / 2})`} style={{ font: "600 12px var(--font-sans)", fill: "var(--color-ink)" }}>How often it was right</text>
      </svg>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer text-ink">Data table</summary>
        <table className="tabular mt-2 w-full max-w-md text-left">
          <thead><tr><th>Score bin</th><th>Recordings</th><th>Mean score</th><th>Right</th></tr></thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.lower}><td>{Math.round(b.lower * 100)}–{Math.round(b.upper * 100)}%</td><td>{b.count}</td>
                <td>{(b.meanConfidence * 100).toFixed(0)}%</td><td>{(b.accuracy * 100).toFixed(0)}%</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
