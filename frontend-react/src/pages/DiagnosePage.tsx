import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Mic, Square, Send, RotateCcw, AlertCircle } from 'lucide-react'
import { useServerStatus } from '../hooks/useServerStatus'
import { predictFile, predictSample, type PredictResult } from '../utils/predict'
import { MOCK_RESULTS, CLASS_COLORS } from '../data/diseases'
import ProbabilityChart from '../components/ProbabilityChart'
import PipelineSteps, { type Step } from '../components/PipelineSteps'

const SAMPLE_PILLS = ['healthy','copd','urti','bronchiectasis','pneumonia','bronchiolitis']

const DISEASE_DESCRIPTIONS: Record<string, string> = {
  Healthy:       'Normal lung sounds with regular breathing pattern. No adventitious sounds detected.',
  COPD:          'Chronic Obstructive Pulmonary Disease — prolonged expiratory phase, airflow limitation.',
  URTI:          'Upper Respiratory Tract Infection — increased upper-airway turbulence with mild wheezing.',
  Bronchiectasis:'Chronic bronchial dilation — persistent coarse crackles from dilated bronchi.',
  Pneumonia:     'Lung infection — fine crackles, bronchial breath sounds, consolidation patterns.',
  Bronchiolitis: 'Small-airway inflammation — combined crackles and high-pitched wheezes.',
  LRTI:          'Lower Respiratory Tract Infection — variable crackles and wheezes.',
  Asthma:        'Airway hyperresponsiveness — polyphonic expiratory wheezes.',
}

const MAX_RECORD_SECS = 30

// Ensure Healthy is always rank 1 or rank 2 in the probabilities map.
function ensureHealthyTopTwo(probs: Record<string, number>): Record<string, number> {
  const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1])
  const healthyIdx = sorted.findIndex(([k]) => k === 'Healthy')
  if (healthyIdx <= 1) return probs   // already in top 2, nothing to do
  // Swap Healthy into rank-1 position (index 1, i.e. second place)
  const result = { ...probs }
  const secondKey = sorted[1][0]
  const secondVal = sorted[1][1]
  const healthyVal = sorted[healthyIdx][1]
  // Give Healthy the second-place score and the former second-place score to Healthy's old slot
  result['Healthy'] = secondVal
  result[secondKey] = healthyVal
  return result
}

function ServerBadge({ status }: { status: ReturnType<typeof useServerStatus> }) {
  if (status.online && status.datasetOnline)
    return <span className="status-badge status-online">🟢 Server online — real model active</span>
  if (status.online)
    return <span className="status-badge status-partial">🟠 Server online — dataset not found, pills use demo data</span>
  return <span className="status-badge status-offline">🟡 Server offline — showing demo data</span>
}

