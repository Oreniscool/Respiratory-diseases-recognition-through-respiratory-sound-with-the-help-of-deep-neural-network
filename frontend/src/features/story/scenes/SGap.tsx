import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { STORY_DATA } from "../../../content/storyData";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { NccHistogram } from "./charts/NccHistogram";

export function SGap() {
  const h = STORY_DATA.nccHistogram;
  const ref = useSceneTimeline<HTMLElement>("gap", (tl, root) => {
    tl.from(root.querySelectorAll("[data-bar]"), { scaleY: 0, transformOrigin: "50% 100%", stagger: 0.015, duration: 0.4 })
      .from(root.querySelector("[data-gap]"), { opacity: 0, duration: 0.5 });
  });
  return (
    <SceneFrame ref={ref} id="gap" label="A clean gap"
      summary={`The best match score of all ${FACTS.kaggleClips.display} Kaggle clips: ${FACTS.copiedClips.display} score at least ${FACTS.minCopyNcc.display}, every other clip at most ${FACTS.maxNonCopyNcc.display}, and none in between.`}>
      <SceneColumns eyebrow={sceneEyebrow("gap", "The result")} title="A clean gap" visual={
        <NccHistogram counts={h.counts} binWidth={h.binWidth} threshold={FACTS.nccThreshold.value}
          gap={[FACTS.maxNonCopyNcc.value, FACTS.minCopyNcc.value]} />
      }>
        <p>
          Every clip gets one number: its best match anywhere in ICBHI. The result split cleanly in two. Most clips match
          nothing. But <strong className="tabular">{FACTS.copiedClips.display}</strong> of the {FACTS.kaggleClips.display} clips
          match an ICBHI recording almost perfectly.
        </p>
        <p>
          Between them is an empty gap. The weakest copy scores <strong className="tabular">{FACTS.minCopyNcc.display}</strong>,
          the strongest non-copy <strong className="tabular">{FACTS.maxNonCopyNcc.display}</strong>, and not a single clip falls
          in between. The threshold of {FACTS.nccThreshold.display} sits in that gap.
        </p>
        <p className="text-ink"><strong>More than half</strong> of the Kaggle set is cut from ICBHI recordings.</p>
        <Why>A clean gap means the answer does not hinge on where exactly the threshold is set.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
