import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { SCENES } from "./timeline";
import { setScroller } from "./presenter/presenterStore";
import { usePresenterKeys } from "./presenter/usePresenterKeys";
import { ProgressStrip } from "./presenter/ProgressStrip";

/** Smooth scrolling, the scroll position for each presenter step, and the presenter HUD. */
export function StoryShell({ children }: { children: ReactNode }) {
  usePresenterKeys();

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.1, smoothWheel: !reduced });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    setScroller((index) => {
      const id = SCENES[index]!.id;
      const trigger = ScrollTrigger.getById(id);
      const element = document.querySelector<HTMLElement>(`[data-scene="${id}"]`);
      const y = trigger ? trigger.start : element ? element.getBoundingClientRect().top + window.scrollY : 0;
      // a new call retargets the running tween instead of queueing behind it
      lenis.scrollTo(y + 1, { duration: reduced ? 0 : 0.9, force: true });
    });

    return () => {
      setScroller(() => {});
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      {children}
      <ProgressStrip />
    </>
  );
}
