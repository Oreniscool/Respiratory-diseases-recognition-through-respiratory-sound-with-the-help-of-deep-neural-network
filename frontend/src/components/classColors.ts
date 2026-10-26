/** Fixed categorical order, validated on the paper colour (spec §3). Identity only; text stays ink. */
export const CLASS_COLORS = {
  asthma: "#2a78d6",
  bronchial: "#eb6834",
  copd: "#1baf7a",
  healthy: "#eda100",
  pneumonia: "#e87ba4",
} as const;

export type ClassName = keyof typeof CLASS_COLORS;

const NEUTRAL = "#55623f";

export function classColor(name: string): string {
  return (CLASS_COLORS as Record<string, string>)[name] ?? NEUTRAL;
}
