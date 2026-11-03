import type { CSSProperties } from "react";

/** SVG text styles shared by the story charts (ink only: colour never carries text). */
export const SMALL: CSSProperties = { font: "11px var(--font-sans)", fill: "var(--color-ink-muted)" };
export const LABEL: CSSProperties = { font: "600 12px var(--font-sans)", fill: "var(--color-ink)" };
export const STRONG: CSSProperties = { font: "600 14px var(--font-sans)", fill: "var(--color-ink)" };

/** A share as a percentage with one decimal, rounded half up (toFixed rounds 0.7985 down to 79.8 on binary floats). */
export const pct1 = (v: number) => `${(Math.round(v * 1000 + 1e-9) / 10).toFixed(1)}%`;
