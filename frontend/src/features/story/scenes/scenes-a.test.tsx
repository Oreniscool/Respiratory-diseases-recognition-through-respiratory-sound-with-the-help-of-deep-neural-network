import "../../../test/storyMocks";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StoryPage } from "../../../pages/StoryPage";

const textOf = () => document.body.textContent ?? "";

it("tells scenes 0–5 in order with the real numbers", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  const text = textOf();
  const order = ["How a machine listens to your lungs", "research prototype, not a diagnostic device", "1,551", "244", "146",
    "100–2,000 Hz", "200 frames", "120"];
  let last = -1;
  for (const needle of order) {
    const at = text.indexOf(needle, last + 1);
    expect(at, needle).toBeGreaterThan(last);
    last = at;
  }
});

it("gives every scene from s00 to s05 a screen-reader summary", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  for (const id of ["s00", "s01", "s02", "s03", "s04", "s05"]) {
    const scene = document.querySelector(`[data-scene="${id}"]`);
    expect(scene, id).not.toBeNull();
    expect(scene!.querySelector(".sr-only")?.textContent?.length, id).toBeGreaterThan(20);
  }
});

it("labels the browser-computed fingerprint as an approximation", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  expect(screen.getByText(/Approximation of the server's features/)).toBeInTheDocument();
});

it("keeps the story page test id for routing", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  expect(screen.getByTestId("story-page")).toBeInTheDocument();
});
