import { analyze, type AudioAnalysis } from "./analyze";

/** Run analyze() in a module worker so the page stays responsive (falls back inline where Worker is missing). */
export function analyzeInWorker(samples: Float32Array, sr: number): Promise<AudioAnalysis> {
  if (typeof Worker === "undefined") return Promise.resolve().then(() => analyze(samples, sr));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: AudioAnalysis; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "analysis failed"));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ samples, sr }, [samples.buffer]);
  });
}
