type Props = { label: string; value: number; limit: number; max: number; format: (v: number) => string; passWhen: "above" | "below" };

/** One rule of the abstention check: a scale, the limit, and where the sample sits. */
export function AbstainGauge({ label, value, limit, max, format, passWhen }: Props) {
  const pct = (v: number) => `${(v / max) * 100}%`;
  const passes = passWhen === "above" ? value >= limit : value <= limit;
  const okSide = passWhen === "above" ? { left: pct(limit), right: 0 } : { left: 0, right: `${100 - (limit / max) * 100}%` };
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-ink-muted">answers when {passWhen === "above" ? "at least" : "at most"} <span className="tabular font-semibold text-ink">{format(limit)}</span></span>
      </div>
      <div className="relative h-3 rounded-full bg-track">
        <span className="absolute inset-y-0 rounded-full bg-fill/60" style={okSide} />
        <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: pct(limit) }} />
        <span data-marker className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-accent" style={{ left: pct(value) }} />
      </div>
      <p className="m-0 text-sm text-ink">
        The sample: <span className="tabular font-semibold">{format(value)}</span>, {passes ? "within the limit" : "outside the limit"}
      </p>
    </div>
  );
}
