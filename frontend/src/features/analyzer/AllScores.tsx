import { ScoreBar } from "../../components/ScoreBar";
import type { PredictResult } from "../../lib/api/types";

export function AllScores({ result }: { result: PredictResult }) {
  const rows = Object.entries(result.probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      <h3 className="m-0">All five scores</h3>
      <p className="m-0 text-sm text-ink-muted">After fusion and calibration</p>
      <div>{rows.map(([label, value]) => <ScoreBar key={label} label={label} value={value} highlight={label === result.model_prediction && !result.uncertain} />)}</div>
    </div>
  );
}
