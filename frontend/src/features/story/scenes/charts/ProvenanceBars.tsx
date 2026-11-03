import { useState } from "react";
import type { ClipOrigin } from "../../../../content/facts";
import { Legend } from "../../../../components/Legend";

const ORDER = ["copd", "healthy", "bronchial", "pneumonia", "asthma"];
const PARTS = [
  { id: "icbhi", label: "Cut from ICBHI", color: "var(--color-accent)" },
  { id: "kauh", label: "Cut from KAUH (Jordan)", color: "var(--color-fill-strong)" },
  { id: "untraced", label: "No source found", color: "var(--color-track)" },
] as const;

const fmt = (v: number) => v.toLocaleString("en-US");

export function originNote(name: string, o: ClipOrigin): string {
  const untraced = o.clips - o.icbhi - o.kauh;
  if (o.icbhi === o.clips) return `All ${fmt(o.clips)} ${name} clips are cut from ICBHI recordings. The Kaggle set has no ${name} audio of its own.`;
  if (o.icbhi === 0) return `None of the ${fmt(o.clips)} ${name} clips come from ICBHI, but ${fmt(o.kauh)} are cut from KAUH recordings (${fmt(untraced)} untraced).`;
  return `${fmt(o.icbhi)} of ${fmt(o.clips)} ${name} clips are cut from ICBHI${o.kauh ? `, ${fmt(o.kauh)} from KAUH` : ""}, and ${fmt(untraced)} have no source we could find.`;
}

/** Kaggle clips per class by origin; choose a class to read its story. */
export function ProvenanceBars({ origins }: { origins: Record<string, ClipOrigin> }) {
  const [selected, setSelected] = useState("copd");
  const max = Math.max(...ORDER.map((c) => origins[c]!.clips));
  return (
    <div className="space-y-4">
      <Legend items={PARTS.map((p) => ({ label: p.label, color: p.color }))} />
      <ul className="m-0 list-none space-y-2 p-0" role="radiogroup" aria-label="Choose a class">
        {ORDER.map((c) => {
          const o = origins[c]!;
          const parts = { icbhi: o.icbhi, kauh: o.kauh, untraced: o.clips - o.icbhi - o.kauh };
          return (
            <li key={c}>
              <button type="button" role="radio" aria-checked={selected === c} onClick={() => setSelected(c)}
                className={`grid w-full grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 rounded-lg border px-2 py-1.5 text-left text-sm text-ink ${selected === c ? "border-ink bg-paper-raised" : "border-transparent hover:border-line"}`}>
                <span className={selected === c ? "font-semibold" : undefined}>{c}</span>
                <span data-provenance-bar className="flex h-4 overflow-hidden rounded-sm" style={{ width: `${(o.clips / max) * 100}%` }} aria-hidden="true">
                  {PARTS.map((p) => parts[p.id] > 0 && (
                    <span key={p.id} className="block h-4" style={{ width: `${(parts[p.id] / o.clips) * 100}%`, background: p.color }} />
                  ))}
                </span>
                <span className="tabular text-right">{fmt(o.clips)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p data-provenance-note aria-live="polite" className="m-0 rounded-lg border-l-2 border-accent bg-paper-raised px-4 py-3 text-ink">
        {originNote(selected, origins[selected]!)}
      </p>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer text-ink">Data table</summary>
        <table className="tabular mt-2 w-full max-w-md text-left">
          <thead><tr><th>Class</th><th>Clips</th><th>ICBHI</th><th>KAUH</th><th>Untraced</th></tr></thead>
          <tbody>
            {ORDER.map((c) => {
              const o = origins[c]!;
              return <tr key={c}><td>{c}</td><td>{o.clips}</td><td>{o.icbhi}</td><td>{o.kauh}</td><td>{o.clips - o.icbhi - o.kauh}</td></tr>;
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
