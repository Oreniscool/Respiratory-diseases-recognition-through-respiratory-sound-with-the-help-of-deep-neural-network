import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { AudioPlayer } from "../../../components/AudioPlayer";
import { FACTS } from "../../../content/facts";
import { SCENE_CLIPS } from "../../../content/sceneClips";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { useSceneAudio } from "../useSceneAudio";
import { Waveform } from "./charts/Waveform";

function ClipCard({ id, label, description, file }: (typeof SCENE_CLIPS)[number]) {
  const { analysis, synthetic } = useSceneAudio(id);
  return (
    <Card data-card className="space-y-2 !py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-xl">{label}</h3>
        {synthetic && <Badge>Synthesised illustration</Badge>}
      </div>
      <p className="m-0 text-sm text-ink-muted">{description}</p>
      {file
        ? <AudioPlayer src={file} peaks={analysis?.filtered ?? null} label={label} />
        : analysis && <Waveform peaks={analysis.filtered} height={52} fit />}
    </Card>
  );
}

export function S01Listening() {
  const ref = useSceneTimeline<HTMLElement>("s01", (tl, root) => {
    tl.from(root.querySelectorAll("[data-card]"), { y: 40, opacity: 0, stagger: 0.18 });
  });
  return (
    <SceneFrame ref={ref} id="s01" label="Listening to lungs" summary="What a stethoscope hears: a normal breath, crackles and wheezes, shown as waveforms.">
        <SceneColumns eyebrow="Step 1 · The input" title="Listening to lungs"
          visual={
            <div className="grid gap-4">
              {SCENE_CLIPS.map((c) => <ClipCard key={c.id} {...c} />)}
              <p className="m-0 text-xs text-ink-muted">
                Waveforms show the breath band ({FACTS.bandLowHz.display}–{FACTS.bandHighHz.display} Hz), the part of the
                sound RespiNet uses, each scaled to fit. Recordings from test-split patients of the ICBHI 2017 database.
              </p>
            </div>
          }>
          <p>
            A stethoscope records air moving through the airways. Most of the sound is the breath itself; some
            recordings carry extra sounds, such as short <strong>crackles</strong> or musical <strong>wheezes</strong>,
            that clinicians listen for.
          </p>
          <p>RespiNet only ever sees this sound. Everything that follows turns it into numbers it can learn from.</p>
        </SceneColumns>
    </SceneFrame>
  );
}
