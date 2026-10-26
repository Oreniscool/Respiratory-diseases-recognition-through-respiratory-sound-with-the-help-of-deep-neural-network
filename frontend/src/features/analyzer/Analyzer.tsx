import { useEffect } from "react";
import { Button } from "../../components/Button";
import { Alert, Upload } from "../../components/icons";
import { DEMO_CLIPS } from "../../content/demoClips";
import { getHealth, isMockMode, OfflineError } from "../../lib/api/client";
import { ACCEPTED, FORMATS_MESSAGE, useAnalyzer } from "./analyzerStore";
import { ExplainPanel } from "./ExplainPanel";
import { PipelineReplay } from "./PipelineReplay";
import { Recorder } from "./Recorder";
import { ResultView } from "./ResultView";

export function Analyzer() {
  const { phase, file, name, demoId, result, error, offline, start, startDemo, enterDemoMode, setOffline, reset } = useAnalyzer();

  useEffect(() => {
    let cancelled = false;
    getHealth().catch((e) => { if (!cancelled && e instanceof OfflineError) setOffline(true); });
    return () => { cancelled = true; };
  }, [setOffline]);

  const busy = phase === "running";
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="eyebrow m-0">Try it</p>
        <h2 className="m-0">Analyse a recording</h2>
        <p className="m-0 max-w-2xl text-ink-muted">
          Upload or record a lung sound, or pick a demo recording. A research prototype, not a diagnostic device: the result
          is a model score, not a clinical judgement.
        </p>
      </div>

      {offline && (
        <div role="status" className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-paper-raised p-4">
          <Alert className="text-warn" />
          <div className="flex-1">
            <p className="m-0 font-semibold text-ink">{isMockMode() ? "Demo mode: answers recorded from the real model" : "The model is offline"}</p>
            <p className="m-0 text-sm text-ink-muted">Demo recordings answer with responses recorded from the real model; uploads need the live model.</p>
          </div>
          {!isMockMode() && <Button variant="secondary" onClick={() => void enterDemoMode()}>Use demo mode</Button>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="analyzer-upload" className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-deep ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <Upload /> Upload a recording
        </label>
        <input id="analyzer-upload" type="file" className="sr-only" disabled={busy} aria-label="Upload a recording"
               accept={`${ACCEPTED.join(",")},audio/*`}
               onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f, f.name); }} />
        <Recorder />
        <span className="text-sm text-ink-muted">or a demo:</span>
        {DEMO_CLIPS.map((clip) => (
          <Button key={clip.id} variant="quiet" disabled={busy} onClick={() => void startDemo(clip.id)}>{clip.label}</Button>
        ))}
      </div>

      {phase === "error" && error && error.kind !== "offline" && (
        <div role="alert" className="flex gap-3 rounded-xl border border-line bg-paper-raised p-4 text-ink">
          <Alert className="mt-0.5 shrink-0 text-warn" />
          <div className="space-y-1">
            <p className="m-0">{error.message}</p>
            {error.kind === "rejected" && !error.message.includes(".wav") && <p className="m-0 text-sm text-ink-muted">{FORMATS_MESSAGE}</p>}
            {error.kind === "timeout" && file && name && <Button variant="secondary" onClick={() => void start(file, name, demoId)}>Try again</Button>}
          </div>
        </div>
      )}

      {busy && file && <PipelineReplay file={file} />}

      {phase === "done" && result && (
        <div className="space-y-8">
          <ResultView result={result} />
          {file && name && file.size > 0 && !isMockMode() && <ExplainPanel file={file} name={name} />}
          <Button variant="secondary" onClick={reset}>Analyse another recording</Button>
        </div>
      )}
    </div>
  );
}
