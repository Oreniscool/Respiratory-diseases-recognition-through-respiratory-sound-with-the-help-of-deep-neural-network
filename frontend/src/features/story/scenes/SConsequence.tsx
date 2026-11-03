import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { pct1 as pct } from "./charts/chartText";
import { ContaminationBars } from "./charts/ContaminationBars";


export function SConsequence() {
  const within = FACTS.contaminationWithin.value;
  const between = FACTS.contaminationBetween.value;
  const copd = within.copd!;
  const healthy = between.healthy!;
  const ref = useSceneTimeline<HTMLElement>("consequence", (tl, root) => {
    tl.from(root.querySelectorAll("[data-contrast]"), { opacity: 0, x: -16, stagger: 0.15, duration: 0.4 });
  });
  return (
    <SceneFrame ref={ref} id="consequence" label="What copies do to a test"
      summary={`A Kaggle-trained model scores ${pct(copd.a)} on copied ICBHI COPD recordings and ${pct(copd.b)} on clean ones. Trained without the copies, its accuracy on copied healthy recordings falls from ${pct(healthy.a)} to ${pct(healthy.b)}.`}>
      <SceneColumns eyebrow={sceneEyebrow("consequence", "Why it matters")} title="What copies do to a test" visual={
        <ContaminationBars within={within} between={between} />
      }>
        <p>
          A natural way to test a model trained on the Kaggle set is to score it on ICBHI as new, "external" data, and
          published work has done this. But part of ICBHI is already inside the Kaggle set. We measured what that does.
        </p>
        <p>
          We trained models on the Kaggle set alone and scored every ICBHI recording. On COPD, the model was right
          <strong className="tabular"> {pct(copd.a)}</strong> of the time on recordings that had been copied into Kaggle, and
          <strong className="tabular"> {pct(copd.b)}</strong> on clean ones.
        </p>
        <p>
          Switch to <strong>Same recordings</strong>: without the copies in training, accuracy on the copied healthy
          recordings falls from <strong className="tabular">{pct(healthy.a)}</strong> to <strong className="tabular">{pct(healthy.b)}</strong>.
          Such a test partly re-tests audio the model has already heard.
        </p>
        <Why>We report this as an association: the compared groups hold different patients, and removing the copies also
          shrinks training ({FACTS.c4TrainingRecordings.display} recordings). The two designs fail in different ways and point the same way.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
