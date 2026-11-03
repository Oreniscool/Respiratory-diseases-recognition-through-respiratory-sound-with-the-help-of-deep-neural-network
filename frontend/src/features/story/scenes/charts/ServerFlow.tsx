import { useState } from "react";
import { ArrowRight } from "../../../../components/icons";

export type Stage = { id: string; title: string; detail: string };

/** The request path as clickable steps; the chosen step's detail shows below. */
export function ServerFlow({ stages, lock }: { stages: Stage[]; lock: string }) {
  const [selected, setSelected] = useState(stages[0]!.id);
  const current = stages.find((s) => s.id === selected)!;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-accent p-4">
        <p className="m-0 mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Fail-closed: verified model files only
        </p>
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0" aria-label="Request path">
          {stages.map((s, i) => (
            <li key={s.id} data-stage className="flex items-center gap-1.5">
              <button type="button" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selected === s.id ? "border-accent bg-accent text-paper" : "border-line bg-paper-raised text-ink hover:border-ink"}`}>
                <span className="tabular mr-1.5 font-normal opacity-80">{i + 1}</span>{s.title}
              </button>
              {i < stages.length - 1 && <ArrowRight size={14} className="text-ink-soft" />}
            </li>
          ))}
        </ol>
      </div>
      <p data-stage-detail aria-live="polite" className="m-0 min-h-[4.5rem] rounded-lg border-l-2 border-accent bg-paper-raised px-4 py-3 text-ink">
        <span className="font-semibold">{current.title}. </span>{current.detail}
      </p>
      <p className="m-0 text-sm text-ink-muted">{lock}</p>
    </div>
  );
}
