import type { ReactNode } from "react";

/** The standard scene layout: the story text on the left, the visual on the right (empty for 3D scenes). */
export function SceneColumns({ eyebrow, title, children, visual }: {
  eyebrow: string; title: ReactNode; children: ReactNode; visual?: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-24 lg:grid-cols-[minmax(0,38%)_1fr] lg:px-12">
      <div className="relative z-10 max-w-xl">
        <p data-reveal className="eyebrow m-0">{eyebrow}</p>
        <h2 data-reveal className="mt-3 mb-6">{title}</h2>
        <div data-reveal className="space-y-4 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      </div>
      <div className="relative z-10 min-w-0">{visual}</div>
    </div>
  );
}

/** A sourced reason, set apart from the main text. */
export function Why({ children }: { children: ReactNode }) {
  return (
    <p data-reveal className="border-l-2 border-fill-strong pl-4 text-[0.95rem] text-ink">
      <span className="eyebrow mr-2 text-ink-muted">Why</span>{children}
    </p>
  );
}
