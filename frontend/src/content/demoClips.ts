/** Demo recordings (Task 14 replaces this interim entry with real test-split clips and their recorded responses). */
export type DemoClip = { id: string; label: string; file: string; predictFile: string; source: string; patientId: string };

export const DEMO_CLIPS: DemoClip[] = [
  { id: "demo-copd", label: "COPD example", file: "", predictFile: "", source: "ICBHI", patientId: "102004" },
];
