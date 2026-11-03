import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { pct1 } from "./charts/chartText";
import { LeakControls } from "./charts/LeakLadder";

export function SLeaks() {
  const ladder = FACTS.leakLadder.value;
  // the 3D bar grid (or its 2D fallback) reads the timeline's progress to raise its bars
  const ref = useSceneTimeline<HTMLElement>("leaks", (tl, root) => {
    tl.from(root.querySelector("[data-leak-controls]"), { y: 20, opacity: 0, duration: 0.6 }, 0.4);
  }, { minDuration: 3.5 });
  return (
    <SceneFrame ref={ref} id="leaks" label="Finding the leaks"
      summary={`Re-running the original protocol with each leak removed: balanced accuracy goes from ${pct1(ladder.sample.test)} with all leaks to ${pct1(ladder.patient.validation)} with none (chance ${FACTS.leakChance.display}).`}>
      <SceneColumns eyebrow={sceneEyebrow("leaks", "Switching the leaks off")} title="Finding the leaks">
        <p>
          We re-ran the original model <strong>{FACTS.leakRepeats.display} times</strong> per setting and switched its leaks
          off one at a time. Each bar is one setting; choose one below.
        </p>
        <p>
          All leaks in: <strong className="tabular">{pct1(ladder.sample.test)}</strong>. Patients split apart and the
          checkpoint chosen on validation data: <strong className="tabular">{pct1(ladder.patient.validation)}</strong>, where
          guessing scores {FACTS.leakChance.display}. The reported {FACTS.reportedAccuracy.display} could not be reproduced from
          the published materials.
        </p>
        <LeakControls />
        <Why>Balanced accuracy averages the per-class results, so a class that dominates the test set cannot hide misses on the small ones.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
