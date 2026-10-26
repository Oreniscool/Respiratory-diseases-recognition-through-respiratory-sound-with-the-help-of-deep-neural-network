/// <reference lib="webworker" />
import { analyze } from "./analyze";

export type AnalysisRequest = { samples: Float32Array; sr: number };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    scope.postMessage({ ok: true, result: analyze(event.data.samples, event.data.sr) });
  } catch (error) {
    scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
