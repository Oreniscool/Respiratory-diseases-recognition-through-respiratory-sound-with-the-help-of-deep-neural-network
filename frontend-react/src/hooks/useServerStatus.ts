import { useEffect, useState, useRef } from 'react'

const API_BASE = 'http://localhost:5000'

export interface ServerStatus {
  online: boolean
  datasetOnline: boolean
  classes: string[]
  modelLoaded: boolean
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    online: false,
    datasetOnline: false,
    classes: [],
    modelLoaded: false,
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
      })
    } catch {
      setStatus(prev => ({ ...prev, online: false, datasetOnline: false }))
    }
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return status
}
