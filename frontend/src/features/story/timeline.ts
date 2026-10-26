import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { usePresenter } from "./presenter/presenterStore";
import { useStage } from "../three/stage";

gsap.registerPlugin(ScrollTrigger, useGSAP);

import { SCENES, sceneIndex, type SceneId } from "./scenes";

export { SCENES, sceneIndex, type SceneId };

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
  /** scroll distance the scene stays pinned, in % of the viewport height */
  length?: number;
  onProgress?: (progress: number) => void;
  /** rebuild the timeline when these change (e.g. a chart whose data arrives from the worker) */
  deps?: unknown[];
};

/**
 * Pin a scene and drive its animation from scroll position. With reduced motion the timeline plays once
 * when the scene enters instead of scrubbing. Returns the ref for the scene's root element.
 */
export function useSceneTimeline<T extends HTMLElement = HTMLElement>(
  id: SceneId,
  build: (tl: gsap.core.Timeline, root: T) => void,
  { length = 150, onProgress, deps = [] }: Options = {},
) {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    // entrance: text reveals once as the section comes into view (at load for the first scene); the pinned,
    // scrubbed timeline below animates only the scene's visuals
    const reveal = root.querySelectorAll("[data-reveal]");
    const words = root.querySelectorAll("[data-word]");
    if (!reduced && (reveal.length || words.length)) {
      const intro = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 75%", toggleActions: "play none none none" } });
      if (words.length) intro.from(words, { yPercent: 110, opacity: 0, stagger: 0.07, duration: 0.7, ease: "power3.out" });
      if (reveal.length) intro.from(reveal, { y: 24, opacity: 0, stagger: 0.1, duration: 0.7, ease: "power2.out" }, words.length ? "-=0.35" : 0);
    }
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        id,
        trigger: root,
        // scenes can (re)build out of page order (data arrives from a worker): refresh in page order
        refreshPriority: SCENES.length - sceneIndex(id),
        start: "top top",
        end: `+=${length}%`,
        pin: true,
        scrub: reduced ? false : 0.6,
        toggleActions: reduced ? "play none none none" : undefined,
        onToggle: (self) => {
          if (self.isActive) {
            usePresenter.getState().syncFromScroll(sceneIndex(id));
            useStage.getState().enter(id);
          } else {
            useStage.getState().leave(id);
          }
        },
        onUpdate: (self) => {
          useStage.getState().setProgress(id, self.progress);
          onProgress?.(self.progress);
        },
      },
    });
    build(tl, root);
    // hold the finished state for the last stretch of the pin: the animation completes before the presenter's
    // landing point (90%) and readers get a still moment before the next scene
    if (tl.duration() > 0) tl.to({}, { duration: Math.max(0.5, tl.duration() * 0.35) });
    queueRefresh();
  }, { scope: ref, dependencies: deps, revertOnUpdate: true });
  return ref;
}
