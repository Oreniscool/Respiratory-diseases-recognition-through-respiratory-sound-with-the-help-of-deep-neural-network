import { render, screen } from "@testing-library/react";
import { ResultView } from "./ResultView";
import { SAMPLE } from "../../content/facts";

it("renders the story report for the sample", () => {
  render(<ResultView result={SAMPLE} />);
  expect(screen.getByText("COPD")).toBeInTheDocument();
  expect(screen.getAllByText("87%").length).toBeGreaterThan(0);
  expect(screen.getByText(/3 of 4 agree/)).toBeInTheDocument();
  expect(screen.getByText("RespiNet's reading of each window")).toBeInTheDocument();
  expect(screen.getByText(/research prototype, not a diagnostic device/)).toBeInTheDocument();
});

it("an uncertain answer says so, with the two closest classes (Review Focus 3)", () => {
  render(<ResultView result={{ ...SAMPLE, prediction: "uncertain", uncertain: true }} />);
  expect(screen.getByText("The model isn't sure")).toBeInTheDocument();
  const closest = screen.getByTestId("closest-classes");
  expect(closest.textContent).toMatch(/copd/);
  expect(closest.textContent).toMatch(/healthy/);
  expect(document.body.textContent).toContain("66.3%");
  expect(document.body.textContent).toContain("0.51");
  expect(screen.queryByText(/^UNCERTAIN$/)).toBeNull();
});

it("a response without members or window scores still renders (Review Focus 4)", () => {
  const { members: _m, window_scores: _w, ...older } = SAMPLE;
  render(<ResultView result={older} />);
  expect(screen.getByText("COPD")).toBeInTheDocument();
  expect(screen.getByText("All five scores")).toBeInTheDocument();
  expect(screen.queryByText(/How the four models voted/)).toBeNull();
  expect(screen.queryByText("RespiNet's reading of each window")).toBeNull();
});
