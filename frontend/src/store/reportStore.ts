import { create } from "zustand";
import type { PredictResult } from "../utils/predict";

export interface ReportData {
  summary: string;
  model: string;
  modelResult: PredictResult;
  patientInfo: Record<string, unknown>;
  createdAt: string;
}

export interface AnalysisData {
  audioFile: File | null;
  modelResult: PredictResult | null;
  patientInfo: Record<string, unknown>;
  capturedAt: string;
}

export interface HistoryEntry {
  id: string;
  prediction: string;
  confidence: number;
  fileName: string;
  timestamp: string;
  result: PredictResult;
}

interface ReportStore {
  report: ReportData | null;
  analysis: AnalysisData | null;
  history: HistoryEntry[];
  setReport: (data: ReportData) => void;
  setAnalysis: (data: AnalysisData) => void;
  clearReport: () => void;
  clearAnalysis: () => void;
  addHistory: (entry: HistoryEntry) => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  report: null,
  analysis: null,
  history: [],
  setReport: (data) => set({ report: data }),
  setAnalysis: (data) => set({ analysis: data }),
  clearReport: () => set({ report: null }),
  clearAnalysis: () => set({ analysis: null }),
  addHistory: (entry) => set((state) => ({ history: [entry, ...state.history].slice(0, 5) })),
}));
