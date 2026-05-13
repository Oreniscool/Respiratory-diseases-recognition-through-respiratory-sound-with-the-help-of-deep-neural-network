export interface PredictResult {
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  duration_s: number;
  sample_rate: number;
  mfcc_preview?: number[];
  filename?: string;
  patient_id?: string;
  requested_disease?: string;
}

export interface SummaryResponse {
  summary: string;
  model: string;
}

export interface ExplainabilityResponse {
  prediction: string;
  confidence: number;
  top_classes: Array<{ label: string; pct: number }>;
  spectrogram: string;
  saliency: string;
  overlay: string;
  saliency_class: string;
  reasoning?: string;
  reasoning_error?: string;
}

const API_BASE = "http://localhost:5000";

export async function predictFile(file: File): Promise<PredictResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function predictSample(disease: string): Promise<PredictResult> {
  const res = await fetch(
    `${API_BASE}/predict-sample/${encodeURIComponent(disease)}`,
    {
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function summarizeReport(payload: {
  model_result: PredictResult;
  patient_info: Record<string, unknown>;
}): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function requestExplainability(payload: {
  file: File | Blob;
  model_result?: PredictResult;
  patient_info?: Record<string, unknown>;
  include_reason?: boolean;
}): Promise<ExplainabilityResponse> {
  const form = new FormData();
  const file =
    payload.file instanceof File
      ? payload.file
      : new File([payload.file], "audio.wav", { type: "audio/wav" });
  form.append("file", file);
  form.append(
    "payload",
    JSON.stringify({
      model_result: payload.model_result ?? null,
      patient_info: payload.patient_info ?? null,
      include_reason: !!payload.include_reason,
    }),
  );

  const res = await fetch(`${API_BASE}/explain`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
