import { useMemo, useState, type KeyboardEvent } from "react";
import { SceneFrame } from "../../../components/SceneFrame";
import { Legend } from "../../../components/Legend";
import { Glyph } from "../../../components/glyphs";
import { CLASS_COLORS, classColor } from "../../../components/classColors";
import { FACTS, SAMPLE } from "../../../content/facts";
import { memberTop } from "../../../content/members";
import { SEED_READINGS, topOf } from "../../../content/seeds";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";

const EPOCHS = String(FACTS.restoredEpochs.value).split("/");

type Row = { key: string; label: string; tops: [string, number][] };

const tally = (tops: [string, number][]) =>
  tops.reduce<Record<string, number>>((acc, [c]) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});

/** One row of windows: a cell per window in the leading class's colour, shaded by how strongly it leads. */
function Strip({ row, dim, emphasis }: { row: Row; dim: boolean; emphasis: boolean }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 transition-opacity duration-300" style={{ opacity: dim ? 0.3 : 1 }}>
      <span className={`tabular text-right text-[12px] ${emphasis ? "font-semibold text-ink" : "text-ink-muted"}`}>{row.label}</span>
      <div className="flex gap-[2px]">
        {row.tops.map(([c, score], i) => (
          <span key={i} data-cell className="h-6 flex-1 origin-bottom rounded-[2px]"
                style={{ background: classColor(c), opacity: 0.45 + 0.55 * Math.min(1, score / 100) }} />
        ))}
      </div>
    </div>
  );
}

