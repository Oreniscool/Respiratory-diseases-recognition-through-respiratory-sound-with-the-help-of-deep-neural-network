// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_CLIPS } from "./demoClips";
import { SCENE_CLIPS } from "./sceneClips";
import provenance from "./clips.provenance.json";
import type { PredictResult } from "../lib/api/types";

const publicDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../public");
const local = (url: string) => resolve(publicDir, url.replace(/^\//, ""));

it("bundles one demo clip per class, each with a recorded real response", () => {
  expect(DEMO_CLIPS.map((c) => c.id).sort()).toEqual(["demo-asthma", "demo-bronchial", "demo-copd", "demo-healthy", "demo-pneumonia"]);
  for (const clip of DEMO_CLIPS) {
    expect(existsSync(local(clip.file)), clip.file).toBe(true);
    const recorded = JSON.parse(readFileSync(local(clip.predictFile), "utf8")) as PredictResult;
    expect(recorded.members, clip.id).toHaveLength(4);
    expect(Object.keys(recorded.probabilities)).toHaveLength(5);
  }
});

it("takes every demo clip from a test-split patient", () => {
  for (const clip of DEMO_CLIPS) {
    const row = (provenance.demo as { id: string; split: string; patient_id: string }[]).find((r) => r.id === clip.id);
    expect(row, clip.id).toBeDefined();
    expect(row!.split).toBe("test");
    expect(row!.patient_id).toBe(clip.patientId);
  }
});

it("bundles the three scene-1 excerpts", () => {
  for (const clip of SCENE_CLIPS) {
    expect(clip.file, clip.id).toBeTruthy();
    expect(existsSync(local(clip.file!)), clip.id).toBe(true);
  }
});
