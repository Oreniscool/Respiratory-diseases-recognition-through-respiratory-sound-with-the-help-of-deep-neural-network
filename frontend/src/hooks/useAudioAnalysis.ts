import { useEffect, useState } from "react";
import type { AudioAnalysis } from "../lib/audio/analyze";
import { ANALYSIS_RATE, decodeTo22050 } from "../lib/audio/decode";

export type AnalysisState = {
  status: "idle" | "decoding" | "analysing" | "done" | "error";
  result?: AudioAnalysis;
  error?: string;
};

/** Decode a recording and compute its features in a Web Worker, so scrolling stays smooth. */
export function useAudioAnalysis(file: Blob | null): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const [tracked, setTracked] = useState<Blob | null>(null);
  if (file !== tracked) {
    // reset during render when the input changes (no setState inside the effect body)
    setTracked(file);
    setState({ status: file ? "decoding" : "idle" });
  }

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let worker: Worker | undefined;
    decodeTo22050(file)
      .then((samples) => {
        if (cancelled) return;
        setState({ status: "analysing" });
        worker = new Worker(new URL("../lib/audio/worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: AudioAnalysis; error?: string }>) => {
          if (cancelled) return;
          setState(event.data.ok ? { status: "done", result: event.data.result } : { status: "error", error: event.data.error });
          worker?.terminate();
        };
        worker.postMessage({ samples, sr: ANALYSIS_RATE }, [samples.buffer]);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", error: "This file could not be decoded as audio." });
      });
    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [file]);

  return state;
}
