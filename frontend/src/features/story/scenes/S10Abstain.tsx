import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, SAMPLE, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { AbstainGauge } from "./charts/AbstainGauge";

export function S10Abstain() {
  const u = SAMPLE.uncertainty;
  const ref = useSceneTimeline<HTMLElement>("s10", (tl, root) => {
    tl.from(root.querySelectorAll("[data-marker]"), { left: "0%", stagger: 0.3, duration: 0.8 });
  }, { length: 150 });
  return (
    <SceneFrame ref={ref} id="s10" label="Knowing when to abstain" summary="The model answers only when its top score is at least 66.3% and its uncertainty is at most 0.51; otherwise it says it is unsure.">
        <SceneColumns eyebrow="Step 10 · Abstention" title="Knowing when to abstain"
          visual={
            <div className="space-y-8 rounded-xl border border-line bg-paper-raised p-6">
              <AbstainGauge label="Top score" value={SAMPLE.confidence} limit={FACTS.minConfidence.value * 100} max={100}
                format={(v) => `${v.toFixed(1)}%`} passWhen="above" />
              <AbstainGauge label="Uncertainty (normalised entropy)" value={u.normalized_entropy} limit={FACTS.maxEntropy.value} max={1}
                format={(v) => v.toFixed(2)} passWhen="below" />
              <p className="m-0 border-t border-line pt-4 font-semibold text-ink">
                {SAMPLE.uncertain ? "The model would say it is unsure." : "Both rules pass: the model gives an answer."}
              </p>
            </div>
          }>
          <p>
            Two rules decide whether the model answers: the top score must be at least
            <strong className="tabular"> {FACTS.minConfidence.display}</strong>, and the uncertainty across the five
            classes must be at most <strong className="tabular">{FACTS.maxEntropy.display}</strong>.
          </p>
          <p>Both limits were set on the validation patients so that the model answers about {FACTS.coverage.display} of the time.</p>
          <Why>{WHY.abstention.text}</Why>
        </SceneColumns>
    </SceneFrame>
  );
}
