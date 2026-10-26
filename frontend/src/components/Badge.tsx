import type { ReactNode } from "react";

type Props = { tone?: "accent" | "muted"; children: ReactNode };

export function Badge({ tone = "muted", children }: Props) {
  const toneClass = tone === "accent" ? "border-accent text-accent" : "border-line text-ink-muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${toneClass}`}>
      {children}
    </span>
  );
}
