import { CHAPTERS, SCENES, chapterOf } from "../scenes";
import { usePresenter } from "./presenterStore";

/** Presenter HUD: one dot per scene grouped by chapter, the current chapter and label, and the key hints. */
export function ProgressStrip() {
  const { active, index, goTo } = usePresenter();
  if (!active) {
    return (
      <p className="fixed bottom-4 right-5 z-40 m-0 rounded-full border border-line bg-paper/90 px-3 py-1 text-xs text-ink-muted backdrop-blur">
        Press <kbd className="font-semibold text-ink">P</kbd> for presenter mode
      </p>
    );
  }
  const scene = SCENES[index]!;
  const chapter = chapterOf(scene.id);
  return (
    <nav aria-label="Presenter progress" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-5">
        <span className="tabular w-14 shrink-0 text-sm font-semibold text-ink">{index + 1} / {SCENES.length}</span>
        <div className="flex flex-1 gap-3">
          {CHAPTERS.map((c, ci) => {
            const members = SCENES.map((s, i) => ({ s, i })).filter(({ s }) => s.chapter === c.id);
            return (
              <ol key={c.id} aria-label={`Chapter ${ci + 1}: ${c.title}`} className="m-0 flex flex-1 list-none gap-1 p-0"
                  style={{ flexGrow: members.length }}>
                {members.map(({ s, i }) => (
                  <li key={s.id} className="flex-1">
                    <button
                      type="button"
                      aria-label={`Go to ${s.label}`}
                      aria-current={i === index ? "step" : undefined}
                      onClick={() => goTo(i)}
                      className={`block h-1.5 w-full rounded-full ${i <= index ? "bg-accent" : "bg-track"}`}
                    />
                  </li>
                ))}
              </ol>
            );
          })}
        </div>
        <span className="hidden w-80 truncate text-sm text-ink md:block">
          <span className="text-ink-muted">Ch. {chapter.number} · </span>{scene.label}
        </span>
        <span className="hidden shrink-0 text-xs text-ink-muted lg:block">← → step · Esc exit</span>
      </div>
    </nav>
  );
}
