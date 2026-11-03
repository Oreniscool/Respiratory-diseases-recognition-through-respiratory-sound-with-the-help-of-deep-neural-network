import { SceneFrame } from "../../../components/SceneFrame";
import { Legend } from "../../../components/Legend";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { sceneEyebrow } from "../scenes";
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
        <SceneColumns eyebrow={sceneEyebrow("s02", "The data")} title={<><span data-countup className="tabular">{FACTS.recordings.display}</span> recordings from <span data-countup className="tabular">{FACTS.patients.display}</span> patients</>}
          visual={<div className="space-y-4"><DotField /><Legend items={SOURCES.map((s) => ({ label: s.label, color: s.color, count: s.patients }))} /><p className="text-sm text-ink-muted">One dot per patient. Colours show the source, then fade as patients are dealt into the splits.</p></div>}>
          <p>
            With the copies gone, this is the data RespiNet learns from: <strong>ICBHI 2017</strong> ({FACTS.icbhi.display}),
            what remains of the <strong>Kaggle</strong> set ({FACTS.kaggleRemainder.display}) and <strong>KAUH</strong>
            ({FACTS.kauh.display}).
          </p>
          <p>
            Following the first rule, whole <strong>patients</strong> are dealt into training, validation and test
            (<span className="tabular">{FACTS.splitPatients.display}</span>) before a single feature is computed.
          </p>
        </SceneColumns>
    </SceneFrame>
  );
}
