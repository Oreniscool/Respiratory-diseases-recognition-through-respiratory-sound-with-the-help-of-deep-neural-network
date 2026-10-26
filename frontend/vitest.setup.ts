import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no matchMedia (GSAP and the reduced-motion hook read it)
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom has no ResizeObserver (Lenis and the 3D stage observe element sizes)
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserverShim { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverShim });
  Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverShim });
}
