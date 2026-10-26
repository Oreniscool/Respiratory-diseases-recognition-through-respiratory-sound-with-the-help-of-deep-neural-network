type Props = { value: number; size?: number; label?: string };

/** A circular score (value in %), drawn in the accent colour. */
export function Ring({ value, size = 112, label }: Props) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(value)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-track)" strokeWidth={9} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth={9}
        strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="tabular"
            style={{ font: "600 1.25rem var(--font-sans)", fill: "var(--color-ink)" }}>
        {Math.round(value)}%
      </text>
    </svg>
  );
}
