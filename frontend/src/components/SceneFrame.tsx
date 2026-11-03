import type { ReactNode, Ref } from "react";
import { Badge } from "./Badge";
import { CHAPTERS, SCENES } from "../features/story/scenes";

type Props = {
  id: string; label: string; summary: string; illustration?: boolean; className?: string; children: ReactNode;
  /** the scene timeline's ref: the whole section is what gets pinned */
  ref?: Ref<HTMLElement>;
};

/** The chapter a scene opens, if it is the first scene of chapters 2 onwards (chapter 1 opens with the title scene). */
export function chapterOpenedBy(id: string): { number: number; title: string } | null {
  const i = SCENES.findIndex((s) => s.id === id);
  if (i <= 0 || SCENES[i - 1]!.chapter === SCENES[i]!.chapter) return null;
  const c = CHAPTERS.findIndex((ch) => ch.id === SCENES[i]!.chapter);
  return { number: c + 1, title: CHAPTERS[c]!.title };
}

/**
 * One story scene: a section the timeline pins, with a screen-reader summary and an optional "Illustration" tag.
 * The first scene of a chapter also carries a chapter card that the timeline wipes across the screen when it opens
 * (hidden unless animated, so reduced motion and tests never see it cover the scene).
 */
export function SceneFrame({ id, label, summary, illustration = false, className = "", children, ref }: Props) {
  const chapter = chapterOpenedBy(id);
  return (
    <section ref={ref} data-scene={id} aria-label={label} className={`relative min-h-screen overflow-x-clip ${className}`}>
      <p className="sr-only">{summary}</p>
      {chapter && (
        <div data-chapter-intro aria-hidden="true"
             className="pointer-events-none invisible absolute inset-x-0 top-0 z-30 flex h-screen flex-col items-center justify-center bg-accent-deep text-paper">
          <p data-chapter-number className="m-0 text-sm font-semibold uppercase tracking-[0.3em] text-paper/80">Chapter {chapter.number}</p>
          <p data-chapter-title className="m-0 mt-4 px-6 text-center font-serif text-5xl leading-tight text-paper lg:text-7xl">{chapter.title}</p>
        </div>
      )}
      {illustration && (
        <div className="pointer-events-none absolute right-6 top-24 z-10 lg:right-12">
          <Badge>Illustration</Badge>
        </div>
      )}
      {children}
    </section>
  );
}
