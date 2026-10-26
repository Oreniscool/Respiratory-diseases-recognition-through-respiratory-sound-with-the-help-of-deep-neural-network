import { useState } from "react";
import { explain } from "../../lib/api/client";
import type { ExplainResult } from "../../lib/api/types";

/** On demand: RespiNet's time sensitivity over the spectrogram (/explain). */
export function ExplainPanel({ file, name }: { file: Blob; name: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: ExplainResult; error?: string }>({ status: "idle" });
  const run = async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "done", data: await explain(file, name) });
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  };
  if (state.status === "idle") {
    return <button type="button" onClick={run} className="text-sm font-semibold text-accent underline underline-offset-4">Where did RespiNet listen?</button>;
  }
  if (state.status === "loading") return <p className="m-0 text-sm text-ink-muted">Computing RespiNet's time sensitivity…</p>;
  if (state.status === "error") return <p className="m-0 text-sm text-ink-muted">{state.error}</p>;
  return (
    <figure className="m-0 space-y-2">
      <img src={state.data!.overlay} alt="RespiNet's time sensitivity over the spectrogram" className="w-full rounded-lg border border-line" />
      <figcaption className="text-sm text-ink-muted">
        Where RespiNet listened (RespiNet only; the other three models are not covered). It shows when the network's score is
        sensitive, not causal evidence.
      </figcaption>
    </figure>
  );
}
