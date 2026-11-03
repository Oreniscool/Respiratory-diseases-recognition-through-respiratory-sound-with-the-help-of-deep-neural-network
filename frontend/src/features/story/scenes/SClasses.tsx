import { useState } from "react";
import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { ClassBars, ClassSankey } from "./charts/ClassSankey";

export function SClasses() {
  const [added, setAdded] = useState(false);
  const icbhi = FACTS.icbhiRecordingsByClass.value;
  const kaggle = Object.fromEntries(Object.entries(FACTS.clipOrigins.value).map(([c, o]) => [c, o.clips]));
  const icbhiTotal = Object.values(icbhi).reduce((a, b) => a + b, 0);
  const icbhiPatients = Object.values(FACTS.icbhiDiagnoses.value).reduce((a, b) => a + b, 0);
  const ref = useSceneTimeline<HTMLElement>("classes", (tl, root) => {
    tl.from(root.querySelectorAll("[data-flow]"), { opacity: 0, stagger: 0.08, duration: 0.4 });
  });
  return (
    <SceneFrame ref={ref} id="classes" label="Five classes from eight"
      summary={`ICBHI's eight diagnoses become five classes. ICBHI's recordings are mostly COPD (${icbhi.copd} of ${icbhiTotal}), so a Kaggle set of ${FACTS.kaggleClips.display} clips was added to fill the other classes.`}>
      <SceneColumns eyebrow={sceneEyebrow("classes", "Building the dataset")} title="Five classes from eight" visual={
        <div className="space-y-6">
          <ClassSankey diagnoses={FACTS.icbhiDiagnoses.value} />
          <div className="space-y-3 rounded-xl border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-ink">Recordings per class</p>
              <button type="button" aria-pressed={added} onClick={() => setAdded(!added)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${added ? "border-accent bg-accent text-paper" : "border-ink text-ink"}`}>
                {added ? "Kaggle set added" : `Add the Kaggle set (${FACTS.kaggleClips.display} clips)`}
              </button>
            </div>
            <ClassBars icbhi={icbhi} kaggle={kaggle} added={added} />
          </div>
        </div>
      }>
        <p>
          ICBHI 2017 labels each of its <span className="tabular">{icbhiPatients}</span> patients with one of eight diagnoses. Some
          have only one or two patients, too few to split into training, validation and test. We grouped them into
          <strong> five classes</strong>: four airway conditions (URTI, bronchiectasis, bronchiolitis and LRTI) became
          <strong> bronchial</strong>.
        </p>
        <p>
          ICBHI is also lopsided: <strong className="tabular">{icbhi.copd} of {icbhiTotal}</strong> recordings are COPD and
          only <strong className="tabular">{icbhi.asthma}</strong> is asthma. A public Kaggle set, the <em>Asthma Detection
          Dataset V2</em>, offered <strong className="tabular">{FACTS.kaggleClips.display}</strong> more clips across the same
          five classes. Add it and the gaps seem to close.
        </p>
        <p className="text-ink">So we merged them. Then we asked where those clips came from.</p>
      </SceneColumns>
    </SceneFrame>
  );
}
