import { SceneFrame } from "../../../components/SceneFrame";
import { Legend } from "../../../components/Legend";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useSceneAudio } from "../useSceneAudio";
import { SpectrumBand } from "./charts/SpectrumBand";

export function S03Cleaning() {
  const { analysis } = useSceneAudio("normal");
  const ref = useSceneTimeline<HTMLDivElement>("s03", (tl, root) => {
    tl.from(root.querySelector("[data-band]"), { scaleX: 0, transformOrigin: "left center", duration: 0.6 })
      .from(root.querySelector("[data-filtered]"), { opacity: 0, duration: 0.6 }, "+=0.2")
      .to(root.querySelector("[data-raw]"), { opacity: 0.35, duration: 0.6 }, "<");
  });
  return (
    <SceneFrame id="s03" label="Cleaning the signal" summary="A band-pass filter keeps 100 to 2,000 Hz, removing heartbeat rumble and high-frequency noise.">
      <div ref={ref}>
        <SceneColumns eyebrow="Step 3 · Cleaning" title="Cleaning the signal"
          visual={analysis && (
            <div className="space-y-3">
              <SpectrumBand analysis={analysis} />
              <Legend items={[{ label: "before", color: "#9aa58a" }, { label: "after the band-pass", color: "#198076" }]} />
            </div>
          )}>
          <p>
            A {FACTS.filterOrder.display}th-order Butterworth band-pass keeps <strong>100–2,000 Hz</strong>, where
            breath sounds live, and removes everything below and above.
          </p>
          <Why>{WHY.bandpass.text}</Why>
        </SceneColumns>
      </div>
    </SceneFrame>
  );
}
