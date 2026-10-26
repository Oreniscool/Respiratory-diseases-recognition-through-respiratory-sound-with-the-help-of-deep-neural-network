import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { usePresenter } from "./presenter/presenterStore";
import { useStage } from "../three/stage";

gsap.registerPlugin(ScrollTrigger, useGSAP);

if (import.meta.env.DEV && typeof window !== "undefined") {
  // dev-only handle for debugging scroll geometry in the browser
  (window as unknown as { __ScrollTrigger: typeof ScrollTrigger }).__ScrollTrigger = ScrollTrigger;
}

import { SCENES, sceneIndex, type SceneId } from "./scenes";

export { SCENES, sceneIndex, type SceneId };

/** Scene timelines are written in seconds; this slows them all to a comfortable presenting pace. */
export const PACE = 0.7;
/** A scene counts as open while the line at this height of the viewport lies inside it. */
const OPEN_LINE = "40%";

let refreshQueued = false;
/** Recompute every trigger once per frame after scenes (re)build, in page order. */
function queueRefresh(): void {
  if (refreshQueued || typeof window === "undefined") return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
}

type Options = {
  /** rebuild the timeline when these change (e.g. a chart whose data arrives from the worker) */
  deps?: unknown[];
  /** shortest run in seconds (before PACE): 3D scenes read their progress from the timeline */
  minDuration?: number;
};

/**
 * Play a scene's animation in real time each time the scene opens (scrolled to, or stepped to in presenter
 * mode), instead of tying it to the scroll position. With reduced motion the scene shows its finished state.
 * Returns the ref for the scene's root element.
 */
export function useSceneTimeline<T extends HTMLElement = HTMLElement>(
  id: SceneId,
  build: (tl: gsap.core.Timeline, root: T) => void,
  { deps = [], minDuration = 0 }: Options = {},
) {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    // text first: headline words rise, then the reveal blocks; the visuals start alongside
    const intro = gsap.timeline({ paused: true });
    const words = root.querySelectorAll("[data-word]");
    const reveal = root.querySelectorAll("[data-reveal]");
    if (!reduced) {
      if (words.length) intro.from(words, { yPercent: 110, opacity: 0, stagger: 0.07, duration: 0.7, ease: "power3.out" });
      if (reveal.length) intro.from(reveal, { y: 24, opacity: 0, stagger: 0.1, duration: 0.7, ease: "power2.out" }, words.length ? "-=0.35" : 0);
    }
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
      onUpdate: () => useStage.getState().setProgress(id, tl.progress()),
    });
    build(tl, root);
    if (tl.duration() < minDuration) tl.to({}, { duration: minDuration - tl.duration() });
    tl.timeScale(PACE);
    intro.timeScale(PACE);

    const open = () => {
      usePresenter.getState().syncFromScroll(sceneIndex(id));
      useStage.getState().enter(id);
      if (reduced) {
        intro.progress(1);
        tl.progress(1);
      } else {
        intro.restart();
        tl.restart(true); // a short beat after the scene settles
      }
    };
    ScrollTrigger.create({
      id,
      trigger: root,
      // scenes can (re)build out of page order (data arrives from a worker): refresh in page order
      refreshPriority: SCENES.length - sceneIndex(id),
      start: `top ${OPEN_LINE}`,
      end: `bottom ${OPEN_LINE}`,
      onToggle: (self) => {
        if (self.isActive) open();
        else useStage.getState().leave(id);
      },
    });
    tl.delay(0.25);
    queueRefresh();
  }, { scope: ref, dependencies: deps, revertOnUpdate: true });
  return ref;
}
