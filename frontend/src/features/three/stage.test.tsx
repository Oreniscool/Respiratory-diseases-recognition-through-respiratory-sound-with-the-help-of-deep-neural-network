import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SCENES } from "../story/scenes";
import { stageFor, useStage } from "./stage";

vi.mock("three", () => {
  throw new Error("three must not be imported without WebGL");
});
vi.mock("../../hooks/useWebGL", () => ({ useWebGL: () => false }));

const { Stage } = await import("./Stage");
const { Fallback2D } = await import("./Fallback2D");

it("maps only scenes 0, 6 and 8 to a 3D group", () => {
  const groups = Object.fromEntries(SCENES.map((s) => [s.id, stageFor(s.id)]));
  expect(groups).toEqual({
    s00: "lungs", s01: null, s02: null, s03: null, s04: null, s05: null, s06: "network",
    s07: null, s08: "fusion", s09: null, s10: null, s11: null, s12: null, s13: null,
  });
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
  act(() => useStage.getState().enter("s06"));
  expect(useStage.getState().group).toBe("network");
  act(() => useStage.getState().leave("s08")); // leaving a scene that is not shown changes nothing
  expect(useStage.getState().group).toBe("network");
  act(() => useStage.getState().leave("s06"));
  expect(useStage.getState().group).toBeNull();
});
