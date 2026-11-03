import { LABEL, SMALL } from "./chartText";

const W = 560, H = 300, PAD_L = 44, PAD_B = 40, PAD_T = 30;

type Props = { counts: number[]; binWidth: number; threshold: number; gap: [number, number] };

/** Best cross-correlation score of every Kaggle clip (log scale): the copies sit far right, past an empty gap. */
export function NccHistogram({ counts, binWidth, threshold, gap }: Props) {
  const max = Math.max(...counts);
  const x = (v: number) => PAD_L + v * (W - PAD_L - 10);
  const y = (count: number) => (count <= 0 ? H - PAD_B : H - PAD_B - (Math.log10(count + 1) / Math.log10(max + 1)) * (H - PAD_B - PAD_T));
  const bw = x(binWidth) - x(0) - 1.5;
  // shade whole empty bins only: from the first bin edge above the strongest non-copy to the last edge below the weakest copy
  const gapStart = Math.ceil(gap[0] / binWidth - 1e-9) * binWidth;
  const gapEnd = Math.floor(gap[1] / binWidth + 1e-9) * binWidth;
  const copies = counts.reduce((sum, c, i) => sum + (i * binWidth >= threshold ? c : 0), 0);
  const others = counts.reduce((sum, c) => sum + c, 0) - copies;
  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Histogram of best match scores: ${others} clips below ${gap[0]}, ${copies} clips above ${gap[1]}, none in between`}>
        <rect data-gap x={x(gapStart)} y={PAD_T - 6} width={x(gapEnd) - x(gapStart)} height={H - PAD_B - PAD_T + 6} fill="var(--color-fill)" fillOpacity={0.18} />
        <text x={(x(gapStart) + x(gapEnd)) / 2} y={PAD_T - 10} textAnchor="middle" style={LABEL}>no clip here</text>
        {[1, 10, 100].map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" style={SMALL}>{t}</text>
          </g>
        ))}
        {counts.map((c, i) => c > 0 && (
          <rect key={i} data-bar x={x(i * binWidth) + 0.75} y={y(c)} width={bw} height={H - PAD_B - y(c)}
                fill={i * binWidth >= threshold ? "var(--color-accent)" : "var(--color-ink-soft)"}>
            <title>{`${(i * binWidth).toFixed(2)}–${((i + 1) * binWidth).toFixed(2)}: ${c} clips`}</title>
          </rect>
        ))}
        <line x1={x(threshold)} x2={x(threshold)} y1={PAD_T - 6} y2={H - PAD_B} stroke="var(--color-warn)" strokeDasharray="5 4" />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={H - PAD_B + 16} textAnchor="middle" style={SMALL}>{v}</text>
        ))}
        <text x={(PAD_L + W) / 2} y={H - 6} textAnchor="middle" style={LABEL}>Best match score of each Kaggle clip against all of ICBHI</text>
        <text x={x(0.3)} y={PAD_T + 14} textAnchor="middle" style={LABEL}>{others} clips: no copy</text>
        <text x={x(0.97) - 10} y={PAD_T + 14} textAnchor="end" style={LABEL}>{copies} copies →</text>
      </svg>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer text-ink">Data table</summary>
        <table className="tabular mt-2 w-full max-w-md text-left">
          <thead><tr><th>Score</th><th>Clips</th></tr></thead>
          <tbody>
            {counts.map((c, i) => c > 0 && (
              <tr key={i}><td>{(i * binWidth).toFixed(2)}–{((i + 1) * binWidth).toFixed(2)}</td><td>{c}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
