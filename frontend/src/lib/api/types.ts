/** Mirrors backend/server.py payloads (including the 2026-10-26 `members` and `window_scores`). */
export interface MemberScore {
  name: string;
  kind: string;
  weight: number;
  probabilities: Record<string, number>;
}

export interface PredictResult {
  prediction: string;
  model_prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  uncertain: boolean;
  uncertainty: { normalized_entropy: number; min_confidence: number; max_normalized_entropy: number };
  members?: MemberScore[];
  window_scores?: Record<string, number>[];
  duration_s: number;
  sample_rate: number;
  windows_analyzed: number;
  valid_frames: number[];
  research_only: boolean;
}

export interface ExplainResult {
  prediction: string;
  confidence: number;
  spectrogram: string;
  saliency: string;
  overlay: string;
  saliency_class: string;
  attribution_scope?: string;
  attribution_warning?: string;
}

export interface Health {
  ready: boolean;
  model_contract: string;
  classes: string[];
}
