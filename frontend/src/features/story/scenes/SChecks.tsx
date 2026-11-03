import { SceneFrame } from "../../../components/SceneFrame";
import { Check } from "../../../components/icons";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";

const CHECKS = [
  { id: "synthetic", value: FACTS.syntheticRecall.display, title: "Planted copies found",
    text: `We cut ${FACTS.syntheticCuts.display} degraded segments from ICBHI with known sources; the matcher traced them to the right recording.` },
  { id: "negative", value: FACTS.kauhIcbhiMatches.display, title: "No false alarms",
    text: "As a negative control, every KAUH recording, from a separate database, was matched against ICBHI. None matched." },
  { id: "listening", value: FACTS.listeningAgreement.display, title: "Confirmed by ear",
    text: `A blind listening check of the ${FACTS.listeningCases.display} hardest cases: every case that could be decided agreed with the matcher.` },
  { id: "fingerprint", value: FACTS.fingerprintIcbhi.display, title: "A second algorithm agrees",
    text: "Audio fingerprinting, a different method, found the same copies from the same recordings, and no extra ones." },
] as const;

export function SChecks() {
  const ref = useSceneTimeline<HTMLElement>("checks", (tl, root) => {
    tl.from(root.querySelectorAll("[data-check]"), { y: 24, opacity: 0, stagger: 0.18, duration: 0.45 });
  });
  return (
    <SceneFrame ref={ref} id="checks" label="Checking the checker"
      summary={`Four checks of the copy detector: ${FACTS.syntheticRecall.display} planted copies found, ${FACTS.kauhIcbhiMatches.display} false matches, ${FACTS.listeningAgreement.display} blind listening agreements, and ${FACTS.fingerprintIcbhi.display} copies confirmed by a second algorithm.`}>
      <SceneColumns eyebrow={sceneEyebrow("checks", "Validation")} title="Checking the checker" visual={
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <li key={c.id} data-check className="flex flex-col gap-2 rounded-xl border border-line bg-paper-raised p-4">
              <p data-countup="first" className="tabular m-0 font-serif text-4xl text-ink">{c.value}</p>
              <p className="m-0 flex items-center gap-2 font-semibold text-ink"><Check className="text-accent" />{c.title}</p>
              <p className="m-0 text-sm text-ink-muted">{c.text}</p>
            </li>
          ))}
        </ul>
      }>
        <p>
          A matcher we wrote ourselves needed checking before anyone should believe it. We tested it four different ways,
          from planted copies to listening with our own ears.
        </p>
        <p>
          It passed all four. The one planted copy it missed scored below the threshold, so our counts are, if
          anything, <strong>lower bounds</strong>: there may be slightly more copies, not fewer.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
