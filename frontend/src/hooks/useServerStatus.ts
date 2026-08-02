import { useEffect, useState, useRef } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export interface ServerStatus {
  online: boolean
  datasetOnline: boolean
  classes: string[]
  modelLoaded: boolean
  modelContract: string
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    online: false,
    datasetOnline: false,
    classes: [],
    modelLoaded: false,
    modelContract: 'unknown',
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) throw new Error('not ok')
      const data = await res.json()
      setStatus({
        online: true,
        datasetOnline: !!data.dataset,
        classes: Array.isArray(data.classes) ? data.classes : [],
        modelLoaded: !!data.model,
        modelContract: typeof data.model_contract === 'string' ? data.model_contract : 'unknown',
      })
    } catch {
      setStatus(prev => ({ ...prev, online: false, datasetOnline: false, modelLoaded: false }))
    }
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return status
}
