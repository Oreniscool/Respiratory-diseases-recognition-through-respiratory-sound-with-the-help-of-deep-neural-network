import "../../../test/storyMocks";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StoryPage } from "../../../pages/StoryPage";

const scene = (id: string) => document.querySelector(`[data-scene="${id}"]`)!;

it("scenes 6–10 show the real model numbers", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  const text = ["s06", "s07", "s08", "s09", "s10"].map((id) => scene(id).textContent).join(" ");
  for (const needle of ["458,701", "42, 43, 44", "56.7%", "3 of 4 agree", "87.0%", "0.5489", "66.3%", "0.51"]) {
    expect(text, needle).toContain(needle);
  }
});

it("labels the network and fusion visuals as illustrations", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  expect(scene("s06").textContent).toContain("Illustration");
  expect(scene("s08").textContent).toContain("Illustration");
});

it("never uses diagnostic wording", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  for (const id of ["s06", "s07", "s08", "s09", "s10"]) expect(scene(id).textContent, id).not.toMatch(/diagnos|detects/i);
});
