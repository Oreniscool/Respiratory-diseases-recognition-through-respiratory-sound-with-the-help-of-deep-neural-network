import { SceneFrame } from "../../../components/SceneFrame";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { ServerFlow, type Stage } from "./charts/ServerFlow";

const STAGES: Stage[] = [
  { id: "format", title: "Format check", detail: "The file must be WAV, FLAC, OGG, MP3, WebM or M4A, and its first bytes must really match that format, not just its name." },
  { id: "limits", title: "Limits", detail: `Up to ${FACTS.maxUploadMb.display} MB and ${FACTS.maxAudioSeconds.display} seconds of audio, and at most ${FACTS.rateLimit.display} requests a minute from each visitor.` },
  { id: "gate", title: "Lung-sound check", detail: "YAMNet listens first: speech, music, tones, noise or silence are turned away with a clear message instead of a meaningless score." },
  { id: "verified", title: "Verified model", detail: "Every model file is checked against the SHA-256 fingerprint recorded when it was evaluated, along with the class order and the preprocessing settings. One mismatch and the server refuses to predict." },
  { id: "pipeline", title: "The pipeline", detail: "Only then does the recording go through everything in chapters 3 and 4. The next scene follows one recording through it." },
  { id: "answer", title: "The answer", detail: "Five calibrated scores, each model's vote and RespiNet's reading of every window, or \"uncertain\" when the abstention rules say so." },
];

export function SServer() {
  const ref = useSceneTimeline<HTMLElement>("server", (tl, root) => {
    tl.from(root.querySelectorAll("[data-stage]"), { opacity: 0, y: 10, stagger: 0.1, duration: 0.3 });
  });
  return (
    <SceneFrame ref={ref} id="server" label="Safety checks in the server"
      summary="The checks a recording passes in the server before and after the pipeline: format, limits, a lung-sound check, verified model files, then the answer. The server refuses to predict unless every model file is verified.">
      <SceneColumns eyebrow={sceneEyebrow("server", "The system")} title="Safety checks in the server" visual={
        <ServerFlow stages={STAGES}
          lock="Uploads are decoded from a temporary file that is deleted straight away: no recording is stored." />
      }>
        <p>
          The website talks to a small server that runs the pipeline. Before a recording reaches it, the server checks
          the recording and itself. Click through the checks.
        </p>
        <p>
          It is built to <strong>fail closed</strong>: when something doesn't check out, it refuses rather than guesses, so
          what answers is exactly what was tested.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
