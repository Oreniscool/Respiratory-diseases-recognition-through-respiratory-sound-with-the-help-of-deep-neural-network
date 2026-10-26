import type { ReactNode } from "react";
import { Badge } from "./Badge";

type Props = { id: string; label: string; summary: string; illustration?: boolean; className?: string; children: ReactNode };

/** One story scene: a section the timeline pins, with a screen-reader summary and an optional "Illustration" tag. */
export function SceneFrame({ id, label, summary, illustration = false, className = "", children }: Props) {
  return (
    <section data-scene={id} aria-label={label} className={`relative min-h-screen ${className}`}>
      <p className="sr-only">{summary}</p>
      {illustration && (
        <div className="pointer-events-none absolute right-6 top-6 z-10">
          <Badge>Illustration</Badge>
        </div>
      )}
      {children}
    </section>
  );
}
