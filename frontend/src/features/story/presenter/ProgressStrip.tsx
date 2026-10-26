import { SCENES } from "../scenes";
import { usePresenter } from "./presenterStore";

/** Presenter HUD: one dot per scene, the current label, and the key hints. */
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
  return (
    <nav aria-label="Presenter progress" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-5">
        <span className="tabular w-14 text-sm font-semibold text-ink">{index + 1} / {SCENES.length}</span>
        <ol className="m-0 flex flex-1 list-none gap-1.5 p-0">
          {SCENES.map((s, i) => (
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
        <span className="hidden w-72 truncate text-sm text-ink md:block">{scene.label}</span>
        <span className="hidden text-xs text-ink-muted lg:block">← → step · Esc exit</span>
      </div>
    </nav>
  );
}
