import { SceneFrame } from "../../../components/SceneFrame";
import { ScoreBar } from "../../../components/ScoreBar";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";

function Interval() {
  const [lo, mid, hi] = [FACTS.ciLow.value, FACTS.patientAccuracy.value, FACTS.ciHigh.value].map((v) => v * 100);
  return (
    <div className="space-y-2" aria-label={`95% interval ${FACTS.ciLow.display} to ${FACTS.ciHigh.display}`}>
      <div className="relative mt-4 h-8">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <span data-ci className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-fill/70" style={{ left: `${lo}%`, width: `${hi! - lo!}%` }} />
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-accent" style={{ left: `${mid}%` }} />
        <span className="tabular absolute -top-4 -translate-x-1/2 text-xs font-semibold text-ink" style={{ left: `${mid}%` }}>{FACTS.patientAccuracy.display}</span>
      </div>
      <div className="tabular flex justify-between text-xs text-ink-muted"><span>0%</span><span>50%</span><span>100%</span></div>
      <p className="m-0 text-sm text-ink">95% interval (patient bootstrap): <span className="tabular font-semibold">{FACTS.ciLow.display} – {FACTS.ciHigh.display}</span></p>
    </div>
  );
}

export function S12Performance() {
  const recall = FACTS.perClassRecallPatient.value;
  const ref = useSceneTimeline<HTMLElement>("s12", (tl, root) => {
    tl.from(root.querySelector("[data-headline]"), { scale: 0.92, opacity: 0, duration: 0.6 })
      .from(root.querySelector("[data-ci]"), { scaleX: 0, transformOrigin: "center", duration: 0.5 })
      .from(root.querySelectorAll("[data-recall] > *"), { opacity: 0, x: -12, stagger: 0.1, duration: 0.3 });
  });
  return (
    <SceneFrame ref={ref} id="s12" label="How well it does" summary={`On 49 unseen patients from the same datasets, ${FACTS.patientAccuracy.display} of patients get the right class.`}>
      <SceneColumns eyebrow="Step 12 · The result" title="How well it does"
        visual={
          <div className="space-y-8">
            <div data-recall className="space-y-1">
              <p className="mb-2 text-sm font-semibold text-ink">Right class per patient, by diagnosis</p>
              {Object.entries(recall).map(([label, r]) => (
                <ScoreBar key={label} label={`${label} (${r.patients})`} value={r.recall * 100} />
              ))}
            </div>
            <Interval />
          </div>
        }>
        <p data-headline className="m-0">
          <span className="block font-serif text-7xl leading-none text-ink">{FACTS.patientAccuracy.display}</span>
          <span className="mt-3 block text-lg text-ink">of patients get the right class, on 49 unseen patients from the same datasets</span>
        </p>
        <p>
          Balanced across the five classes: <strong className="tabular">{FACTS.patientBalancedAccuracy.display}</strong>. These
          patients were set aside before training, and no choice was made using them.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
