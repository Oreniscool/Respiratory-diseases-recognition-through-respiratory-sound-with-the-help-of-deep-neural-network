/** The only module that talks to the backend (spec §6.4). */
import { mockHealth, mockPredict } from "./mock";
import type { ExplainResult, Health, PredictResult } from "./types";

export const REQUEST_TIMEOUT_MS = 120_000;

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
export class OfflineError extends Error {
  constructor(message = "The model is offline") {
    super(message);
    this.name = "OfflineError";
  }
}
export class TimeoutError extends Error {
  constructor(message = "The model took too long to answer") {
    super(message);
    this.name = "TimeoutError";
  }
}

let mockMode = import.meta.env.VITE_MOCK_API === "1";
export const setMockMode = (on: boolean): void => {
  mockMode = on;
};
export const isMockMode = (): boolean => mockMode;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new TimeoutError();
    throw new OfflineError();
  }
  const body = await response.json().catch(() => ({}));
  // 503 from the server; 502/504 from a proxy (Vite, nginx) whose backend is down
  if (response.status === 502 || response.status === 503 || response.status === 504) throw new OfflineError();
  if (!response.ok) throw new ApiError(body?.error ?? `HTTP ${response.status}`, response.status);
  return body as T;
}

function form(file: Blob, filename: string): FormData {
  const data = new FormData();
  data.append("file", file, filename);
  data.append("denoise", "0");
  return data;
}

export async function getHealth(): Promise<Health> {
  if (mockMode) return mockHealth();
  let health: Health;
  try {
    health = await request<Health>("/health");
  } catch {
    throw new OfflineError(); // any failed health check means the model cannot be used
  }
  if (health.model_contract !== "verified-metadata") throw new OfflineError();
  return health;
}

export async function predict(file: Blob, filename: string, demoClipId?: string): Promise<PredictResult> {
  if (mockMode) {
    // only demo clips have recorded answers; a visitor's own recording must never get one
    if (!demoClipId) throw new OfflineError("Uploads and recordings need the live model. The demo recordings still work.");
    return mockPredict(demoClipId);
  }
  return request<PredictResult>("/predict", { method: "POST", body: form(file, filename) });
}

export async function explain(file: Blob, filename: string): Promise<ExplainResult> {
  if (mockMode) throw new OfflineError("Explanations need the live model");
  return request<ExplainResult>("/explain", { method: "POST", body: form(file, filename) });
}
