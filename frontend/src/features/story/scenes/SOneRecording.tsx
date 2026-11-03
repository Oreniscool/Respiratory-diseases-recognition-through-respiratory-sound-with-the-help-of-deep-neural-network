import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { STORY_DATA } from "../../../content/storyData";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { RecordingTimeline } from "./charts/RecordingTimeline";

function Count({ value, label }: { value: string; label: string }) {
  return (
    <div data-count className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-center">
      <p data-countup className="tabular m-0 font-serif text-4xl text-ink">{value}</p>
      <p className="m-0 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

export function SOneRecording() {
  const { reference, patient, clips } = STORY_DATA.oneRecording;
  const groups = [...new Set(clips.map((c) => c.group))];
  const ref = useSceneTimeline<HTMLElement>("oneRecording", (tl, root) => {
    tl.from(root.querySelectorAll("[data-copy]"), { opacity: 0, y: -14, stagger: 0.07, duration: 0.3 })
      .from(root.querySelectorAll("[data-count]"), { opacity: 0, y: 12, stagger: 0.15, duration: 0.35 });
  });
  return (
    <SceneFrame ref={ref} id="oneRecording" label="One recording, many clips"
      summary={`One ICBHI recording (${reference}) became ${clips.length} Kaggle clips under ${groups.length} different file-name groups. In total ${FACTS.copiedClips.display} clips come from ${FACTS.copiedRecordings.display} recordings of ${FACTS.copiedPatients.display} patients.`}>
      <SceneColumns eyebrow={sceneEyebrow("oneRecording", "How the copies were made")} title="One recording, many clips" visual={
        <div className="space-y-5">
          <RecordingTimeline reference={reference} clips={clips} />
          <div className="grid grid-cols-3 gap-2">
            <Count value={FACTS.copiedClips.display} label="Kaggle clips" />
            <Count value={FACTS.copiedRecordings.display} label="ICBHI recordings" />
            <Count value={FACTS.copiedPatients.display} label="ICBHI patients" />
          </div>
        </div>
      }>
        <p>
          The copies are not single clips. Take one recording of ICBHI patient {patient}: it was cut into
          <strong className="tabular"> {clips.length} back-to-back pieces</strong> of {clips[0]!.seconds} seconds.
        </p>
        <p>
          In the Kaggle set those pieces are filed under <strong>{groups.length} different names</strong> ({groups.join(", ")}),
          as if they came from {groups.length} people. A split that trusts those names can put one person's breath in
          training and in test.
        </p>
        <p>
          Across the whole set, <strong className="tabular">{FACTS.copiedClips.display}</strong> clips come from just
          <strong className="tabular"> {FACTS.copiedRecordings.display}</strong> recordings of
          <strong className="tabular"> {FACTS.copiedPatients.display}</strong> ICBHI patients.
        </p>
        <Why>Kaggle's "P" numbers are file names, not patients, so our split never uses them where the real patient is known.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
