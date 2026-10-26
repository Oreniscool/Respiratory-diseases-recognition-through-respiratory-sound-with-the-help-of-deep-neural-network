import clips from "./clips.json";

/** Demo recordings from test-split patients (frontend/scripts/prepare_clips.py), each with a recorded real response. */
export type DemoClip = { id: string; label: string; file: string; predictFile: string; source: string; patientId: string };

export const DEMO_CLIPS: DemoClip[] = clips.demo;
