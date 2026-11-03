import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { FACTS } from "../../../content/facts";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";

const RECOMMENDATIONS = [
  { title: "Cross-match before you split", text: "Compare every clip with the other public datasets in use before building any split." },
  { title: "Report copied and clean apart", text: "Give results separately for material that was copied and material that was not." },
  { title: "Keep copies out of external tests", text: "Exclude copied recordings, and their patients, from any test called external." },
];

export function SPaper() {
  const icbhiPatients = Number(FACTS.icbhi.value.split("/")[1]);
  const ref = useSceneTimeline<HTMLElement>("paper", (tl, root) => {
    tl.from(root.querySelector("[data-paper-card]"), { y: 30, opacity: 0, duration: 0.6 })
      .from(root.querySelectorAll("[data-recommendation]"), { y: 20, opacity: 0, stagger: 0.15, duration: 0.4 });
  });
  return (
    <SceneFrame ref={ref} id="paper" label="The paper"
      summary={`Our paper reports that ${FACTS.copiedClips.display} of ${FACTS.kaggleClips.display} Kaggle clips are cut from ICBHI and gives three steps for fair evaluation; at most ${FACTS.cleanIcbhiPatients.display} of ${icbhiPatients} ICBHI patients are free of copies.`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-20 lg:px-12">
        <div>
          <p data-reveal className="eyebrow m-0">{sceneEyebrow("paper", "The research")}</p>
          <h2 data-reveal className="mt-3 mb-0">The paper</h2>
        </div>
        <article data-paper-card className="rounded-2xl border border-line bg-paper-raised p-6 lg:p-8">
          <Badge tone="accent">Manuscript in preparation</Badge>
          <h3 className="mt-4 mb-3 max-w-4xl font-serif text-2xl leading-snug text-ink lg:text-3xl">
            More Than Half of the Kaggle Asthma Detection Dataset V2 Is Cut From ICBHI Recordings: Consequences for
            "External" Evaluation of Lung-Sound Classifiers
          </h3>
          <p className="m-0 text-ink-muted">Kalhan Bhat · Oren Coelho · Vir Bhalani · Prasenjit Bhavathankar · Sardar Patel Institute of Technology, Mumbai</p>
          <p className="m-0 mt-4 max-w-3xl text-ink">
            <span className="tabular font-semibold">{FACTS.copiedClips.display}</span> of {FACTS.kaggleClips.display} clips
            are copies of ICBHI audio, including all COPD clips. Once copied recordings and their patients are excluded,
            at most <span className="tabular font-semibold">{FACTS.cleanIcbhiPatients.display}</span> of {icbhiPatients} ICBHI
            patients remain for a clean external test.
          </p>
        </article>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
          {RECOMMENDATIONS.map((r, i) => (
            <li key={r.title} data-recommendation className="rounded-xl border border-line bg-paper-raised p-4">
              <p className="tabular m-0 text-sm font-semibold text-ink-muted">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 mb-2 text-lg">{r.title}</h3>
              <p className="m-0 text-sm text-ink-muted">{r.text}</p>
            </li>
          ))}
        </ol>
        <p data-reveal className="m-0 max-w-3xl text-ink-muted">
          It mattered to us first: before the audit, these copies had lifted our own model's score to
          {" "}<strong className="tabular text-ink">{FACTS.inflatedScore.display}</strong>. They are now removed automatically, and the
          training pipeline refuses to merge the two datasets without the evidence file that lists them.
        </p>
      </div>
    </SceneFrame>
  );
}
