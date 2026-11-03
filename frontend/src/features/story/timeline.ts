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

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Count every number in an element's text up from zero, keeping its decimals and thousands separators.
 *  `data-countup="first"` counts only the first number (e.g. "99 of 100"). */
function countUp(tl: gsap.core.Timeline, el: HTMLElement, at: number): void {
  const final = (el.dataset.countupFinal ??= el.textContent ?? "");
  const firstOnly = el.dataset.countup === "first";
  const state = { p: 0 };
  const render = () => {
    let n = 0;
    el.textContent = final.replace(NUMBER, (token) => {
      if (firstOnly && n++ > 0) return token;
      const decimals = token.split(".")[1]?.length ?? 0;
      const value = Number(token.replace(/,/g, "")) * state.p;
      return token.includes(",")
        ? value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : value.toFixed(decimals);
    });
  };
  tl.fromTo(state, { p: 0 }, { p: 1, duration: 1.3, ease: "power2.out", onUpdate: render, onStart: render,
    onComplete: () => { el.textContent = final; } }, at);
}

/** The chapter card: wipes in from the left, holds, wipes out to the right. Returns its length in seconds. */
function chapterCard(tl: gsap.core.Timeline, card: HTMLElement): number {
  const title = card.querySelector("[data-chapter-title]");
  const number = card.querySelector("[data-chapter-number]");
  tl.set(card, { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" }, 0)
    .to(card, { clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power3.inOut" }, 0)
    .from(number, { y: 16, opacity: 0, duration: 0.4 }, 0.2)
    .from(title, { y: 28, opacity: 0, duration: 0.5, ease: "power3.out" }, 0.3)
    .to(card, { clipPath: "inset(0 0 0 100%)", duration: 0.45, ease: "power3.inOut" }, 1.2)
    .set(card, { autoAlpha: 0 }, 1.65);
  // the scene's text starts rising while the card wipes away
  return 1.35;
}

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
    const card = root.querySelector<HTMLElement>("[data-chapter-intro]");
    const visual = [...root.querySelectorAll<HTMLElement>("[data-visual]")].filter((v) => v.childElementCount > 0);
    const counters = root.querySelectorAll<HTMLElement>("[data-countup]");
    let cardSeconds = 0;
    if (!reduced) {
      if (card) cardSeconds = chapterCard(intro, card);
      if (words.length) intro.from(words, { yPercent: 110, opacity: 0, stagger: 0.07, duration: 0.7, ease: "power3.out" });
      if (reveal.length) intro.from(reveal, { y: 24, opacity: 0, stagger: 0.1, duration: 0.7, ease: "power2.out" }, words.length ? "-=0.35" : cardSeconds);
      if (visual.length) intro.from(visual, { x: 48, opacity: 0, duration: 0.9, ease: "power3.out" }, cardSeconds + 0.15);
      counters.forEach((el) => countUp(intro, el, cardSeconds + 0.3));
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
    // the scene's own animation starts once the chapter card (if any) has cleared
    tl.delay(0.25 + cardSeconds / PACE);
    queueRefresh();
  }, { scope: ref, dependencies: deps, revertOnUpdate: true });
  return ref;
}
