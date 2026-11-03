import "../../../test/storyMocks";
import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { StoryPage } from "../../../pages/StoryPage";
import { share } from "./charts/FocalCurve";

const scene = (id: string) => document.querySelector<HTMLElement>(`[data-scene="${id}"]`)!;
const renderStory = () => render(<MemoryRouter><StoryPage /></MemoryRouter>);

it("chapter 4: the training curve opens at the restored epoch and can be scrubbed", () => {
  renderStory();
  const training = scene("training");
  const readout = () => training.querySelector("[data-epoch-readout]")!.textContent!;
  expect(readout()).toContain("69.3%");
  expect(readout()).toContain("the epoch that was kept");
  fireEvent.change(within(training).getByRole("slider"), { target: { value: "1" } });
  expect(readout()).not.toContain("the epoch that was kept");
  expect(within(training).getByText(/^Epoch/).textContent).toContain("1");
  expect(training.textContent).toContain("patience 18");
});

it("chapter 4: focal loss and augmentation", async () => {
  renderStory();
  const learning = scene("learning");
  expect(learning.querySelector("[data-focal-readout]")!.textContent).toContain("counts 1% as much");
  expect(learning.textContent).toContain("the value RespiNet uses");
  for (const needle of ["20 dB", "1,600 samples", "×0.8 and ×1.2", "Training only"]) expect(learning.textContent, needle).toContain(needle);
  expect([share(1), share(0.316), share(0.01), share(0.0003)]).toEqual(["100%", "32%", "1.0%", "0.03%"]);
});

it("chapter 4: model selection highlights the adopted model and explains any choice", async () => {
  renderStory();
  const selection = scene("selection");
  const note = () => selection.querySelector("[data-variant-note]")!.textContent!;
  expect(note()).toMatch(/All four \(adopted\).*rule written down before/);
  await userEvent.click(within(selection).getByRole("radio", { name: /reference/ }));
  expect(note()).toMatch(/the model served before/);
  for (const needle of ["195 development", "49 test patients", "74.9%", "70.1%"]) expect(selection.textContent, needle).toContain(needle);
});

it("chapter 5: the server's safety checks open one by one", async () => {
  renderStory();
  const server = scene("server");
  const detail = () => server.querySelector("[data-stage-detail]")!.textContent!;
  expect(detail()).toMatch(/first bytes must really match/);
  await userEvent.click(within(server).getByRole("button", { name: /Limits/ }));
  expect(detail()).toMatch(/25 MB and 120 seconds/);
  await userEvent.click(within(server).getByRole("button", { name: /Verified model/ }));
  expect(detail()).toContain("SHA-256");
});

it("closes with a recap of every chapter and the research-prototype tag", () => {
  renderStory();
  const recap = scene("takeaways");
  expect(recap.querySelectorAll("[data-recap]")).toHaveLength(5);
  for (const needle of ["631 of 1,211", "75.5%", "Research prototype, not a diagnostic device"]) expect(recap.textContent, needle).toContain(needle);
  expect(recap.textContent).toContain("on 49 unseen patients from the same datasets".replace("on 49", "49"));
});
