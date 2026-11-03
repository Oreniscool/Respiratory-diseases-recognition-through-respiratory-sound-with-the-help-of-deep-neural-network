import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { NccMatcher } from "./charts/NccMatcher";

export function SMatch() {
  const ref = useSceneTimeline<HTMLElement>("match", (tl, root) => {
    tl.from(root.querySelector("[data-ncc-clip]"), { opacity: 0, y: -12, duration: 0.6 });
  });
  return (
    <SceneFrame ref={ref} id="match" illustration label="Matching a clip to a recording"
      summary={`Illustration of the audit method: a short clip is slid along every ICBHI recording and compared at each position; a normalised cross-correlation of at least ${FACTS.nccThreshold.display} marks a copy.`}>
      <SceneColumns eyebrow={sceneEyebrow("match", "The audit")} title="Matching a clip to a recording" visual={
        <NccMatcher threshold={FACTS.nccThreshold.value} />
      }>
        <p>
          To find out where each Kaggle clip came from, we took every one of the <strong className="tabular">{FACTS.kaggleClips.display}</strong> clips
          and slid it along every one of ICBHI's <strong className="tabular">{FACTS.icbhi.display.split(" ")[0]}</strong> recordings.
        </p>
        <p>
          At each position we measure how alike the two sounds are: <strong>normalised cross-correlation</strong>, from 0
          (unrelated) to 1 (identical). Volume doesn't matter, only shape. A clip that was cut out of a recording scores
          close to 1 at exactly the place it was cut from.
        </p>
        <p>Drag the clip and watch the score jump where it fits.</p>
        <Why>Both signals are first brought to {FACTS.matchRate.display} and filtered to {FACTS.matchBand.display}, a band every version of the audio shares, so resampling or hiss can't hide a copy.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
