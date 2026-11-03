import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { PatientSplit } from "./charts/PatientSplit";

export function SPatients() {
  const ref = useSceneTimeline<HTMLElement>("patients", (tl, root) => {
    tl.from(root.querySelectorAll("[data-tile]"), { scale: 0, opacity: 0, stagger: 0.03, duration: 0.3 });
  });
  return (
    <SceneFrame ref={ref} id="patients" illustration label="Why we split by patient"
      summary="Illustration: eight patients with three recordings each. A random split puts six of them on both sides; a split by patient puts none.">
      <SceneColumns eyebrow={sceneEyebrow("patients", "The first rule")} title="Why we split by patient" visual={<PatientSplit />}>
        <p>
          A patient's recordings sound alike: the same lungs, often the same stethoscope and room. If one recording trains the model and
          another tests it, a good score can mean the model <strong>recognised the patient</strong>, not the disease.
        </p>
        <p>
          So the first rule of everything that follows: <strong>split people, not files</strong>. Switch between the two
          splits to see the difference. Our final split keeps <span className="tabular">{FACTS.testPatients.display}</span> patients
          completely unseen.
        </p>
        <Why>{WHY.patientSplit.text}</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
