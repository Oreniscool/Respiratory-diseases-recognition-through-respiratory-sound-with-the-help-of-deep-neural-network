import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { STORY_DATA } from "../../../content/storyData";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { TrainingCurves } from "./charts/TrainingCurves";

export function STraining() {
  const curve = STORY_DATA.trainingCurve;
  const ref = useSceneTimeline<HTMLElement>("training", (tl, root) => {
    const paths = root.querySelectorAll<SVGPathElement>("[data-curve]");
    paths.forEach((p) => {
      const length = p.getTotalLength?.() ?? 800;
      tl.fromTo(p, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.2 }, 0);
    });
    tl.from(root.querySelectorAll("[data-patience]"), { opacity: 0, duration: 0.5 });
  });
  return (
    <SceneFrame ref={ref} id="training" label="How it learns"
      summary={`RespiNet trains for up to ${FACTS.maxEpochs.display} epochs and stops after ${FACTS.patience.display} epochs without a better validation accuracy; the best epoch is restored and saved.`}>
      <SceneColumns eyebrow={sceneEyebrow("training", "Training")} title="How it learns" visual={
        curve ? <TrainingCurves curve={curve} patience={FACTS.patience.value} />
          : <p className="text-ink-muted">The training curve is generated from the served model's artifacts.</p>
      }>
        <p>
          The network sees the training windows in batches of <strong className="tabular">{FACTS.batchSize.display}</strong>,
          for up to <strong className="tabular">{FACTS.maxEpochs.display}</strong> passes (epochs). The learning rate starts at
          {" "}{FACTS.learningRate.display} and eases down along a cosine curve.
        </p>
        <p>
          After each epoch it is scored on the <strong>validation patients</strong>, never the test patients. When
          validation accuracy has not improved for <strong className="tabular">{FACTS.patience.display}</strong> epochs, training
          stops and the best epoch is restored.
        </p>
        <p>Drag through the epochs: training accuracy keeps climbing, validation levels off. That gap is where memorising begins.</p>
      </SceneColumns>
    </SceneFrame>
  );
}
