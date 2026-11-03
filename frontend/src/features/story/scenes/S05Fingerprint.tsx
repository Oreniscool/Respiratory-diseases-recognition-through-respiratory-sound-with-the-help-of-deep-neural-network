import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { useSceneTimeline } from "../timeline";
import { sceneEyebrow } from "../scenes";
import { STAGE_AT } from "../../three/FingerprintTerrain";

const STAGES = [
  { id: "mel", title: `${FACTS.nMels.display} mel bands`, detail: "how loud each pitch band is, frame by frame" },
  { id: "mfcc", title: `${FACTS.nMfcc.display} MFCCs`, detail: "the shape of the spectrum, compressed" },
  { id: "full", title: `+ Δ and Δ²: ${FACTS.featuresPerFrame.display} numbers per frame`, detail: "how the shape changes, and how fast; normalised per recording (CMVN)" },
];
/** The scene's length in seconds (before PACE); the 3D landscape changes stage at STAGE_AT of it. */
const LENGTH = 7.5;

export function S05Fingerprint() {
  const ref = useSceneTimeline<HTMLElement>("s05", (tl, root) => {
    const labels = root.querySelectorAll("[data-stage]");
    labels.forEach((label, i) => {
      const at = STAGE_AT[i]! * LENGTH;
      if (i > 0) tl.to(labels[i - 1]!, { opacity: 0.4, duration: 0.4 }, at);
      tl.fromTo(label, { opacity: 0.4 }, { opacity: 1, duration: 0.4 }, at);
    });
  }, { minDuration: LENGTH });
  return (
    <SceneFrame ref={ref} id="s05" label="The sound fingerprint" summary="The spectrogram becomes 128 mel bands, then 40 MFCCs, then 120 numbers per frame with their rates of change, shown as a landscape of one window.">
        <SceneColumns eyebrow={sceneEyebrow("s05", "Features")} title="The sound fingerprint">
          <p>
            Each window becomes a picture of the sound: a spectrogram (FFT {FACTS.nFft.display}, hop {FACTS.hopSamples.display}),
            then three steps. The landscape shows one real window: time runs across, the numbers of each frame run back,
            and height and colour show their values.
          </p>
          <ol className="m-0 list-none space-y-2 p-0">
            {STAGES.map((s, i) => (
              <li key={s.id} data-stage className="flex gap-3 rounded-lg border border-line bg-paper-raised px-3 py-2">
                <span className="tabular text-sm font-semibold text-ink-muted">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{s.title}</span>
                  <span className="block text-xs text-ink-muted">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p>
            The result is a <strong>{FACTS.windowFrames.display} × {FACTS.featuresPerFrame.display}</strong> fingerprint per
            window: exactly what RespiNet reads.
          </p>
          <Badge>Approximation of the server's features</Badge>
        </SceneColumns>
    </SceneFrame>
  );
}
