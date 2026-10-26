import type { MemberScore } from "../lib/api/types";

/** Display names and one-line descriptions of the four fusion members (spec §4 scene 8). */
export const MEMBER_INFO: Record<string, { label: string; description: string }> = {
  respinet: { label: "RespiNet", description: "our network · MFCC fingerprint" },
  yamnet: { label: "YAMNet", description: "Google · everyday sounds" },
  opera_ce: { label: "OPERA-CE", description: "pretrained on breathing sounds" },
  hear: { label: "HeAR", description: "Google · health acoustics" },
};

export const memberLabel = (name: string) => MEMBER_INFO[name]?.label ?? name;

export function memberTop(member: MemberScore): { label: string; score: number } {
  const [label, score] = Object.entries(member.probabilities).reduce((a, b) => (b[1] > a[1] ? b : a));
  return { label, score };
}
