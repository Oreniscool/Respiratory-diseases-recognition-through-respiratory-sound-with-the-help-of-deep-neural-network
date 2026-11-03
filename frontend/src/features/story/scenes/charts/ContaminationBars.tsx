import { useState } from "react";
import type { Contrast } from "../../../../content/facts";
import { Legend } from "../../../../components/Legend";

type Design = "within" | "between";
type Props = { within: Record<string, Contrast>; between: Record<string, Contrast> };

const DESIGNS: Record<Design, { tab: string; a: string; b: string; question: string }> = {
  within: {
    tab: "Same model", a: "copied recordings", b: "clean recordings",
    question: "One model trained on the Kaggle set, scored on ICBHI recordings of the same class: were they copied into Kaggle or not?",
  },
  between: {
    tab: "Same recordings", a: "trained with the copies", b: "trained without them",
    question: "The same copied ICBHI recordings, scored by a model trained with the copies and by one trained without them.",
  },
};

const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;

/** Accuracy on ICBHI recordings in two designs, with the 95% patient-bootstrap interval of the difference. */
export function ContaminationBars({ within, between }: Props) {
  const [design, setDesign] = useState<Design>("within");
  const d = DESIGNS[design];
  const rows = design === "within" ? within : between;
  return (
    <div className="space-y-4 rounded-xl border border-line bg-paper-raised p-5">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Design">
        {(Object.keys(DESIGNS) as Design[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={design === k} onClick={() => setDesign(k)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${design === k ? "border-accent bg-accent text-paper" : "border-line bg-paper text-ink hover:border-ink"}`}>
            {DESIGNS[k].tab}
          </button>
        ))}
      </div>
      <p className="m-0 text-sm text-ink-muted">{d.question}</p>
      <Legend items={[{ label: d.a, color: "var(--color-accent)" }, { label: d.b, color: "var(--color-ink-soft)" }]} />
      <ul role="tabpanel" className="m-0 list-none space-y-4 p-0">
        {Object.entries(rows).map(([name, r]) => {
          const inconclusive = r.ci[0] <= 0;
          return (
            <li key={`${design}-${name}`} data-contrast className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm text-ink">
                <span className="font-semibold">{name} <span className="font-normal text-ink-muted">· {r.patients} patients</span></span>
                <span className="tabular">
                  difference <span className="font-semibold">{pts(r.a - r.b)}</span> points
                  <span className="text-ink-muted"> [{pts(r.ci[0])}, {pts(r.ci[1])}]</span>
                  {inconclusive && <span className="text-ink-muted"> · inconclusive</span>}
                </span>
              </div>
              {([[r.a, "var(--color-accent)", d.a], [r.b, "var(--color-ink-soft)", d.b]] as const).map(([v, color, label]) => (
                <div key={label} className="grid grid-cols-[1fr_3.5rem] items-center gap-3">
                  <span className="h-3 rounded-full bg-track" aria-hidden="true">
                    <span className="block h-3 rounded-full transition-[width] duration-700 ease-out-soft" style={{ width: `${v * 100}%`, background: color }} />
                  </span>
                  <span className="tabular text-right text-sm text-ink" aria-label={`${label}: ${(v * 100).toFixed(1)}%`}>{(v * 100).toFixed(1)}%</span>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-xs text-ink-muted">Recording-level accuracy; brackets: 95% patient-bootstrap interval of the difference.</p>
    </div>
  );
}
