import { FACTS } from "../../../../content/facts";
import { pct1 } from "./chartText";
import { SPLIT_UNITS, leakValue, useLeakSelection } from "./leakStore";

/** The leak ladder's controls and readout (the bars themselves are drawn by the 3D stage or its 2D fallback). */
export function LeakControls() {
  const { unit, testPick, setUnit, setTestPick } = useLeakSelection();
  const value = leakValue(unit, testPick);
  return (
    <div data-leak-controls className="space-y-4 rounded-xl border border-line bg-paper-raised p-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold text-ink">1 · What gets split</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Split unit">
          {SPLIT_UNITS.map((u) => (
            <button key={u.id} type="button" role="radio" aria-checked={unit === u.id} onClick={() => setUnit(u.id)}
              className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors duration-300 ${unit === u.id ? "border-accent bg-accent text-paper" : "border-line bg-paper text-ink hover:border-ink"}`}>
              {u.label}
            </button>
          ))}
        </div>
        <p className="m-0 mt-2 text-xs text-ink-muted">{SPLIT_UNITS.find((u) => u.id === unit)!.hint}</p>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-3 border-t border-line pt-3 text-sm text-ink">
        <input type="checkbox" checked={testPick} onChange={(e) => setTestPick(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        <span><span className="font-semibold">2 · Pick the best checkpoint on the test set</span> (the original did)</span>
      </label>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-ink">Balanced accuracy <span className="text-ink-muted">· chance {FACTS.leakChance.display}</span></span>
        <span data-leak-value className="tabular font-serif text-4xl text-ink" aria-live="polite">{pct1(value)}</span>
      </div>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer text-ink">Data table (mean of {FACTS.leakRepeats.display} runs each)</summary>
        <table className="tabular mt-2 w-full text-left">
          <thead><tr><th>Split</th><th>Checkpoint on test</th><th>Checkpoint on validation</th></tr></thead>
          <tbody>
            {SPLIT_UNITS.map((u) => (
              <tr key={u.id}><td>{u.label}</td><td>{pct1(leakValue(u.id, true))}</td><td>{pct1(leakValue(u.id, false))}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** 2D version of the leak grid (no WebGL or reduced motion): six bars, split unit × checkpoint choice. */
export function LeakBars2D() {
  const { unit, testPick } = useLeakSelection();
  const H = 220, BAR = 46, GAP = 14, GROUP = 2 * BAR + GAP + 50;
  const y = (v: number) => H - v * H;
  return (
    <svg viewBox={`0 0 ${3 * GROUP} ${H + 50}`} className="w-full max-w-xl" data-testid="leak-bars-2d" aria-hidden="true">
      <line x1={0} x2={3 * GROUP} y1={y(FACTS.leakChance.value)} y2={y(FACTS.leakChance.value)} stroke="var(--color-warn)" strokeDasharray="5 4" />
      {SPLIT_UNITS.map((u, i) => (
        <g key={u.id} transform={`translate(${i * GROUP + 20} 0)`}>
          {[true, false].map((test, j) => {
            const v = leakValue(u.id, test);
            const on = u.id === unit && test === testPick;
            return (
              <g key={String(test)}>
                <rect data-leak-bar2d={on ? "on" : "off"} x={j * (BAR + GAP)} y={y(v)} width={BAR} height={H - y(v)} rx={4}
                      fill={on ? "var(--color-accent)" : "var(--color-track)"} stroke="var(--color-line)" />
                <text x={j * (BAR + GAP) + BAR / 2} y={y(v) - 6} textAnchor="middle" style={{ font: "600 12px var(--font-sans)", fill: "var(--color-ink)" }}>{pct1(v)}</text>
                <text x={j * (BAR + GAP) + BAR / 2} y={H + 16} textAnchor="middle" style={{ font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" }}>{test ? "test" : "valid."}</text>
              </g>
            );
          })}
          <text x={BAR + GAP / 2} y={H + 36} textAnchor="middle" style={{ font: "600 12px var(--font-sans)", fill: "var(--color-ink)" }}>{u.label}</text>
        </g>
      ))}
    </svg>
  );
}
