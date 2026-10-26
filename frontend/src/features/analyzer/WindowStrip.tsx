import { CLASS_COLORS, classColor } from "../../components/classColors";
import { Legend } from "../../components/Legend";
import type { PredictResult } from "../../lib/api/types";
import { leadingPerWindow, windowCounts } from "./result";

export function WindowStrip({ result }: { result: PredictResult }) {
  const leading = leadingPerWindow(result);
  const counts = windowCounts(result);
  if (!leading || !counts || !result.window_scores) return null;
  return (
    <div className="space-y-3">
      <h3 className="m-0">Through the recording</h3>
      <p className="m-0 text-sm text-ink-muted">RespiNet's reading of each window</p>
      <div className="flex gap-[2px]" role="img" aria-label={`Leading class per window: ${Object.entries(counts).map(([c, n]) => `${c} ${n}`).join(", ")}`}>
        {leading.map((c, i) => {
          const score = result.window_scores![i]![c]!;
          return <span key={i} title={`Window ${i + 1}: ${c} ${score.toFixed(0)}%`} className="h-8 flex-1 rounded-[2px]" style={{ background: classColor(c) }} />;
        })}
      </div>
      <Legend items={Object.keys(CLASS_COLORS).filter((c) => counts[c]).map((c) => ({ label: c, color: classColor(c), count: counts[c] }))} />
    </div>
  );
}
