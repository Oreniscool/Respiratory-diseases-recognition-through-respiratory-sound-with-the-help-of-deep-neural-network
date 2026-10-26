import { SceneFrame } from "../../../components/SceneFrame";
import { Legend } from "../../../components/Legend";
import { CLASS_COLORS, classColor } from "../../../components/classColors";
import { FACTS, SAMPLE } from "../../../content/facts";
import { memberTop } from "../../../content/members";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";

const SEEDS = ["42", "43", "44"];

function WindowStripMini() {
  const windows = SAMPLE.window_scores ?? [];
  const leading = windows.map((w) => Object.entries(w).reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
  const counts = leading.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
  return (
    <div className="space-y-2">
      <div className="flex gap-[2px]">
        {leading.map((c, i) => (
          <span key={i} data-cell title={`window ${i + 1}: ${c}`} className="h-7 flex-1 rounded-[2px]" style={{ background: classColor(c) }} />
        ))}
      </div>
      <Legend items={Object.keys(CLASS_COLORS).filter((c) => counts[c]).map((c) => ({ label: c, color: classColor(c), count: counts[c] }))} />
    </div>
  );
}

export function S07Seeds() {
  const respinet = SAMPLE.members?.find((m) => m.name === "respinet");
  const top = respinet ? memberTop(respinet) : null;
  const ref = useSceneTimeline<HTMLElement>("s07", (tl, root) => {
    tl.from(root.querySelectorAll("[data-seed]"), { y: 30, opacity: 0, stagger: 0.2, duration: 0.5 })
      .from(root.querySelectorAll("[data-cell]"), { scaleY: 0, transformOrigin: "bottom", stagger: 0.02, duration: 0.3 })
      .from(root.querySelector("[data-result]"), { opacity: 0, y: 12, duration: 0.4 });
  }, { length: 170 });
  return (
    <SceneFrame ref={ref} id="s07" label="Three of them" summary="Three copies of RespiNet trained with seeds 42, 43 and 44 score every window; their scores are averaged.">
        <SceneColumns eyebrow="Step 7 · An ensemble" title="Three of them"
          visual={
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {SEEDS.map((s) => (
                  <div key={s} data-seed className="rounded-xl border border-line bg-paper-raised p-4 text-center">
                    <div className="font-serif text-lg text-ink">RespiNet</div>
                    <div className="tabular text-sm text-ink-muted">seed {s}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">The sample recording, window by window (the three copies averaged)</p>
                <WindowStripMini />
              </div>
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
        </SceneColumns>
    </SceneFrame>
  );
}
