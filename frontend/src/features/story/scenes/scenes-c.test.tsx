import "../../../test/storyMocks";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StoryPage } from "../../../pages/StoryPage";

const scene = (id: string) => document.querySelector(`[data-scene="${id}"]`)!;

it("scene 11 shows six problems, each with its fix and real numbers", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  const cards = scene("s11").querySelectorAll("[data-challenge]");
  expect(cards).toHaveLength(6);
  cards.forEach((card) => {
    expect(card.querySelector("[data-problem]")?.textContent?.length).toBeGreaterThan(10);
    expect(card.querySelector("[data-fix]")?.textContent?.length).toBeGreaterThan(10);
  });
  const text = scene("s11").textContent!;
  for (const needle of ["631", "1,211", "401", "316", "27–29%", "41% → 59%"]) expect(text, needle).toContain(needle);
  expect(text).not.toMatch(/hospital|children|SPRSound/i);
});

it("scene 12 states the headline accuracy together with its scope", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  const headline = scene("s12").querySelector("[data-headline]")!;
  expect(headline.textContent).toContain("75.5%");
  expect(headline.textContent).toContain("on 49 unseen patients from the same datasets");
});

it("scene 13 runs the sample end to end and invites the visitor to try it", () => {
  render(<MemoryRouter><StoryPage /></MemoryRouter>);
  const text = scene("s13").textContent!;
  expect(text).toContain("30 windows");
  expect(text).toContain("Strongest match: COPD");
  expect(screen.getByRole("link", { name: /Try it with your own recording/ })).toHaveAttribute("href", "/analyze");
});
