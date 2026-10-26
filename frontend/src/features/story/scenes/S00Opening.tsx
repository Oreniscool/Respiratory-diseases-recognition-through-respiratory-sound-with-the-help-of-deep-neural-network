import { SceneFrame } from "../../../components/SceneFrame";
import { useSceneTimeline } from "../timeline";

export function S00Opening() {
  // no visuals of its own: the 3D lungs turn slowly while the timeline runs
  const ref = useSceneTimeline<HTMLElement>("s00", () => {}, { minDuration: 6 });
  const words = "How a machine listens to your lungs".split(" ");
  return (
    <SceneFrame ref={ref} id="s00" label="Opening" summary="RespiNet, a research prototype, explained step by step: from a stethoscope recording to the model's scores.">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 lg:px-12">
        <div className="relative z-10 max-w-2xl">
          <p data-reveal className="eyebrow m-0">RespiNet · Lung-sound classification</p>
          <h1 className="mt-5 mb-8" aria-label="How a machine listens to your lungs">
            {words.map((w, i) => (
              <span key={i}>
                <span className="inline-block overflow-hidden pb-1 align-bottom">
                  <span data-word className="inline-block">{w}</span>
                </span>
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p data-reveal className="max-w-lg text-lg text-ink-muted">
            Follow one stethoscope recording through every step of RespiNet: how the sound is cleaned, measured and
            scored, why each step is there, and what the model finally says.
          </p>
          <p data-reveal className="mt-5 inline-block rounded-full border border-line bg-paper-raised px-3 py-1 text-sm text-ink">
            A research prototype, not a diagnostic device
          </p>
          <p className="mt-14 text-sm text-ink-muted">Scroll to begin · press <kbd className="font-semibold text-ink">P</kbd> for presenter mode</p>
        </div>
      </div>
    </SceneFrame>
  );
}
