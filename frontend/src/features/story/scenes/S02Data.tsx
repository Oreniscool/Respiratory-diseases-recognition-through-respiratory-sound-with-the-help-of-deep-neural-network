import { SceneFrame } from "../../../components/SceneFrame";
import { Legend } from "../../../components/Legend";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { DotField, SOURCES, dotLayout } from "./charts/DotField";

export function S02Data() {
  const ref = useSceneTimeline<HTMLElement>("s02", (tl, root) => {
    const { split } = dotLayout();
    const dots = root.querySelectorAll("[data-dot]");
    tl.from(dots, { attr: { r: 0 }, stagger: 0.004, duration: 0.4 })
      .to(root.querySelector("[data-source-labels]"), { opacity: 0, duration: 0.3 }, "+=0.4")
      .to(dots, { attr: { cx: (i: number) => split[i]!.x, cy: (i: number) => split[i]!.y }, fill: "#55623f", stagger: 0.003, duration: 0.9 }, "<")
      .to(root.querySelector("[data-split-labels]"), { opacity: 1, duration: 0.3 }, "-=0.3");
  });
  return (
    <SceneFrame ref={ref} id="s02" label="The data" summary="1,551 recordings from 244 patients in three sources, split by patient into training, validation and test.">
        <SceneColumns eyebrow="Step 2 · The data" title={<><span className="tabular">{FACTS.recordings.display}</span> recordings from <span className="tabular">{FACTS.patients.display}</span> patients</>}
          visual={<div className="space-y-4"><DotField /><Legend items={SOURCES.map((s) => ({ label: s.label, color: s.color, count: s.patients }))} /><p className="text-sm text-ink-muted">One dot per patient. Colours show the source, then fade as patients are dealt into the splits.</p></div>}>
          <p>
            Three public sources: <strong>ICBHI 2017</strong> ({FACTS.icbhi.display}), the <strong>Kaggle</strong> asthma
            set ({FACTS.kaggleRemainder.display}) and <strong>KAUH</strong> ({FACTS.kauh.display}).
          </p>
          <p>
            Before any feature is computed, <strong>patients</strong> are split into training, validation and test:
            <span className="tabular"> {FACTS.splitPatients.display}</span> patients.
          </p>
          <Why>{WHY.patientSplit.text}</Why>
          <Why>{WHY.removeCopies.text}</Why>
        </SceneColumns>
    </SceneFrame>
  );
}
