import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { usePresenter } from "./presenter/presenterStore";

gsap.registerPlugin(ScrollTrigger, useGSAP);

import { SCENES, sceneIndex, type SceneId } from "./scenes";

export { SCENES, sceneIndex, type SceneId };

type Options = {
  /** scroll distance the scene stays pinned, in % of the viewport height */
  length?: number;
  onProgress?: (progress: number) => void;
};

/**
 * Pin a scene and drive its animation from scroll position. With reduced motion the timeline plays once
 * when the scene enters instead of scrubbing. Returns the ref for the scene's root element.
 */
export function useSceneTimeline<T extends HTMLElement = HTMLElement>(
  id: SceneId,
  build: (tl: gsap.core.Timeline, root: T) => void,
  { length = 150, onProgress }: Options = {},
) {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        id,
        trigger: root,
        start: "top top",
        end: `+=${length}%`,
        pin: true,
        scrub: reduced ? false : 0.6,
        toggleActions: reduced ? "play none none none" : undefined,
        onToggle: (self) => {
          if (self.isActive) usePresenter.getState().syncFromScroll(sceneIndex(id));
        },
        onUpdate: onProgress ? (self) => onProgress(self.progress) : undefined,
      },
    });
    build(tl, root);
  }, { scope: ref });
  return ref;
}
