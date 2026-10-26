import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS, SAMPLE } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useSceneAudio } from "../useSceneAudio";
import { WindowSlider } from "./charts/WindowSlider";

export function S04Slicing() {
  const { analysis } = useSceneAudio("normal");
  const ref = useSceneTimeline<HTMLDivElement>("s04", (tl, root) => {
    const win = root.querySelector<HTMLElement>("[data-window]");
    if (win?.parentElement) {
      const travel = win.parentElement.clientWidth - win.clientWidth;
      tl.to(root.querySelector("[data-window-ghost]"), { opacity: 1, duration: 0.3 })
        .to(win, { x: travel, ease: "steps(6)", duration: 2 });
    }
  }, { length: 180 });
  const minutes = Math.round(SAMPLE.duration_s);
  return (
    <SceneFrame id="s04" label="Slicing time" summary="The recording is resampled to 22,050 Hz and cut into overlapping 200-frame windows.">
      <div ref={ref}>
        <SceneColumns eyebrow="Step 4 · Windows" title="Slicing time" visual={analysis && <WindowSlider analysis={analysis} />}>
          <p>
            The sound is resampled to <span className="tabular">{FACTS.sampleRate.display}</span> Hz and cut into windows of
            <strong> 200 frames</strong> (about 4.6 seconds), each starting {FACTS.windowHop.display} frames after the
            last, so neighbouring windows overlap by half.
          </p>
          <p>
            A {minutes}-second recording becomes <strong>{SAMPLE.windows_analyzed} windows</strong>. The last one is
            anchored to the end, so no audio is dropped.
          </p>
        </SceneColumns>
      </div>
    </SceneFrame>
  );
}
