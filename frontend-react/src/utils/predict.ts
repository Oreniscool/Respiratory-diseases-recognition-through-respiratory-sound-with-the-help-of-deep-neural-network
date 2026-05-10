export interface PredictResult {
  prediction: string
  confidence: number
  probabilities: Record<string, number>
  duration_s: number
  sample_rate: number
  mfcc_preview?: number[]
  filename?: string
  patient_id?: string
  requested_disease?: string
}

const API_BASE = 'http://localhost:5000'

export async function predictFile(file: File): Promise<PredictResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/predict`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function predictSample(disease: string): Promise<PredictResult> {
  const res = await fetch(`${API_BASE}/predict-sample/${encodeURIComponent(disease)}`, {
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
