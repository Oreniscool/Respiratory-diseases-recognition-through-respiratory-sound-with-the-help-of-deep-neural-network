import { SceneFrame } from "../../../components/SceneFrame";
import { Badge } from "../../../components/Badge";
import { FACTS } from "../../../content/facts";
import { SceneColumns, Why } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";
import { FocalCurve } from "./charts/FocalCurve";
import { MaskDemo } from "./charts/MaskDemo";

const AUGMENTATIONS = [
  { id: "noise", label: `Background noise at ${FACTS.noiseSnrDb.display} dB` },
  { id: "shift", label: `Shifted by ${FACTS.shiftSamples.display} samples` },
  { id: "stretch", label: `Stretched ${FACTS.stretchRates.display}` },
];

export function SLearning() {
  const ref = useSceneTimeline<HTMLElement>("learning", (tl, root) => {
    const curve = root.querySelector<SVGPathElement>("[data-focal]");
    const length = curve?.getTotalLength?.() ?? 600;
    tl.fromTo(curve, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1 })
      .from(root.querySelectorAll("[data-augment]"), { opacity: 0, y: 10, stagger: 0.12, duration: 0.3 })
      .from(root.querySelectorAll("[data-mask]"), { opacity: 0, stagger: 0.12, duration: 0.3 });
  });
  return (
    <SceneFrame ref={ref} id="learning" label="Learning from little data"
      summary={`Focal loss (γ = ${FACTS.focalGamma.display}) turns down examples the model already gets right; training audio is varied with noise, shifts and stretches, and parts of each window are masked.`}>
      <SceneColumns eyebrow={sceneEyebrow("learning", "Training tricks")} title="Learning from little data" visual={
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper-raised p-4"><FocalCurve served={FACTS.focalGamma.value} /></div>
          <div className="space-y-3 rounded-xl border border-line bg-paper-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-ink">New versions of each training recording</p>
              <Badge>Training only</Badge>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {AUGMENTATIONS.map((a) => (
                <li key={a.id} data-augment className="rounded-full border border-line px-3 py-1 text-sm text-ink">{a.label}</li>
              ))}
            </ul>
            <p className="m-0 pt-2 text-sm font-semibold text-ink">…and every window gets random gaps (SpecAugment)</p>
            <MaskDemo freqMax={FACTS.specFreqMaxBins.value} timeMax={FACTS.specTimeMaxFrames.value} />
          </div>
        </div>
      }>
        <p>
          COPD has far more recordings than any other class, so a plain loss would spend most of its effort on COPD.
          <strong> Focal loss</strong> turns down the weight of examples the model already gets right, so learning goes to the
          hard ones. Slide γ to see how strongly.
        </p>
        <p>
          With so few patients, the network also needs variety. Each training recording gets new versions: a little
          noise, a small shift, slightly faster or slower. And each window has random bands of time and frequency
          blanked out ({FACTS.specFreqMasks.display}, {FACTS.specTimeMasks.display}), so it can't rely on any single detail.
        </p>
        <Why>Label smoothing ({FACTS.labelSmoothing.display}) also keeps the network from becoming overconfident about any one label.</Why>
      </SceneColumns>
    </SceneFrame>
  );
}
