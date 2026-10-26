import { SceneFrame } from "../../../components/SceneFrame";
import { Check } from "../../../components/icons";
import { CHALLENGES } from "../../../content/challenges";
import { useSceneTimeline } from "../timeline";

export function S11Challenges() {
  const ref = useSceneTimeline<HTMLElement>("s11", (tl, root) => {
    const cards = root.querySelectorAll("[data-challenge]");
    tl.from(cards, { y: 30, opacity: 0, stagger: 0.12, duration: 0.5 })
      .from(root.querySelectorAll("[data-fix]"), { opacity: 0, y: 8, stagger: 0.15, duration: 0.4 }, "+=0.2")
      .to(root.querySelectorAll("[data-problem]"), { opacity: 0.55, stagger: 0.15, duration: 0.4 }, "<");
  });
  return (
    <SceneFrame ref={ref} id="s11" label="Problems we hit, and how we fixed them"
      summary="Six problems found while building RespiNet, each with the fix: wrong labels, copied audio, made-up patient IDs, duplicates, early stopping, and serving parity.">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-20 lg:px-12">
        <p data-reveal className="eyebrow m-0">Step 11 · The road here</p>
        <h2 data-reveal className="mt-3 mb-6 max-w-3xl">Problems we hit, and how we fixed them</h2>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.map((c, i) => (
            <li key={c.id} data-challenge className="flex flex-col gap-2.5 rounded-xl border border-line bg-paper-raised p-4">
              <div className="flex items-baseline gap-3">
                <span className="tabular text-sm font-semibold text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="m-0 text-lg">{c.title}</h3>
              </div>
              <p data-problem className="m-0 text-[0.9rem] leading-snug text-ink-muted">{c.problem}</p>
              <p data-fix className="m-0 flex gap-2 border-t border-line pt-2.5 text-[0.9rem] leading-snug text-ink">
                <Check className="mt-1 shrink-0 text-accent" />
                <span>{c.fix}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </SceneFrame>
  );
}
