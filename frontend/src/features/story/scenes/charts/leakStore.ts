import { create } from "zustand";
import { FACTS } from "../../../../content/facts";

export type SplitUnit = "sample" | "recording" | "patient";
export const SPLIT_UNITS: { id: SplitUnit; label: string; hint: string }[] = [
  { id: "sample", label: "Random samples", hint: "copies made first, then a random split (the original)" },
  { id: "recording", label: "Whole recordings", hint: "split recordings first, then copy the training ones only" },
  { id: "patient", label: "Whole patients", hint: "every patient on one side only" },
];

/** The leak ladder's current setting, shared by its controls, the 3D bar grid and the 2D fallback. */
export const useLeakSelection = create<{
  unit: SplitUnit; testPick: boolean; setUnit: (u: SplitUnit) => void; setTestPick: (v: boolean) => void;
}>((set) => ({
  unit: "sample",
  testPick: true,
  setUnit: (unit) => set({ unit }),
  setTestPick: (testPick) => set({ testPick }),
}));

/** Balanced accuracy of a rung. */
export const leakValue = (unit: SplitUnit, testPick: boolean) =>
  testPick ? FACTS.leakLadder.value[unit].test : FACTS.leakLadder.value[unit].validation;
