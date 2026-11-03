import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { FACTS } from "../../../content/facts";
import { CHAPTERS, sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { pct1 as pct } from "./charts/chartText";


const RECAP: Record<(typeof CHAPTERS)[number]["id"], { figure: string; text: string }> = {
  origin: {
    figure: `${pct(FACTS.leakLadder.value.sample.test)} → ${pct(FACTS.leakLadder.value.patient.validation)}`,
    text: "Removing the original protocol's leaks showed what its number really meant, and set our first rule: split by patient.",
  },
  discovery: {
    figure: `${FACTS.copiedClips.display} of ${FACTS.kaggleClips.display}`,
    text: "Kaggle clips turned out to be ICBHI audio. We found them, checked the finding four ways, removed them, and wrote it up.",
  },
  pipeline: {
    figure: `${FACTS.recordings.display} · ${FACTS.patients.display}`,
    text: `recordings and patients, split by patient, then filtered, cut into windows and turned into ${FACTS.featuresPerFrame.display} numbers per frame.`,
  },
  model: {
    figure: `${FACTS.parameters.display}`,
    text: "parameters in each of three RespiNets, joined by three pretrained listeners: chosen without touching the test set, calibrated, and able to say \"unsure\".",
  },
  result: {
    figure: FACTS.patientAccuracy.display,
    text: `of ${FACTS.testPatients.display} unseen patients from the same datasets get the right class, served by a system that refuses to run unverified files.`,
  },
};

export function STakeaways() {
  const ref = useSceneTimeline<HTMLElement>("takeaways", (tl, root) => {
    tl.from(root.querySelectorAll("[data-recap]"), { opacity: 0, y: 18, stagger: 0.15, duration: 0.45 })
      .from(root.querySelector("[data-closing]"), { opacity: 0, duration: 0.6 });
  });
  return (
    <SceneFrame ref={ref} id="takeaways" label="What we did"
      summary={`Recap: the leaks of the starting point, ${FACTS.copiedClips.display} copied clips found and removed, a clean patient-split dataset, a calibrated four-member model, and ${FACTS.patientAccuracy.display} on ${FACTS.testPatients.display} unseen patients from the same datasets.`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-20 lg:px-12">
        <div>
          <p data-reveal className="eyebrow m-0">{sceneEyebrow("takeaways", "Summing up")}</p>
          <h2 data-reveal className="mt-3 mb-0">What we did</h2>
        </div>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 lg:grid-cols-5">
          {CHAPTERS.map((c, i) => (
            <li key={c.id} data-recap className="flex flex-col gap-2 rounded-xl border border-line bg-paper-raised p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Chapter {i + 1} · {c.title}</p>
              <p data-countup className="tabular m-0 font-serif text-3xl leading-tight text-ink">{RECAP[c.id].figure}</p>
              <p className="m-0 text-sm text-ink-muted">{RECAP[c.id].text}</p>
            </li>
          ))}
        </ol>
        <div data-closing className="space-y-4">
          <p className="m-0 max-w-3xl font-serif text-3xl leading-snug text-ink">How you test decides what a number means.</p>
          <Badge tone="accent">Research prototype, not a diagnostic device</Badge>
        </div>
      </div>
    </SceneFrame>
  );
}