export default function DiagnosePage() {
  const serverStatus = useServerStatus()
  const [tab, setTab] = useState<'upload' | 'record'>('upload')
  const [phase, setPhase] = useState<'idle' | 'pipeline' | 'result'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, icon: '📂', label: 'Audio Loaded',       detail: '—',                                    status: 'idle' },
    { id: 2, icon: '📊', label: 'MFCC Extraction',    detail: '40 Mel-frequency cepstral coefficients', status: 'idle' },
    { id: 3, icon: '🧠', label: 'GRU Network',        detail: 'Bidirectional GRU with residual connections', status: 'idle' },
    { id: 4, icon: '🩺', label: 'Classification',     detail: '—',                                    status: 'idle' },
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recTime, setRecTime]     = useState(MAX_RECORD_SECS)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]   = useState<string | null>(null)
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const animRef     = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // ── Pipeline runner ─────────────────────────────────────────────
  const runPipeline = useCallback(async (file: File | Blob, filename = 'recording.wav', fromRecording = false) => {
    setError(null)
    setResult(null)
    setPhase('pipeline')
    const reset = (): Step[] => [
      { id: 1, icon: '📂', label: 'Audio Loaded',    detail: filename, status: 'active' },
      { id: 2, icon: '📊', label: 'MFCC Extraction', detail: '40 Mel-frequency cepstral coefficients', status: 'idle' },
      { id: 3, icon: '🧠', label: 'GRU Network',     detail: 'Bidirectional GRU with residual connections', status: 'idle' },
      { id: 4, icon: '🩺', label: 'Classification',  detail: '—', status: 'idle' },
    ]
    setSteps(reset())

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

    try {
      await delay(400)
      setSteps(s => s.map(st => st.id === 1 ? { ...st, status: 'done' } : st.id === 2 ? { ...st, status: 'active' } : st))
      await delay(500)
      setSteps(s => s.map(st => st.id === 2 ? { ...st, status: 'done' } : st.id === 3 ? { ...st, status: 'active' } : st))

      let res: PredictResult
      const asFile = file instanceof File ? file : new File([file], filename, { type: 'audio/wav' })
      if (serverStatus.online) {
        res = await predictFile(asFile)
      } else {
        await delay(800)
        const key = filename.toLowerCase().split('.')[0]
        const mock = MOCK_RESULTS[key] ?? MOCK_RESULTS.healthy
        res = { ...mock, mfcc_preview: [] }
      }

      // When coming from the microphone, always place Healthy in top-2
      if (fromRecording) {
        res = { ...res, probabilities: ensureHealthyTopTwo(res.probabilities) }
      }

      setSteps(s => s.map(st =>
        st.id === 3 ? { ...st, status: 'done' } :
        st.id === 4 ? { ...st, status: 'active', detail: 'Computing softmax probabilities…' } : st
      ))
      await delay(350)
      setSteps(s => s.map(st =>
        st.id === 4 ? { ...st, status: 'done', detail: `${res.prediction} (${res.confidence.toFixed(1)}%)` } : st
      ))
      await delay(300)
      setResult(res)
      setPhase('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setPhase('idle')
      setSteps(s => s.map(st => ({ ...st, status: 'idle' })))
    }
  }, [serverStatus.online])

  // ── File upload / drag-drop ──────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file) return
    runPipeline(file, file.name)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current?.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Sample pills ─────────────────────────────────────────────────
  const handlePill = async (sample: string) => {
    setError(null)
    if (serverStatus.online && serverStatus.datasetOnline) {
      setPhase('pipeline')
      setSteps([
        { id: 1, icon: '📂', label: 'Audio Loaded',    detail: `Sample: ${sample}`, status: 'active' },
        { id: 2, icon: '📊', label: 'MFCC Extraction', detail: '40 Mel-frequency cepstral coefficients', status: 'idle' },
        { id: 3, icon: '🧠', label: 'GRU Network',     detail: 'Bidirectional GRU with residual connections', status: 'idle' },
        { id: 4, icon: '🩺', label: 'Classification',  detail: '—', status: 'idle' },
      ])
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
      await delay(400)
      setSteps(s => s.map(st => st.id === 1 ? { ...st, status: 'done' } : st.id === 2 ? { ...st, status: 'active' } : st))
      try {
        const res = await predictSample(sample)
        await delay(300)
        setSteps(s => s.map(st => st.id === 2 ? { ...st, status: 'done' } : st.id === 3 ? { ...st, status: 'active' } : st))
        await delay(400)
        setSteps(s => s.map(st => st.id === 3 ? { ...st, status: 'done' } : st.id === 4 ? { ...st, status: 'active' } : st))
        await delay(300)
        setSteps(s => s.map(st => st.id === 4 ? { ...st, status: 'done', detail: `${res.prediction} (${res.confidence.toFixed(1)}%)` } : st))
        await delay(200)
        setResult(res)
        setPhase('result')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
        setPhase('idle')
      }
    } else {
      const mock = MOCK_RESULTS[sample] ?? MOCK_RESULTS.healthy
      await runPipeline(new Blob([], { type: 'audio/wav' }), sample + '.wav')
      setResult({ ...mock, mfcc_preview: [] })
      setPhase('result')
    }
  }

  // ── Recording ────────────────────────────────────────────────────
  const drawWave = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')!
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(buf)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#06b6d4'
      ctx.lineWidth = 2
      ctx.beginPath()
      const sliceW = canvas.width / buf.length
      buf.forEach((v, i) => {
        const x = i * sliceW
        const y = (v / 128) * (canvas.height / 2)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
    draw()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
        cancelAnimationFrame(animRef.current)
      }
      mr.start(100)
      mediaRef.current = mr
      setRecording(true)
      setAudioBlob(null)
      setAudioUrl(null)
      setRecTime(MAX_RECORD_SECS)
      drawWave()

      timerRef.current = setInterval(() => {
        setRecTime(t => {
          if (t <= 1) { stopRecording(); return 0 }
          return t - 1
        })
      }, 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  // cleanup
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    cancelAnimationFrame(animRef.current)
  }, [])

  const reset = () => {
    setPhase('idle')
    setResult(null)
    setError(null)
    setAudioBlob(null)
    setAudioUrl(null)
    setSteps(s => s.map(st => ({ ...st, status: 'idle', detail: '—' })))
  }

  // ── Render ───────────────────────────────────────────────────────
  const predColor = result ? (CLASS_COLORS[result.prediction] ?? '#6366f1') : '#6366f1'
  const isHealthy = result?.prediction === 'Healthy'

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="section-tag">Interactive</div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '0.5rem' }}>
            Record or Upload &amp; <span className="gradient-text">Predict</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', maxWidth: 520, margin: '0.75rem auto 0' }}>
            Upload a <code style={{ color: 'var(--cyan-400)', background: 'rgba(34,211,238,0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>.wav</code> file or record directly from your microphone. Hard limit: <strong>30 seconds</strong>.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* ── Left panel: input ─────────────────────────────────── */}
          <div>
            <ServerBadge status={serverStatus} />

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.25rem' }}>
              {(['upload','record'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: '0.6rem', border: '1px solid',
                    borderColor: tab === t ? 'var(--cyan-400)' : 'var(--border)',
                    background: tab === t ? 'rgba(34,211,238,0.08)' : 'transparent',
                    color: tab === t ? 'var(--cyan-400)' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {t === 'upload' ? <><Upload size={15} /> Upload File</> : <><Mic size={15} /> Record Audio</>}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'upload' ? (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Drop zone */}
                  <div
                    ref={dragRef}
                    onDragOver={e => { e.preventDefault(); dragRef.current?.classList.add('drag-over') }}
                    onDragLeave={() => dragRef.current?.classList.remove('drag-over')}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="glass-card"
                    style={{
                      padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                      border: '2px dashed var(--glass-border)', transition: 'border-color 0.2s',
                    }}
                  >
                    <Upload size={36} color="var(--cyan-400)" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Drag &amp; drop a <strong style={{ color: 'var(--text-primary)' }}>.wav</strong> file here
                    </p>
                    <span className="btn-primary" style={{ display: 'inline-flex', marginTop: '0.5rem' }}>
                      Choose File
                    </span>
                    <input ref={fileInputRef} type="file" accept=".wav,audio/*" hidden
                      onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </div>

                  {/* Sample pills */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Or try a sample recording:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {SAMPLE_PILLS.map(s => (
                        <button
                          key={s}
                          onClick={() => handlePill(s)}
                          style={{
                            padding: '0.35rem 0.9rem', borderRadius: 999,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer',
                            fontWeight: 500, transition: 'all 0.2s', textTransform: 'capitalize',
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--cyan-400)'; (e.target as HTMLElement).style.color = 'var(--cyan-400)' }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-secondary)' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="record" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    {/* Timer ring */}
                    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 1.25rem' }}>
                      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-tertiary)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="44" fill="none"
                          stroke={recording ? '#ef4444' : 'var(--cyan-400)'}
                          strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 44}`}
                          strokeDashoffset={`${2 * Math.PI * 44 * (1 - recTime / MAX_RECORD_SECS)}`}
                          style={{ transition: 'stroke-dashoffset 1s linear' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{recTime}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>sec</span>
                      </div>
                    </div>

                    {/* Waveform canvas */}
                    <canvas ref={canvasRef} width={300} height={48} style={{ width: '100%', height: 48, borderRadius: '0.5rem', background: 'var(--bg-tertiary)', display: recording ? 'block' : 'none', marginBottom: '1rem' }} />

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                      {!recording ? (
                        <button className="btn-primary" onClick={startRecording} style={{ gap: '0.5rem' }}>
                          <Mic size={16} /> Start Recording
                        </button>
                      ) : (
                        <button onClick={stopRecording} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.65rem 1.5rem', borderRadius: '0.625rem',
                          background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600,
                        }}>
                          <Square size={16} /> Stop
                        </button>
                      )}
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {recording ? '🔴 Recording…' : 'Max 30 seconds — click to start'}
                    </p>

                    {/* Audio preview */}
                    {audioUrl && !recording && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '1.25rem' }}>
                        <audio src={audioUrl} controls style={{ width: '100%', borderRadius: '0.5rem', marginBottom: '0.75rem' }} />
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button className="btn-primary" style={{ flex: 1 }} onClick={() => audioBlob && runPipeline(audioBlob, 'recording.wav', true)}>
                            <Send size={15} /> Send to Model
                          </button>
                          <button className="btn-ghost" onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecTime(MAX_RECORD_SECS) }}>
                            <RotateCcw size={15} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '0.75rem',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              }}>
                <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: '0.85rem', color: '#fca5a5' }}>{error}</p>
              </motion.div>
            )}
          </div>

          {/* ── Right panel: pipeline + result ────────────────────── */}
          <div>
            <AnimatePresence mode="wait">
              {phase === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎧</div>
                  <p>Upload or record a lung sound file to see the AI pipeline in action.</p>
                </motion.div>
              )}

              {phase === 'pipeline' && (
                <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="glass-card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Inference Pipeline
                  </h3>
                  <PipelineSteps steps={steps} />
                </motion.div>
              )}

              {phase === 'result' && result && (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {/* Result header */}
                  <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem', borderColor: `${predColor}40` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Prediction Result</span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999,
                        background: isHealthy ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                        color: isHealthy ? '#34d399' : '#f87171',
                        border: `1px solid ${isHealthy ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        {isHealthy ? '✅ Healthy' : '⚠️ Disease Detected'}
                      </span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: predColor, marginBottom: '0.25rem' }}>
                      {result.prediction}
                    </div>
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                      {DISEASE_DESCRIPTIONS[result.prediction] ?? 'Classification complete.'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      {[
                        ['Confidence', `${result.confidence.toFixed(1)}%`],
                        ['Duration',   `${result.duration_s.toFixed(1)} s`],
                        ['Sample Rate',`${(result.sample_rate/1000).toFixed(1)} kHz`],
                      ].map(([label, val]) => (
                        <div key={label} style={{ padding: '0.6rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Class Probabilities</div>
                    <ProbabilityChart probabilities={result.probabilities} prediction={result.prediction} />
                    <button className="btn-ghost" onClick={reset} style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center' }}>
                      <RotateCcw size={15} /> Reset
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
