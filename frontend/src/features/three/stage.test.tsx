import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SCENES } from "../story/scenes";
import { stageFor, useStage } from "./stage";
import { leakLabels } from "./leakLayout";
import { useLeakSelection } from "../story/scenes/charts/leakStore";

vi.mock("three", () => {
  throw new Error("three must not be imported without WebGL");
});
vi.mock("../../hooks/useWebGL", () => ({ useWebGL: () => false }));

const { Stage } = await import("./Stage");
const { Fallback2D } = await import("./Fallback2D");

it("maps the opening, the leak ladder, the fingerprint and the vote to 3D groups, every other scene to none", () => {
  const groups = Object.fromEntries(SCENES.map((s) => [s.id, stageFor(s.id)]));
  const three: Record<string, string> = { s00: "lungs", leaks: "leaks", s05: "fingerprint", s08: "fusion" };
  expect(groups).toEqual(Object.fromEntries(SCENES.map((s) => [s.id, three[s.id] ?? null])));
});

it("the leak fallback highlights the selected bar", () => {
  act(() => useLeakSelection.setState({ unit: "patient", testPick: false }));
  render(<Fallback2D group="leaks" />);
  const on = screen.getByTestId("leak-bars-2d").querySelectorAll('[data-leak-bar2d="on"]');
  expect(on).toHaveLength(1);
  expect(screen.getByTestId("leak-bars-2d").textContent).toContain("38.5%");
});

it("the 3D leak labels follow the selection", () => {
  const value = (unit: "sample" | "patient", test: boolean) => leakLabels(unit, test).find((l) => l.id === "leak-value")!.title;
  expect(value("sample", true)).toBe("87.2%");
  expect(value("patient", false)).toBe("38.5%");
});

it("hides the stage between 3D scenes", () => {
  act(() => useStage.setState({ group: null, progress: 0 }));
  render(<Stage />);
  expect(screen.getByTestId("stage")).toHaveAttribute("hidden");
});

it("without WebGL renders the 2D fallback and never loads three", () => {
  act(() => useStage.setState({ group: "lungs", progress: 0 }));
  render(<Stage />);
  expect(screen.getByTestId("stage")).not.toHaveAttribute("hidden");
  expect(screen.getByTestId("stage-fallback")).toBeInTheDocument();
});

it("the fusion fallback shows the four members and the fused score", () => {
  render(<Fallback2D group="fusion" />);
  for (const name of ["RespiNet", "YAMNet", "OPERA-CE", "HeAR"]) expect(screen.getByText(name)).toBeInTheDocument();
  expect(screen.getByText(/87\.0%/)).toBeInTheDocument();
});

it("entering and leaving scenes switches the group", () => {
  act(() => useStage.setState({ group: null, progress: 0 }));
  act(() => useStage.getState().enter("s08"));
  expect(useStage.getState().group).toBe("fusion");
  act(() => useStage.getState().leave("s00")); // leaving a scene that is not shown changes nothing
  expect(useStage.getState().group).toBe("fusion");
  act(() => useStage.getState().leave("s08"));
  expect(useStage.getState().group).toBeNull();
});
