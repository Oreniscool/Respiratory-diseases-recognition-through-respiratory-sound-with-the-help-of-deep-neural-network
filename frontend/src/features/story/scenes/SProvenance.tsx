import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { ProvenanceBars } from "./charts/ProvenanceBars";

export function SProvenance() {
  const ref = useSceneTimeline<HTMLElement>("provenance", (tl, root) => {
    tl.from(root.querySelectorAll("[data-provenance-bar]"), { scaleX: 0, transformOrigin: "0% 50%", stagger: 0.12, duration: 0.5 });
  });
  const copd = FACTS.clipOrigins.value.copd!;
  const asthma = FACTS.clipOrigins.value.asthma!;
  return (
    <SceneFrame ref={ref} id="provenance" label="Where the clips came from"
      summary={`Of ${FACTS.kaggleClips.display} Kaggle clips, ${FACTS.copiedClips.display} are cut from ICBHI, ${FACTS.kauhCutClips.display} from KAUH recordings and ${FACTS.untracedClips.display} have no traced source. All ${copd.clips} COPD clips are ICBHI audio.`}>
      <SceneColumns eyebrow={sceneEyebrow("provenance", "By class")} title="Where the clips came from" visual={
        <ProvenanceBars origins={FACTS.clipOrigins.value} />
      }>
        <p>
          We ran the same search against a second public database, <strong>KAUH</strong> (recorded in Jordan). Every Kaggle
          clip now has an origin: <strong className="tabular">{FACTS.copiedClips.display}</strong> cut from ICBHI,
          <strong className="tabular"> {FACTS.kauhCutClips.display}</strong> cut from KAUH, and
          <strong className="tabular"> {FACTS.untracedClips.display}</strong> with no source we could find.
        </p>
        <p>
          The pattern follows the classes. <strong>Every one of the {copd.clips} COPD clips</strong> is ICBHI audio, and
          {" "}{asthma.kauh} of the {asthma.clips} asthma clips are KAUH audio. Choose a class to read its story.
        </p>
        <p>
          The Kaggle page does name ICBHI as a source. What it doesn't show is how much, in which classes, and how the
          clips were cut. That is what decides whether a test is fair.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
