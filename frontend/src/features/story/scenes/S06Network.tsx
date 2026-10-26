import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";

const STEPS = [
  { title: "Multi-scale convolutions", text: "kernels of 3, 5 and 11 frames pick out short and longer sound patterns" },
  { title: "BiGRU-128", text: "reads the window forwards and backwards in time" },
  { title: "BiGRU-64 and dual pooling", text: "summarise the whole window into one description" },
  { title: "Dense layers", text: "turn that description into five scores" },
];

export function S06Network() {
  const ref = useSceneTimeline<HTMLElement>("s06", (tl, root) => {
    tl.from(root.querySelectorAll("[data-step]"), { x: -16, opacity: 0.25, stagger: 0.35, duration: 0.4 });
  }, { length: 200 });
  return (
    <SceneFrame ref={ref} id="s06" label="Inside RespiNet" illustration
      summary="RespiNet reads each 200 by 120 fingerprint with multi-scale convolutions, two bidirectional GRUs with a residual skip, dual pooling and dense layers, ending in five scores.">
        <SceneColumns eyebrow="Step 6 · The network" title="Inside RespiNet">
          <ol className="m-0 list-none space-y-3 p-0">
            {STEPS.map((s, i) => (
              <li key={s.title} data-step className="flex gap-3">
                <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{i + 1}</span>
                <span><strong>{s.title}</strong> {s.text}.</span>
              </li>
            ))}
          </ol>
          <Why>{WHY.residualSkip.text}</Why>
          <Why>{WHY.dualPooling.text}</Why>
          <p className="text-sm"><span className="tabular font-semibold text-ink">{FACTS.parameters.display}</span> learned parameters.</p>
        </SceneColumns>
    </SceneFrame>
  );
}
