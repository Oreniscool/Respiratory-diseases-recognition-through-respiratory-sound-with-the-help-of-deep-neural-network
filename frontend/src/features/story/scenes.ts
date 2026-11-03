/** The story's chapters, in order. Each scene belongs to exactly one. */
export const CHAPTERS = [
  { id: "origin", title: "Where it began" },
  { id: "discovery", title: "The discovery" },
  { id: "pipeline", title: "From sound to features" },
  { id: "model", title: "The model" },
  { id: "result", title: "Results and the system" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

/** The story, in order. Each scene is one presenter step. Ids s00–s13 are the original scenes (kept stable). */
export const SCENES = [
  { id: "s00", chapter: "origin", label: "How a machine listens to your lungs" },
  { id: "s01", chapter: "origin", label: "Listening to lungs" },
  { id: "origin", chapter: "origin", label: "Where we started" },
  { id: "leaks", chapter: "origin", label: "Finding the leaks" },
  { id: "patients", chapter: "origin", label: "Why we split by patient" },
  { id: "classes", chapter: "discovery", label: "Five classes from eight" },
  { id: "match", chapter: "discovery", label: "Matching a clip to a recording" },
  { id: "gap", chapter: "discovery", label: "A clean gap" },
  { id: "provenance", chapter: "discovery", label: "Where the clips came from" },
  { id: "oneRecording", chapter: "discovery", label: "One recording, many clips" },
  { id: "checks", chapter: "discovery", label: "Checking the checker" },
  { id: "consequence", chapter: "discovery", label: "What copies do to a test" },
  { id: "paper", chapter: "discovery", label: "The paper" },
  { id: "s02", chapter: "pipeline", label: "The data" },
  { id: "s03", chapter: "pipeline", label: "Cleaning the signal" },
  { id: "s04", chapter: "pipeline", label: "Slicing time" },
  { id: "s05", chapter: "pipeline", label: "The sound fingerprint" },
  { id: "s06", chapter: "model", label: "Inside RespiNet" },
  { id: "training", chapter: "model", label: "How it learns" },
  { id: "learning", chapter: "model", label: "Learning from little data" },
  { id: "s07", chapter: "model", label: "Three of them" },
  { id: "selection", chapter: "model", label: "Choosing fairly" },
  { id: "s08", chapter: "model", label: "Four models vote" },
  { id: "s09", chapter: "model", label: "Honest confidence" },
  { id: "s10", chapter: "model", label: "Knowing when to abstain" },
  { id: "s11", chapter: "result", label: "Other problems we fixed" },
  { id: "s12", chapter: "result", label: "How well it does" },
  { id: "server", chapter: "result", label: "Safety checks in the server" },
  { id: "s13", chapter: "result", label: "From your recording to an answer" },
  { id: "takeaways", chapter: "result", label: "What we did" },
] as const satisfies readonly { id: string; chapter: ChapterId; label: string }[];

export type SceneId = (typeof SCENES)[number]["id"];

export const sceneIndex = (id: SceneId): number => SCENES.findIndex((s) => s.id === id);

/** 1-based chapter number and the chapter's title, for a scene. */
export function chapterOf(id: SceneId): { number: number; title: string } {
  const chapter = SCENES[sceneIndex(id)]!.chapter;
  const index = CHAPTERS.findIndex((c) => c.id === chapter);
  return { number: index + 1, title: CHAPTERS[index]!.title };
}

/** The small line above a scene's title, e.g. "Chapter 2 · The discovery". Numbering comes from the order above. */
export function sceneEyebrow(id: SceneId, short?: string): string {
  const { number, title } = chapterOf(id);
  return `Chapter ${number} · ${short ?? title}`;
}
