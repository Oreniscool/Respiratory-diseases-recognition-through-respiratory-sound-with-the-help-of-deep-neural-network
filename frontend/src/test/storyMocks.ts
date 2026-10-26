import { createRef } from "react";
import { vi } from "vitest";

/** Scene tests check content and order, not animation: no scroll timeline, no smooth scrolling. */
vi.mock("../features/story/timeline", async (original) => ({
  ...(await original<typeof import("../features/story/timeline")>()),
  useSceneTimeline: () => createRef(),
}));
vi.mock("lenis", () => ({
  default: class {
    on() {}
    raf() {}
    scrollTo() {}
    destroy() {}
  },
}));
