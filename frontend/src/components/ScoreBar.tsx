type Props = { label: string; value: number; highlight?: boolean };

/** One labelled score (value in %). Text is always ink; only the bar carries colour. */
export function ScoreBar({ label, value, highlight = false }: Props) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="grid grid-cols-[minmax(6.5rem,auto)_1fr_4rem] items-center gap-3 py-1 text-[0.95rem] text-ink">
      <span className={highlight ? "font-semibold" : undefined}>{label}</span>
      <span className="h-2 rounded-full bg-track" aria-hidden="true">
        <span
          className={`block h-2 rounded-full transition-[width] duration-700 ease-out-soft ${highlight ? "bg-accent" : "bg-fill-strong"}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className={`tabular text-right ${highlight ? "font-semibold" : ""}`}>{value.toFixed(1)}%</span>
    </div>
  );
}
