import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, WHY } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useSceneAudio } from "../useSceneAudio";
import { FilterBands } from "./charts/FilterBands";

export function S03Cleaning() {
  const { analysis } = useSceneAudio("normal");
  const ref = useSceneTimeline<HTMLElement>("s03", (tl, root) => {
    // the three pitch zones appear, the outer two are struck through, then the cleaned waveform draws in
    tl.from(root.querySelectorAll("[data-zone]"), { opacity: 0, y: 14, stagger: 0.25, duration: 0.5 })
      .from(root.querySelectorAll("[data-cut]"), { opacity: 0, duration: 0.5 }, "+=0.3")
      .from(root.querySelectorAll("[data-verdict]"), { opacity: 0, scale: 0.6, stagger: 0.12, duration: 0.35 }, "<")
      .from(root.querySelector("[data-before]"), { opacity: 0, duration: 0.5 }, "+=0.2")
      .from(root.querySelector("[data-filter-step]"), { opacity: 0, duration: 0.4 })
      .from(root.querySelector("[data-after]"), { clipPath: "inset(0 100% 0 0)", duration: 1.2, ease: "power1.inOut" });
  }, { deps: [analysis] });
  return (
    <SceneFrame ref={ref} id="s03" label="Cleaning the signal" summary="A band-pass filter keeps 100 to 2,000 Hz, removing heartbeat rumble and high-frequency noise.">
        <SceneColumns eyebrow="Step 3 · Cleaning" title="Cleaning the signal"
          visual={analysis && <FilterBands analysis={analysis} />}>
          <p>
            A {FACTS.filterOrder.display}th-order Butterworth band-pass keeps <strong>100–2,000 Hz</strong>, where
            breath sounds live, and removes everything below and above.
          </p>
          <Why>{WHY.bandpass.text}</Why>
        </SceneColumns>
    </SceneFrame>
  );
}
