import { useState } from "react";
import { SceneFrame } from "../../../components/SceneFrame";
import { Alert } from "../../../components/icons";
import { FACTS } from "../../../content/facts";
import { SceneColumns } from "../SceneColumns";
import { sceneEyebrow } from "../scenes";
import { useSceneTimeline } from "../timeline";

/** The original protocol, step by step; the steps that let test audio leak into training are flagged. */
const STEPS = [
  { id: "augment", title: "Make extra copies", text: `Every non-COPD recording gets ${FACTS.originalCopies.display} altered copies (noise, shift, two stretches).`,
    leak: "The copies were made before splitting, so near-identical versions of one recording could land in training and in test." },
  { id: "split", title: "Split at random", text: `All samples are shuffled and split ${FACTS.originalSplit.display} into training and test.`,
    leak: "A random split by sample ignores who the recording came from: the same recording and the same patient can sit on both sides." },
  { id: "train", title: "Train the network", text: `A GRU network with ${FACTS.originalParameters.display} parameters learns from the training samples.`, leak: null },
  { id: "pick", title: "Keep the best checkpoint", text: "The saved model is the epoch that scored best on the test split.",
    leak: "Choosing the model by its test score lets the test set tune the result, so the test is no longer unseen." },
] as const;

export function SOrigin() {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useSceneTimeline<HTMLElement>("origin", (tl, root) => {
    tl.from(root.querySelector("[data-claim]"), { scale: 0.9, opacity: 0, duration: 0.6 })
      .from(root.querySelectorAll("[data-step]"), { x: 24, opacity: 0, stagger: 0.15, duration: 0.45 })
      .from(root.querySelectorAll("[data-flag]"), { scale: 0, opacity: 0, stagger: 0.15, duration: 0.3 });
  });
  return (
    <SceneFrame ref={ref} id="origin" label="Where we started"
      summary={`The project began from a published model that reported ${FACTS.reportedAccuracy.display} accuracy on ${FACTS.originalClasses.display} ICBHI classes. Three steps of its protocol let test audio leak into training.`}>
      <SceneColumns eyebrow={sceneEyebrow("origin", "The starting point")} title="Where we started"
        visual={
          <div className="space-y-5">
            <div data-claim className="rounded-xl border border-line bg-paper-raised p-5">
              <p className="eyebrow m-0">Reported in the original paper</p>
              <p className="m-0 mt-1 font-serif text-6xl leading-none text-ink">
                <span data-countup className="tabular">{FACTS.reportedAccuracy.display}</span>
                <span className="ml-2 text-2xl text-ink-muted">± {FACTS.reportedSd.display}</span>
              </p>
              <p className="m-0 mt-2 text-sm text-ink-muted">accuracy, {FACTS.originalClasses.display} ICBHI classes, random split by sample</p>
            </div>
            <ol className="m-0 list-none space-y-2 p-0" aria-label="The original protocol">
              {STEPS.map((step, i) => (
                <li key={step.id} data-step className="rounded-xl border border-line bg-paper-raised">
                  <button type="button" disabled={!step.leak} aria-expanded={step.leak ? open === step.id : undefined}
                    onClick={() => setOpen(open === step.id ? null : step.id)}
                    className="flex w-full items-start gap-3 p-3 text-left disabled:cursor-default">
                    <span className="tabular mt-0.5 text-sm font-semibold text-ink-muted">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-ink">{step.title}</span>
                      <span className="block text-sm text-ink-muted">{step.text}</span>
                    </span>
                    {step.leak && (
                      <span data-flag className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warn px-2 py-0.5 text-xs font-semibold text-warn">
                        <Alert size={13} /> leak
                      </span>
                    )}
                  </button>
                  {step.leak && open === step.id && (
                    <p data-leak-detail className="m-0 border-t border-line px-3 py-2.5 pl-9 text-sm text-ink">{step.leak}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        }>
        <p>
          The project started from a published model: a recurrent network trained on the <strong>ICBHI 2017</strong>{" "}
          lung-sound database, which reported <strong className="tabular">{FACTS.reportedAccuracy.display}</strong> accuracy
          over {FACTS.originalClasses.display} diagnoses.
        </p>
        <p>
          Before building on it, we rebuilt its pipeline faithfully and looked at how it was tested. Three of its four steps
          let the test set leak into the result. <strong>Click a flagged step</strong> to see how.
        </p>
      </SceneColumns>
    </SceneFrame>
  );
}
