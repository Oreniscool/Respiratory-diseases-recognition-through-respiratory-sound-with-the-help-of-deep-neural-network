import { Link } from "react-router";
import { SceneFrame } from "../../../components/SceneFrame";
import { Ring } from "../../../components/Ring";
import { ArrowRight } from "../../../components/icons";
import { FACTS, SAMPLE } from "../../../content/facts";
import { memberLabel, memberTop } from "../../../content/members";
import { useSceneTimeline } from "../timeline";

export function S13EndToEnd() {
  const u = SAMPLE.uncertainty;
  const top = SAMPLE.model_prediction;
  const fused = SAMPLE.probabilities[top] ?? SAMPLE.confidence;
  const steps = [
    { title: `${Math.round(SAMPLE.duration_s)} s of audio`, detail: "a COPD recording from a test patient" },
    { title: "Decoded twice", detail: "22.05 kHz for RespiNet · 16 kHz for the three pretrained models" },
    { title: "Band-pass", detail: "100–2,000 Hz" },
    { title: `${SAMPLE.windows_analyzed} windows`, detail: "200 frames each, overlapping by half" },
    { title: "200 × 120 fingerprints", detail: "MFCC + Δ + Δ², normalised" },
    { title: "Six networks listen", detail: "3 RespiNets averaged · YAMNet, OPERA-CE and HeAR, each with a logistic head" },
    { title: "Four calibrated scores", detail: (SAMPLE.members ?? []).map((m) => `${memberLabel(m.name)} ${memberTop(m).label} ${memberTop(m).score.toFixed(1)}%`).join(" · ") },
    { title: "Fusion and calibration", detail: `equal weights, temperature ${FACTS.fusedTemperature.display}` },
    { title: "Abstention check", detail: `${SAMPLE.confidence.toFixed(1)}% ≥ ${FACTS.minConfidence.display} · uncertainty ${u.normalized_entropy.toFixed(2)} ≤ ${FACTS.maxEntropy.display}` },
  ];
  const ref = useSceneTimeline<HTMLElement>("s13", (tl, root) => {
    const items = root.querySelectorAll("[data-flow-step]");
    tl.fromTo(root.querySelector("[data-flow-line]"), { scaleY: 0 }, { scaleY: 1, transformOrigin: "top", duration: items.length * 0.25, ease: "none" })
      .from(items, { opacity: 0.2, x: -10, stagger: 0.25, duration: 0.25 }, "<")
      .from(root.querySelector("[data-verdict]"), { opacity: 0, scale: 0.9, duration: 0.5 });
  }, { length: 220 });
  return (
    <SceneFrame ref={ref} id="s13" label="From your recording to an answer" summary={`The sample recording passes every step and ends as strongest match ${top}, ${fused.toFixed(1)}%.`}>
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_minmax(0,40%)] lg:px-12">
        <div>
          <p data-reveal className="eyebrow m-0">Step 13 · All together</p>
          <h2 data-reveal className="mt-3 mb-8">From your recording to an answer</h2>
          <ol className="relative m-0 list-none space-y-4 p-0 pl-8">
            <span data-flow-line className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-accent" aria-hidden="true" />
            {steps.map((s) => (
              <li key={s.title} data-flow-step className="relative">
                <span className="absolute -left-8 top-1.5 size-4 rounded-full border-2 border-accent bg-paper" aria-hidden="true" />
                <span className="font-semibold text-ink">{s.title}</span> <span className="text-sm text-ink-muted">{s.detail}</span>
              </li>
            ))}
          </ol>
        </div>
        <div data-verdict className="space-y-6 rounded-2xl border border-line bg-paper-raised p-8">
          <div className="flex items-center gap-6">
            <Ring value={fused} />
            <div>
              <p className="eyebrow m-0">Strongest match</p>
              <p className="m-0 font-serif text-5xl text-ink">{top.toUpperCase()}</p>
            </div>
          </div>
          <p className="sr-only">Strongest match: {top.toUpperCase()}</p>
          <p className="m-0 text-sm text-ink-muted">Calibrated model score · a research prototype, not a diagnostic device</p>
          <Link to="/analyze" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-accent-deep">
            Try it with your own recording <ArrowRight />
          </Link>
        </div>
      </div>
    </SceneFrame>
  );
}
