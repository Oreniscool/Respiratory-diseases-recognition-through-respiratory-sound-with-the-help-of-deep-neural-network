import { Ring } from "../../components/Ring";
import { FACTS } from "../../content/facts";
import type { PredictResult } from "../../lib/api/types";
import { formatDuration, plainSentence, topTwo } from "./result";

export function Verdict({ result }: { result: PredictResult }) {
  const u = result.uncertainty;
  const [first, second] = topTwo(result.probabilities);
  const top = result.probabilities[result.model_prediction] ?? result.confidence;
  const facts = `${formatDuration(result.duration_s)} · ${result.windows_analyzed} windows · ${(result.sample_rate / 1000).toFixed(2)} kHz`;
  const check = `Score ${top.toFixed(1)}% vs answer-from ${FACTS.minConfidence.display} · uncertainty ${u.normalized_entropy.toFixed(2)} vs limit ${FACTS.maxEntropy.display}`;
  return (
    <div className="space-y-5">
      {result.uncertain ? (
        <div className="space-y-3">
          <p className="eyebrow m-0 text-ink-muted">No answer</p>
          <h3 className="m-0 font-serif text-4xl text-ink">The model isn't sure</h3>
          <p data-testid="closest-classes" className="m-0 text-ink">
            Closest: <strong className="tabular">{first} {result.probabilities[first]!.toFixed(1)}%</strong> and{" "}
            <strong className="tabular">{second} {result.probabilities[second]!.toFixed(1)}%</strong>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={top} />
          <div>
            <p className="eyebrow m-0">Strongest match</p>
            <p className="m-0 font-serif text-5xl leading-tight text-ink">{result.model_prediction.toUpperCase()}</p>
            <p className="m-0 text-sm text-ink-muted">calibrated model score · research prototype, not a diagnostic device</p>
          </div>
        </div>
      )}
      <p className="m-0 text-lg text-ink">{plainSentence(result)}</p>
      <p className="tabular m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted"><span>{check}</span><span>{facts}</span></p>
      {result.uncertain && <p className="m-0 text-sm text-ink-muted">A research prototype, not a diagnostic device.</p>}
    </div>
  );
}
