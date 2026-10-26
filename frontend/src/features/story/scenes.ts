/** The story, in order (spec §4). Each scene is one presenter step. */
export const SCENES = [
  { id: "s00", label: "How a machine listens to your lungs" },
  { id: "s01", label: "Listening to lungs" },
  { id: "s02", label: "The data" },
  { id: "s03", label: "Cleaning the signal" },
  { id: "s04", label: "Slicing time" },
  { id: "s05", label: "The sound fingerprint" },
  { id: "s06", label: "Inside RespiNet" },
  { id: "s07", label: "Three of them" },
  { id: "s08", label: "Four models vote" },
  { id: "s09", label: "Honest confidence" },
  { id: "s10", label: "Knowing when to abstain" },
  { id: "s11", label: "Problems we hit, and how we fixed them" },
  { id: "s12", label: "How well it does" },
  { id: "s13", label: "From your recording to an answer" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export const sceneIndex = (id: SceneId): number => SCENES.findIndex((s) => s.id === id);
