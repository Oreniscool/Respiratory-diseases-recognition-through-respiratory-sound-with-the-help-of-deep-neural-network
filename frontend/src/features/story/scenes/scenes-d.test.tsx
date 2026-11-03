import "../../../test/storyMocks";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { StoryPage } from "../../../pages/StoryPage";
import { SCENES } from "../scenes";

const scene = (id: string) => document.querySelector<HTMLElement>(`[data-scene="${id}"]`)!;
const renderStory = () => render(<MemoryRouter><StoryPage /></MemoryRouter>);

it("renders every scene of SCENES once, in the same order, each with a screen-reader summary", () => {
  renderStory();
  const ids = [...document.querySelectorAll("[data-scene]")].map((el) => el.getAttribute("data-scene"));
  expect(ids).toEqual(SCENES.map((s) => s.id));
  for (const id of ids) expect(scene(id!).querySelector(".sr-only")?.textContent?.length, id!).toBeGreaterThan(20);
});

it("never mentions other hospitals, children or SPRSound, and never uses diagnostic wording, in any scene", () => {
  renderStory();
  for (const s of SCENES) {
    const text = scene(s.id).textContent!;
    expect(text, s.id).not.toMatch(/hospital|children|SPRSound/i);
    expect(text, s.id).not.toMatch(/\bdiagnoses (patients|disease)|detects/i);
  }
});

it("chapter 1: the reported number and the protocol's flagged steps", async () => {
  renderStory();
  const origin = scene("origin");
  expect(origin.textContent).toContain("95.67%");
  expect(origin.textContent).toContain("328,726");
  const flagged = within(origin).getAllByRole("button", { expanded: false });
  expect(flagged).toHaveLength(3);
  await userEvent.click(flagged[1]!);
  expect(origin.querySelector("[data-leak-detail]")?.textContent).toMatch(/same patient can sit on both sides/);
});

it("chapter 1: the leak ladder moves from the original protocol to a patient split", async () => {
  renderStory();
  const leaks = scene("leaks");
  const value = () => leaks.querySelector("[data-leak-value]")!.textContent;
  expect(value()).toBe("87.2%");
  await userEvent.click(within(leaks).getByRole("radio", { name: "Whole patients" }));
  expect(value()).toBe("49.2%");
  await userEvent.click(within(leaks).getByRole("checkbox"));
  expect(value()).toBe("38.5%");
  expect(leaks.textContent).toContain("16.7%");
});

it("chapter 1: the patient split removes patients shared between training and test", async () => {
  renderStory();
  const patients = scene("patients");
  expect(patients.querySelector("[data-split-result]")!.textContent).toMatch(/^6 of 8 patients/);
  await userEvent.click(within(patients).getByRole("radio", { name: "Split by patient" }));
  expect(patients.querySelector("[data-split-result]")!.textContent).toMatch(/No patient appears on both sides/);
  expect(patients.textContent).toContain("Illustration");
});

it("chapter 2: classes, the match illustration and the score gap", async () => {
  renderStory();
  const classes = scene("classes");
  expect(classes.textContent).toContain("793 of 920");
  await userEvent.click(within(classes).getByRole("button", { name: /Add the Kaggle set/ }));
  expect(classes.textContent).toContain("793 + 401");
  expect(scene("match").textContent).toContain("Illustration");
  const gap = scene("gap").textContent!;
  for (const needle of ["631", "1,211", "0.795", "0.697", "580 clips: no copy", "631 copies"]) expect(gap, needle).toContain(needle);
});

it("chapter 2: provenance by class, one recording, the four checks", async () => {
  renderStory();
  const provenance = scene("provenance");
  expect(provenance.querySelector("[data-provenance-note]")!.textContent).toMatch(/All 401 copd clips are cut from ICBHI/);
  await userEvent.click(within(provenance).getByRole("radio", { name: /asthma/ }));
  expect(provenance.querySelector("[data-provenance-note]")!.textContent).toMatch(/None of the 288 asthma clips come from ICBHI, but 262/);
  const one = scene("oneRecording").textContent!;
  for (const needle of ["218_1b1_Lr_sc_Meditron.wav", "13 back-to-back pieces", "P47, P48, P49", "187", "60"]) expect(one, needle).toContain(needle);
  const checks = scene("checks").textContent!;
  for (const needle of ["99 of 100", "0 of 336", "19 of 19", "631 of 631", "lower bounds"]) expect(checks, needle).toContain(needle);
});

it("chapter 2: the copies experiment switches between its two designs, and the paper card", async () => {
  renderStory();
  const c = scene("consequence");
  expect(c.textContent).toContain("+39.5");
  expect(c.textContent).toContain("association");
  await userEvent.click(within(c).getByRole("tab", { name: "Same recordings" }));
  expect(c.textContent).toContain("+80.8");
  expect(c.textContent).toContain("inconclusive");
  const paper = scene("paper").textContent!;
  expect(paper).toContain("More Than Half of the Kaggle Asthma Detection Dataset V2");
  expect(paper).toContain("at most 66 of 126");
  expect(screen.getAllByText(/Manuscript in preparation/)).toHaveLength(1);
});

it("only the first scene of chapters 2–5 carries a chapter card, hidden until animated", () => {
  renderStory();
  const withCard = SCENES.filter((s) => scene(s.id).querySelector("[data-chapter-intro]")).map((s) => s.id);
  expect(withCard).toEqual(["classes", "s02", "s06", "s11"]);
  const card = scene("classes").querySelector("[data-chapter-intro]")!;
  expect(card.className).toContain("invisible");
  expect(card.textContent).toContain("Chapter 2");
  expect(card.textContent).toContain("The discovery");
});

it("tells nothing twice: no paragraph or 'why' note appears in two places", () => {
  renderStory();
  const seen = new Map<string, string>();
  for (const s of SCENES) {
    for (const p of scene(s.id).querySelectorAll("p")) {
      if (p.closest("[data-chapter-intro]") || p.classList.contains("sr-only") || p.classList.contains("eyebrow")) continue;
      const text = p.textContent!.replace(/\s+/g, " ").trim();
      if (text.length < 60) continue;
      expect(seen.get(text), `"${text.slice(0, 60)}…" in ${s.id}`).toBeUndefined();
      seen.set(text, s.id);
    }
  }
  expect(seen.size).toBeGreaterThan(60);
});
