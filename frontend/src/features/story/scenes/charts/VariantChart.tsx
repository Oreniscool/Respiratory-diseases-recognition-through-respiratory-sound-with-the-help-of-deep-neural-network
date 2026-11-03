import { useState } from "react";
import type { Variant } from "../../../../content/facts";

/** Cross-validated balanced accuracy per candidate; choose one to read it. The adopted model is highlighted. */
export function VariantChart({ variants }: { variants: Variant[] }) {
  const sorted = [...variants].sort((a, b) => a.value - b.value);
  const adopted = sorted.find((v) => v.adopted)!;
  const [selected, setSelected] = useState(adopted.id);
  const lo = 0.5, hi = 0.8;
  const w = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const current = sorted.find((v) => v.id === selected)!;
  return (
    <div className="space-y-3">
      <ul className="m-0 list-none space-y-1 p-0" role="radiogroup" aria-label="Candidate models">
        {sorted.map((v) => (
          <li key={v.id}>
            <button type="button" role="radio" aria-checked={selected === v.id} onClick={() => setSelected(v.id)}
              className={`grid w-full grid-cols-[minmax(9rem,13rem)_1fr_3.5rem] items-center gap-3 rounded-lg border px-2 py-1 text-left text-sm text-ink ${selected === v.id ? "border-ink bg-paper-raised" : "border-transparent hover:border-line"}`}>
              <span className={v.adopted ? "font-semibold" : undefined}>{v.label}</span>
              <span className="h-2.5 rounded-full bg-track" aria-hidden="true">
                <span data-variant-bar className={`block h-2.5 rounded-full ${v.adopted ? "bg-accent" : v.reference ? "bg-ink-soft" : "bg-fill-strong"}`}
                      style={{ width: w(v.value) }} />
              </span>
              <span className="tabular text-right">{(v.value * 100).toFixed(1)}%</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="tabular m-0 flex justify-between text-xs text-ink-muted"><span>axis from {lo * 100}%</span><span>{hi * 100}%</span></p>
      <p data-variant-note aria-live="polite" className="m-0 rounded-lg border-l-2 border-accent bg-paper-raised px-4 py-2.5 text-sm text-ink">
        {current.adopted
          ? `${current.label}: the best candidate under the rule written down before the comparison, so it became the served model.`
          : current.reference
            ? `${current.label}: the model served before, the bar every candidate had to clear.`
            : `${current.label}: ${(current.value * 100).toFixed(1)}% cross-validated balanced accuracy.`}
      </p>
    </div>
  );
}

/** The three cross-validation folds of the development patients; the test patients stay locked throughout. */
export function FoldDiagram({ folds, devPatients, testPatients }: { folds: number; devPatients: number; testPatients: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3" aria-label={`${folds}-fold cross-validation over ${devPatients} development patients; ${testPatients} test patients locked`}>
      <div className="space-y-1.5">
        {Array.from({ length: folds }, (_, round) => (
          <div key={round} data-fold className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="tabular w-14">Round {round + 1}</span>
            <div className="flex flex-1 gap-1">
              {Array.from({ length: folds }, (_, part) => (
                <span key={part} className={`flex h-6 flex-1 items-center justify-center rounded text-[0.7rem] font-semibold ${part === round ? "border-2 border-accent bg-paper text-ink" : "bg-track text-ink"}`}>
                  {part === round ? "scored" : "trained"}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="tabular m-0 text-xs text-ink-muted">{devPatients} development patients</p>
      </div>
      <div className="flex w-24 flex-col items-center justify-center rounded-lg border border-dashed border-ink-soft p-2 text-center text-xs text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <span className="mt-1 font-semibold"><span className="tabular">{testPatients}</span> test patients</span>
        <span className="text-ink-muted">locked</span>
      </div>
    </div>
  );
}
