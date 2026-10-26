import { useEffect, useState } from "react";
import type { AudioAnalysis } from "../lib/audio/analyze";
import { analyzeInWorker } from "../lib/audio/analyzeAsync";
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
    decodeTo22050(file)
      .then((samples) => {
        if (cancelled) return undefined;
        setState({ status: "analysing" });
        return analyzeInWorker(samples, ANALYSIS_RATE);
      })
      .then((result) => {
        if (!cancelled && result) setState({ status: "done", result });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", error: "This file could not be decoded or analysed as audio." });
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return state;
}
