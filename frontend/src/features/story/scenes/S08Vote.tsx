import { SceneFrame } from "../../../components/SceneFrame";
import { SAMPLE, WHY } from "../../../content/facts";
import { MEMBER_INFO, memberTop } from "../../../content/members";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";

export function S08Vote() {
  const members = SAMPLE.members ?? [];
  const tops = members.map((m) => ({ m, top: memberTop(m) }));
  const agree = tops.filter((t) => t.top.label === SAMPLE.model_prediction).length;
  const fused = SAMPLE.probabilities[SAMPLE.model_prediction] ?? SAMPLE.confidence;
  const ref = useSceneTimeline<HTMLElement>("s08", (tl, root) => {
    tl.from(root.querySelectorAll("[data-member]"), { x: -16, opacity: 0.2, stagger: 0.25, duration: 0.4 })
      .from(root.querySelector("[data-fused]"), { opacity: 0, y: 10, duration: 0.4 }, "+=0.3");
  }, { length: 200 });
  return (
    <SceneFrame ref={ref} id="s08" label="Four models vote" illustration
      summary={`Four models score the sample recording; ${agree} of 4 agree, and the fusion gives ${SAMPLE.model_prediction} ${fused.toFixed(1)}%.`}>
        <SceneColumns eyebrow="Step 8 · Fusion" title="Four models vote">
          <p>Three more models listen to the same recording, each with its own pretrained ear, and the four scores are averaged with equal weight.</p>
          <ul className="m-0 list-none space-y-2 p-0">
            {tops.map(({ m, top }) => (
              <li key={m.name} data-member className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                <span><strong>{MEMBER_INFO[m.name]?.label ?? m.name}</strong> <span className="text-sm">{MEMBER_INFO[m.name]?.description}</span></span>
                <span className={`tabular whitespace-nowrap ${top.label === SAMPLE.model_prediction ? "text-ink" : "font-semibold text-ink"}`}>
                  {top.label} {top.score.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          <p data-fused className="text-ink">
            On the sample, <strong>{agree} of 4 agree</strong>. Together: <strong className="tabular">{SAMPLE.model_prediction} {fused.toFixed(1)}%</strong>.
          </p>
          <Why>{WHY.fusion.text}</Why>
        </SceneColumns>
    </SceneFrame>
  );
}
