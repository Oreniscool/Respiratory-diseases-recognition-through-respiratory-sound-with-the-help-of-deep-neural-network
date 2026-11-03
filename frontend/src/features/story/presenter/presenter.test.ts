import { afterEach, beforeEach, vi } from "vitest";
import { CHAPTERS, SCENES, sceneEyebrow } from "../scenes";
import { handlePresenterKey, setScroller, usePresenter } from "./presenterStore";

const key = (k: string, target: Partial<HTMLElement> = document.body, repeat = false, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, target, repeat, preventDefault: vi.fn(), ctrlKey: false, metaKey: false, altKey: false, ...mods }) as unknown as KeyboardEvent;
const state = () => usePresenter.getState();

beforeEach(() => {
  usePresenter.setState({ active: false, index: 0 });
  setScroller(() => {});
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const ORDER = [
  "s00", "s01", "origin", "leaks", "patients",
  "classes", "match", "gap", "provenance", "oneRecording", "checks", "consequence", "paper",
  "s02", "s03", "s04", "s05",
  "s06", "training", "learning", "s07", "selection", "s08", "s09", "s10",
  "s11", "s12", "server", "s13", "takeaways",
];
const LAST = ORDER.length - 1;

it("has 30 scenes in five chapters, keeping the original ids s00–s13 in their old relative order", () => {
  expect(SCENES.map((s) => s.id)).toEqual(ORDER);
  expect(new Set(SCENES.map((s) => s.chapter)).size).toBe(CHAPTERS.length);
  const originals = SCENES.map((s) => s.id).filter((id) => /^s\d\d$/.test(id));
  expect(originals).toEqual(Array.from({ length: 14 }, (_, i) => `s${String(i).padStart(2, "0")}`));
});

it("numbers the eyebrows by chapter", () => {
  expect(sceneEyebrow("s00")).toBe("Chapter 1 · Where it began");
  expect(sceneEyebrow("gap", "The result")).toBe("Chapter 2 · The result");
  expect(sceneEyebrow("takeaways")).toBe("Chapter 5 · Results and the system");
});

it("next and prev clamp at the ends", () => {
  for (let i = 0; i < 40; i++) state().next();
  expect(state().index).toBe(LAST);
  state().goTo(0);
  state().prev();
  expect(state().index).toBe(0);
});

it("p toggles presenter mode; other keys do nothing while it is off", () => {
  expect(handlePresenterKey(key("ArrowRight"), state())).toBe(false);
  expect(state().index).toBe(0);
  expect(handlePresenterKey(key("p"), state())).toBe(true);
  expect(state().active).toBe(true);
  handlePresenterKey(key("ArrowRight"), state());
  handlePresenterKey(key(" "), state());
  expect(state().index).toBe(2);
  handlePresenterKey(key("End"), state());
  expect(state().index).toBe(LAST);
  handlePresenterKey(key("Escape"), state());
  expect(state().active).toBe(false);
});

it("ignores keys typed into form controls and space on buttons (Review Focus 5)", () => {
  usePresenter.setState({ active: true, index: 3 });
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
    expect(handlePresenterKey(key("ArrowRight", { tagName } as HTMLElement), state())).toBe(false);
  }
  expect(handlePresenterKey(key("p", { tagName: "DIV", isContentEditable: true } as HTMLElement), state())).toBe(false);
  expect(handlePresenterKey(key(" ", { tagName: "BUTTON" } as HTMLElement), state())).toBe(false);
  expect(state().index).toBe(3);
  expect(state().active).toBe(true);
});

it("a held key steps at most once per 250 ms (Review Focus 5)", () => {
  usePresenter.setState({ active: true, index: 0 });
  handlePresenterKey(key("ArrowRight"), state());
  for (let i = 0; i < 5; i++) handlePresenterKey(key("ArrowRight", document.body, true), state());
  expect(state().index).toBe(1);
  vi.advanceTimersByTime(260);
  handlePresenterKey(key("ArrowRight", document.body, true), state());
  expect(state().index).toBe(2);
});

it("goTo asks the scroller to move to that scene", () => {
  const scroller = vi.fn();
  setScroller(scroller);
  state().goTo(5);
  expect(scroller).toHaveBeenCalledWith(5);
});

it("leaves focused media and disclosure controls to the browser (review #8)", () => {
  usePresenter.setState({ active: true, index: 1 });
  for (const tagName of ["AUDIO", "VIDEO", "SUMMARY"]) {
    expect(handlePresenterKey(key(" ", { tagName } as HTMLElement), state())).toBe(false);
    expect(handlePresenterKey(key("ArrowRight", { tagName } as HTMLElement), state())).toBe(false);
  }
  expect(state().index).toBe(1);
});

it("ignores browser shortcuts with modifier keys (review #8)", () => {
  usePresenter.setState({ active: true, index: 1 });
  expect(handlePresenterKey(key("p", document.body, false, { ctrlKey: true }), state())).toBe(false);
  expect(handlePresenterKey(key("ArrowLeft", document.body, false, { altKey: true }), state())).toBe(false);
  expect(handlePresenterKey(key("p", document.body, false, { metaKey: true }), state())).toBe(false);
  expect(state()).toMatchObject({ active: true, index: 1 });
});
