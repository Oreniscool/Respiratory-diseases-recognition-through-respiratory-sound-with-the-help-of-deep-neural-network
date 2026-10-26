import { create } from "zustand";

export type StageGroup = "lungs" | "fusion";

const GROUPS: Record<string, StageGroup> = { s00: "lungs", s08: "fusion" };

/** Which 3D group a scene shows, or null for 2D scenes. */
export const stageFor = (sceneId: string): StageGroup | null => GROUPS[sceneId] ?? null;

type StageState = {
  group: StageGroup | null;
  /** scroll progress (0–1) through the active 3D scene */
  progress: number;
  enter: (sceneId: string) => void;
  leave: (sceneId: string) => void;
  setProgress: (sceneId: string, progress: number) => void;
};

export const useStage = create<StageState>((set, get) => ({
  group: null,
  progress: 0,
  enter: (sceneId) => {
    const group = stageFor(sceneId);
    if (group) set({ group });
  },
  leave: (sceneId) => {
    if (get().group === stageFor(sceneId)) set({ group: null });
  },
  setProgress: (sceneId, progress) => {
    if (get().group === stageFor(sceneId)) set({ progress });
  },
}));
