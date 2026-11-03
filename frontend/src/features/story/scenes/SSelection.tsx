import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { FoldDiagram, VariantChart } from "./charts/VariantChart";

export function SSelection() {
  const variants = FACTS.variants.value;
  const ref = useSceneTimeline<HTMLElement>("selection", (tl, root) => {
    tl.from(root.querySelectorAll("[data-fold]"), { opacity: 0, x: -12, stagger: 0.15, duration: 0.35 })
      .from(root.querySelectorAll("[data-variant-bar]"), { scaleX: 0, transformOrigin: "0% 50%", stagger: 0.08, duration: 0.4 });
  });
  return (
    <SceneFrame ref={ref} id="selection" label="Choosing fairly"
      summary={`Candidate models were compared by ${FACTS.cvFolds.display}-fold cross-validation on the ${FACTS.devPatients.display} development patients only, with the ${FACTS.testPatients.display} test patients locked away.`}>
      <SceneColumns eyebrow={sceneEyebrow("selection", "Model selection")} title="Choosing fairly" visual={
        <div className="space-y-6 rounded-xl border border-line bg-paper-raised p-5">
          <FoldDiagram folds={FACTS.cvFolds.value} devPatients={FACTS.devPatients.value} testPatients={FACTS.testPatients.value} />
          <VariantChart variants={variants} />
        </div>
      }>
        <p>
          We tried many versions: RespiNet alone, each pretrained model alone, and their combinations. Picking the winner
          by its test score would have repeated the original mistake.
        </p>
        <p>
          Instead, every candidate was scored by <strong>cross-validation</strong>: the <span className="tabular">{FACTS.devPatients.display}</span> development
          patients were split into {FACTS.cvFolds.display} groups, and each group took a turn as the one being scored. The
          {" "}<strong className="tabular">{FACTS.testPatients.display}</strong> test patients stayed locked the whole time.
        </p>
        <p>
          The rule for choosing was written down <strong>before</strong> the results came in. Choose a bar to read it.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
