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

interface ReportStore {
  report: ReportData | null;
  analysis: AnalysisData | null;
  setReport: (data: ReportData) => void;
  setAnalysis: (data: AnalysisData) => void;
  clearReport: () => void;
  clearAnalysis: () => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  report: null,
  analysis: null,
  setReport: (data) => set({ report: data }),
  setAnalysis: (data) => set({ analysis: data }),
  clearReport: () => set({ report: null }),
  clearAnalysis: () => set({ analysis: null }),
}));
