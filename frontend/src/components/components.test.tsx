import { render, screen } from "@testing-library/react";
import { ScoreBar } from "./ScoreBar";
import { SceneFrame } from "./SceneFrame";
import { Legend } from "./Legend";
import { CLASS_COLORS, classColor } from "./classColors";

it("ScoreBar shows the label and value in ink, never in a class colour", () => {
  render(<ScoreBar label="copd" value={87} highlight />);
  const label = screen.getByText("copd");
  const value = screen.getByText("87.0%");
  const classColours = Object.values(CLASS_COLORS).map((c) => c.toLowerCase());
  for (const el of [label, value]) {
    expect(classColours).not.toContain((el.style.color || "").toLowerCase());
  }
});

it("SceneFrame labels illustrations and carries a screen-reader summary", () => {
  render(<SceneFrame id="s06" label="Inside RespiNet" summary="The network, step by step." illustration><p>body</p></SceneFrame>);
  expect(screen.getByText("Illustration")).toBeInTheDocument();
  expect(screen.getByText("The network, step by step.")).toBeInTheDocument();
  expect(document.querySelector('[data-scene="s06"]')).not.toBeNull();
});

it("Legend shows each label with its count", () => {
  render(<Legend items={[{ label: "copd", color: CLASS_COLORS.copd, count: 25 }]} />);
  expect(screen.getByText(/copd/).textContent).toMatch(/copd\s*25/);
});

it("classColor falls back to a neutral for unknown classes", () => {
  expect(classColor("copd")).toBe("#1baf7a");
  expect(classColor("mystery")).toBe("#55623f");
});
