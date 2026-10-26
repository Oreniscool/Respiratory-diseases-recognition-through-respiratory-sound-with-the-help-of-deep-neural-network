import type { AudioAnalysis } from "../../../../lib/audio/analyze";
import { Waveform } from "./Waveform";

const WINDOW_SECONDS = (200 * 512) / 22050; // 200 frames at hop 512

/** The waveform with a 4.6 s window that the scene timeline slides across. */
export function WindowSlider({ analysis }: { analysis: AudioAnalysis }) {
  const widthPct = Math.min(100, (WINDOW_SECONDS / analysis.durationS) * 100);
  return (
    <div className="relative">
      <Waveform peaks={analysis.filtered} height={140} />
      <div data-window className="absolute inset-y-0 left-0 rounded-md border-2 border-accent bg-accent/10" style={{ width: `${widthPct}%` }}>
        <span className="absolute -top-7 left-0 whitespace-nowrap text-xs font-semibold text-accent">200 frames ≈ 4.6 s</span>
      </div>
      <div data-window-ghost className="absolute inset-y-0 left-0 rounded-md border border-dashed border-fill-strong opacity-0" style={{ width: `${widthPct}%`, transform: `translateX(50%)` }} />
    </div>
  );
}
