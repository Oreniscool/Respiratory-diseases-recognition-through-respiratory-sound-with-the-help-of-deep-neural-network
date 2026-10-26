import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "./App";

it("routes / to the story and /analyze to the analyzer", () => {
  render(<MemoryRouter initialEntries={["/analyze"]}><AppRoutes /></MemoryRouter>);
  expect(screen.getByTestId("analyze-page")).toBeInTheDocument();
});

it("redirects unknown paths to the story", () => {
  render(<MemoryRouter initialEntries={["/nope"]}><AppRoutes /></MemoryRouter>);
  expect(screen.getByTestId("story-page")).toBeInTheDocument();
});