export function S07Seeds() {
  const respinet = SAMPLE.members?.find((m) => m.name === "respinet");
  const top = respinet ? memberTop(respinet) : null;
  const [selected, setSelected] = useState<number | null>(null);
  const [col, setCol] = useState<number | null>(null);

  const { seeds, average, disagree } = useMemo(() => {
    const seeds: Row[] = SEED_READINGS.map((r) => ({ key: String(r.seed), label: `seed ${r.seed}`, tops: r.windowScores.map(topOf) }));
    const average: Row = { key: "avg", label: "average", tops: (SAMPLE.window_scores ?? []).map(topOf) };
    const disagree = average.tops.map((_, w) => new Set(seeds.map((s) => s.tops[w]![0])).size > 1);
    return { seeds, average, disagree };
  }, []);
  const windows = average.tops.length;
  const disagreements = disagree.filter(Boolean).length;
  const averageCounts = tally(average.tops);
  const lead = topOf(averageCounts as Record<string, number>);
  // the copy that departs from the average most often
  const wanderer = seeds
    .map((s) => ({ seed: s.key, off: s.tops.filter(([c], w) => c !== average.tops[w]![0]).length }))
    .reduce((a, b) => (b.off > a.off ? b : a));

  const ref = useSceneTimeline<HTMLElement>("s07", (tl, root) => {
    tl.from(root.querySelectorAll("[data-seed]"), { y: 30, opacity: 0, stagger: 0.18, duration: 0.5 });
    // each copy reads the recording window by window, then the average forms underneath
    root.querySelectorAll("[data-strip]").forEach((strip, i) => {
      tl.from(strip.querySelectorAll("[data-cell]"), { scaleY: 0, opacity: 0, stagger: 0.018, duration: 0.25 }, i ? "<0.35" : ">");
    });
    tl.from(root.querySelectorAll("[data-disagree]"), { scale: 0, opacity: 0, stagger: 0.04, duration: 0.25 })
      .from(root.querySelectorAll("[data-result]"), { opacity: 0, y: 12, stagger: 0.15, duration: 0.4 });
  });

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // inspecting windows, not stepping the presentation
    setCol((c) => Math.min(windows - 1, Math.max(0, (c ?? -1) + step)));
  };
  const rows = [...seeds, average];

  return (
    <SceneFrame ref={ref} id="s07" label="Three of them" summary={`Three copies of RespiNet trained with seeds 42, 43 and 44 score every window of the sample recording; they disagree on ${disagreements} of ${windows} windows, and their average leads with ${lead[0]} in ${lead[1]}.`}>
        <SceneColumns eyebrow="Step 7 · An ensemble" title="Three of them"
          visual={
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3" role="group" aria-label="Pick a seed to highlight its reading">
                {seeds.map((s, i) => {
                  const counts = tally(s.tops);
                  const active = selected === i;
                  return (
                    <div key={s.key} data-seed>
                    <button type="button" aria-pressed={active}
                            onClick={() => setSelected(active ? null : i)}
                            className={`group w-full rounded-xl border-2 bg-paper-raised p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "border-accent shadow-md" : "border-line"}`}>
                      <span className="flex items-center gap-2">
                        <span className={`flex size-8 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-accent bg-accent text-paper" : "border-line text-ink group-hover:border-accent"}`}>
                          <Glyph name="respinet" size={16} />
                        </span>
                        <span className="leading-tight">
                          <span className="block font-serif text-[15px] text-ink">RespiNet</span>
                          <span className="tabular block text-[12px] text-ink-muted">seed {s.key}</span>
                        </span>
                      </span>
                      {/* this copy's votes over the windows, as one stacked bar */}
                      <span className="mt-3 flex h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
                        {Object.keys(CLASS_COLORS).filter((c) => counts[c]).map((c) => (
                          <span key={c} style={{ width: `${(counts[c]! / windows) * 100}%`, background: classColor(c) }} />
                        ))}
                      </span>
                      <span className="tabular mt-1.5 block text-[12px] text-ink">
                        {topOf(counts as Record<string, number>)[0]} in {topOf(counts as Record<string, number>)[1]} of {windows}
                      </span>
                      <span className="tabular block text-[11px] text-ink-muted">best at epoch {EPOCHS[i]}</span>
                    </button>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">The sample recording, window by window</p>
                <div tabIndex={0} role="group" aria-label="Windows of the sample recording; use the arrow keys to inspect one"
                     onKeyDown={onKey} onFocus={() => setCol((c) => c ?? 0)} onBlur={() => setCol(null)}
                     onPointerLeave={() => setCol(null)}
                     className="relative rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                  {/* marks where the three copies disagree */}
                  <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2" aria-hidden="true">
                    <span />
                    <div className="flex h-3 gap-[2px]">
                      {disagree.map((d, i) => (
                        <span key={i} className="flex flex-1 items-center justify-center">
                          {d && <span data-disagree className="size-1.5 rounded-full bg-warn" />}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {rows.map((row, i) => (
                      <div key={row.key} data-strip className={row.key === "avg" ? "mt-2 border-t border-dashed border-line pt-2" : ""}>
                        <Strip row={row} emphasis={row.key === "avg" || selected === i}
                               dim={selected !== null && row.key !== "avg" && selected !== i} />
                      </div>
                    ))}
                  </div>
                  {/* hover targets, one per window, over all rows */}
                  <div className="absolute inset-0 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
                    <span />
                    <div className="flex gap-[2px]">
                      {average.tops.map((_, i) => (
                        <span key={i} onPointerEnter={() => setCol(i)}
                              className={`flex-1 rounded-[3px] ${col === i ? "outline-2 outline-ink" : ""}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 min-h-[3.25rem] rounded-lg border border-line bg-paper-raised px-3 py-2 text-[12.5px]" aria-live="polite">
                  {col === null ? (
                    <span className="text-ink-muted">
                      Point at a window (or focus the strips and use ← →) to see each copy's vote.
                      <span className="ml-1 inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-warn" /> the copies disagree</span>
                    </span>
                  ) : (
                    <span className="grid gap-x-4 gap-y-0.5 sm:grid-cols-4">
                      <span className="font-semibold text-ink sm:col-span-4">Window {col + 1} of {windows}{disagree[col] ? " · the copies disagree" : ""}</span>
                      {rows.map((row) => {
                        const [c, v] = row.tops[col]!;
                        return (
                          <span key={row.key} className="flex items-center gap-1.5 text-ink">
                            <span className="size-2.5 rounded-full" style={{ background: classColor(c) }} />
                            <span className={row.key === "avg" ? "font-semibold" : ""}>{row.label}:</span>
                            <span className="tabular">{c} {v.toFixed(0)}%</span>
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
                <div className="mt-3"><Legend items={Object.keys(CLASS_COLORS).map((c) => ({ label: c, color: classColor(c) }))} /></div>
              </div>
              <p data-result className="m-0 text-ink">
                The copies disagree on <strong className="tabular">{disagreements} of {windows}</strong> windows; averaged,
                <strong> {lead[0]}</strong> leads in <span className="tabular">{lead[1]}</span>.
              </p>
              {top && (
                <p data-result className="m-0 text-ink">
                  RespiNet's score for the whole recording: <strong className="tabular">{top.label} {top.score.toFixed(1)}%</strong>
                </p>
              )}
            </div>
          }>
          <p>
            Three copies of RespiNet are trained the same way with different random seeds
            (<span className="tabular">{FACTS.seeds.display}</span>). Each scores every window, and their scores are
            averaged, window by window and then across the recording.
          </p>
          <p>
            Each copy keeps the epoch where it did best on the validation patients: epochs {FACTS.restoredEpochs.display}.
          </p>
          <p>
            Where one copy wanders, as seed {wanderer.seed} does on <span className="tabular">{wanderer.off}</span> windows of
            this recording, the other two steady the average.
          </p>
        </SceneColumns>
    </SceneFrame>
  );
}
