import { create } from "zustand";
import { SCENES } from "../scenes";

const LAST = SCENES.length - 1;
const REPEAT_MS = 250;

type PresenterState = {
  active: boolean;
  index: number;
  toggle: () => void;
  exit: () => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** follow the scroll position without scrolling */
  syncFromScroll: (index: number) => void;
};

const clamp = (i: number) => Math.max(0, Math.min(LAST, i));

let scroller: (index: number) => void = () => {};
/** The story shell registers how to bring a scene into view (Lenis tween to its pin start). */
export const setScroller = (fn: (index: number) => void): void => {
  scroller = fn;
};

export const usePresenter = create<PresenterState>((set, get) => ({
  active: false,
  index: 0,
  toggle: () => set((s) => ({ active: !s.active })),
  exit: () => set({ active: false }),
  goTo: (i) => {
    const index = clamp(i);
    set({ index });
    scroller(index);
  },
  next: () => get().goTo(get().index + 1),
  prev: () => get().goTo(get().index - 1),
  syncFromScroll: (i) => set({ index: clamp(i) }),
}));

let lastStep = -Infinity;

/** Keyboard control for presenter mode. Returns whether the key was handled. */
export function handlePresenterKey(event: KeyboardEvent, store: PresenterState): boolean {
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName;
  if (event.ctrlKey || event.metaKey || event.altKey) return false; // browser shortcuts (print, back, …)
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return false;
  if (tag === "AUDIO" || tag === "VIDEO" || tag === "SUMMARY") return false; // native media and disclosure keys
  if (event.key === " " && tag === "BUTTON") return false;

  if (event.key === "p" || event.key === "P") {
    store.toggle();
    return true;
  }
  if (!store.active) return false;

  const step = (action: () => void) => {
    event.preventDefault();
    const now = Date.now();
    if (event.repeat && now - lastStep < REPEAT_MS) return true;
    lastStep = now;
    action();
    return true;
  };
  switch (event.key) {
    case "ArrowRight":
    case "PageDown":
    case " ":
      return step(store.next);
    case "ArrowLeft":
    case "PageUp":
      return step(store.prev);
    case "Home":
      return step(() => store.goTo(0));
    case "End":
      return step(() => store.goTo(LAST));
    case "Escape":
      store.exit();
      return true;
    default:
      return false;
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  // dev-only handle for browser debugging and the visual-check scripts
  (window as unknown as { __presenter: typeof usePresenter }).__presenter = usePresenter;
}
