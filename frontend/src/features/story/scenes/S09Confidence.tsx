import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { ReliabilityChart } from "./charts/ReliabilityChart";

export function S09Confidence() {
  const ref = useSceneTimeline<HTMLElement>("s09", (tl, root) => {
    const curve = root.querySelector<SVGPathElement>("[data-curve]");
    const length = curve?.getTotalLength?.() ?? 600;
    tl.from(root.querySelector("[data-diagonal]"), { opacity: 0, duration: 0.3 })
      .fromTo(curve, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1 })
      .from(root.querySelectorAll("[data-bin]"), { attr: { r: 0 }, stagger: 0.1, duration: 0.3 }, "-=0.6");
  }, { length: 170 });
  return (
    <SceneFrame ref={ref} id="s09" label="Honest confidence" summary="Temperature scaling makes the scores honest: on test recordings, the score tracks how often the model is right.">
        <SceneColumns eyebrow="Step 9 · Calibration" title="Honest confidence"
          visual={<ReliabilityChart bins={FACTS.reliabilityBins.value} />}>
          <p>
            The fused scores pass through <strong>temperature scaling</strong> (T = <span className="tabular">{FACTS.fusedTemperature.display}</span>),
            fitted on the validation patients only. It lowered the validation log-loss from {FACTS.nllBefore.display} to {FACTS.nllAfter.display}.
          </p>
          <p>
            On the test recordings the average gap between score and reality (expected calibration error) is
            <span className="tabular"> {FACTS.eceTest.display}</span>: points near the dashed line mean the score can be read at face value.
          </p>
          <Why>{WHY.calibration.text}</Why>
        </SceneColumns>
    </SceneFrame>
  );
}
