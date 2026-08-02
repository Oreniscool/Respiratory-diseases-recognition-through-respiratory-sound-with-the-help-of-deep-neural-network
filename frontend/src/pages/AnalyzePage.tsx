import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.js";
import AudioLines from "lucide-react/dist/esm/icons/audio-lines.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import ChartNoAxesCombined from "lucide-react/dist/esm/icons/chart-no-axes-combined.js";
import CircleStop from "lucide-react/dist/esm/icons/circle-stop.js";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import FileAudio from "lucide-react/dist/esm/icons/file-audio.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical.js";
import Info from "lucide-react/dist/esm/icons/info.js";
import Mic from "lucide-react/dist/esm/icons/mic.js";
import Play from "lucide-react/dist/esm/icons/play.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.js";
import Upload from "lucide-react/dist/esm/icons/upload.js";
import AudioVisuals from "../components/AudioVisuals";
import { useServerStatus } from "../hooks/useServerStatus";
import { useReportStore } from "../store/reportStore";
import {
  predictFile,
  predictSample,
  summarizeReport,
  type PredictResult,
} from "../utils/predict";

const SAMPLE_LABELS = ["healthy", "copd", "urti", "bronchiectasis", "pneumonia", "bronchiolitis"];
const MAX_FILE_MB = 20;

type AnalysisStatus = "idle" | "running" | "success" | "error";
type CaptureMode = "upload" | "record" | "sample";

function safeLabel(label: string) {
  return label.toLowerCase() === "healthy" ? "No adventitious sound pattern" : label;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function AnalyzePage() {
  const navigate = useNavigate();
  const server = useServerStatus();
  const setAnalysis = useReportStore((state) => state.setAnalysis);
  const setReport = useReportStore((state) => state.setReport);

  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<CaptureMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [denoise, setDenoise] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [age, setAge] = useState("");
  const [notes, setNotes] = useState("");
  const [reportConsent, setReportConsent] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  const contractVerified = server.modelContract === "verified-metadata" || server.modelContract === "legacy";
  const modelReady = server.online && server.modelLoaded && contractVerified;
  const hasSource = Boolean(file || sample);
  const currentStep = result ? 3 : status === "running" ? 2 : 1;

  const sortedScores = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.probabilities).sort((a, b) => b[1] - a[1]);
  }, [result]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioUrl]);

  const patientInfo = useMemo(
    () => ({
      patient_id: patientId.trim() || null,
      age: age.trim() ? Number(age) : null,
      notes: notes.trim() || null,
      capture_mode: mode,
    }),
    [age, mode, notes, patientId],
  );

  const chooseFile = (nextFile: File) => {
    setError(null);
    setResult(null);
    if (nextFile.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Choose a recording smaller than ${MAX_FILE_MB} MB.`);
      return;
    }
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["wav", "mp3", "webm", "ogg", "m4a"].includes(extension)) {
      setError("Choose a WAV, MP3, WebM, OGG, or M4A audio file.");
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(nextFile);
    setAudioUrl(URL.createObjectURL(nextFile));
    setSample(null);
    setMode("upload");
    setStatus("idle");
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) chooseFile(nextFile);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) chooseFile(nextFile);
  };

  const chooseSample = (label: string) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setFile(null);
    setSample(label);
    setMode("sample");
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const recordedFile = new File([blob], `respiratory-recording-${Date.now()}.webm`, {
          type: blob.type,
        });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setFile(recordedFile);
        setAudioUrl(URL.createObjectURL(recordedFile));
        setSample(null);
        setMode("record");
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start();
      setRecordSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecordSeconds((value) => {
          if (value >= 29) {
            recorder.stop();
            return 30;
          }
          return value + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access was unavailable. Check browser permission or upload a recording instead.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const runAnalysis = async () => {
    if (!hasSource || !modelReady) return;
    setStatus("running");
    setError(null);
    setResult(null);
    setReportError(null);
    try {
      const nextResult = file
        ? await predictFile(file, { denoise })
        : await predictSample(sample!, { denoise });
      const normalized = { ...nextResult, noise_cancellation: denoise };
      setResult(normalized);
      setStatus("success");
      // Celebratory confetti on successful analysis
      try {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.7 },
          colors: ["#2f477d", "#557b69", "#6ca6c1", "#e7f1ec"],
          disableForReducedMotion: true,
        });
      } catch { /* confetti is purely decorative */ }
      setAnalysis({
        audioFile: file,
        modelResult: normalized,
        patientInfo,
        capturedAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis could not be completed.");
      setStatus("error");
    }
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setFile(null);
    setSample(null);
    setResult(null);
    setError(null);
    setStatus("idle");
    setReportStatus("idle");
    setReportError(null);
  };

  const generateReport = async () => {
    if (!result || !reportConsent) return;
    setReportStatus("loading");
    setReportError(null);
    try {
      const response = await summarizeReport({
        model_result: result,
        patient_info: patientInfo,
        external_llm_consent: true,
      });
      setReport({
        summary: response.summary,
        model: response.model,
        modelResult: result,
        patientInfo,
        createdAt: new Date().toISOString(),
      });
      navigate("/report");
    } catch (caught) {
      setReportStatus("error");
      setReportError(caught instanceof Error ? caught.message : "The summary could not be generated.");
    }
  };

  return (
    <div className="analyze-page">
      <section className="analyze-main">
        <motion.header
          className="page-heading analyze-heading"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Respiratory sound research workspace</p>
          <h1>Explore a respiratory recording</h1>
          <p className="research-warning">Research prototype — not a diagnostic device</p>
        </motion.header>

        <ol className="analysis-steps" aria-label="Analysis progress">
          {["Review recording", "Run analysis", "Read the evidence"].map((label, index) => {
            const step = index + 1;
            return (
              <motion.li
                key={label}
                className={step <= currentStep ? "is-current" : ""}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.1 + 0.15, ease: "easeOut" }}
              >
                <motion.span
                  animate={step <= currentStep ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {step < currentStep ? <Check size={17} aria-label="Complete" /> : step}
                </motion.span>
                <strong>{label}</strong>
              </motion.li>
            );
          })}
        </ol>

        <section className="recording-workspace" aria-labelledby="recording-title">
          <div className="recording-toolbar">
            <div className="recording-identity">
              <span className="file-icon"><FileAudio aria-hidden="true" /></span>
              <div>
                <h2 id="recording-title">{file?.name ?? (sample ? `ICBHI example: ${sample}` : "Choose a respiratory recording")}</h2>
                <p className="mono-meta">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.type || "audio file"}`
                    : sample
                      ? "Dataset example · audio is processed on the backend"
                      : "WAV recommended · up to 20 MB · audio never autoplays"}
                </p>
              </div>
            </div>
            <a href="/evidence#method" className="button button-secondary button-small">
              <FileText size={16} aria-hidden="true" /> View method
            </a>
          </div>

          {!result && <><div className="source-tabs" role="tablist" aria-label="Recording source">
            <button type="button" className={mode === "upload" ? "is-active" : ""} onClick={() => setMode("upload")}>
              <Upload size={17} aria-hidden="true" /> Upload
            </button>
            <button type="button" className={mode === "record" ? "is-active" : ""} onClick={() => setMode("record")}>
              <Mic size={17} aria-hidden="true" /> Record
            </button>
            <button type="button" className={mode === "sample" ? "is-active" : ""} onClick={() => setMode("sample")}>
              <FlaskConical size={17} aria-hidden="true" /> Dataset example
            </button>
          </div>

          <AnimatePresence mode="wait">
          {mode === "upload" && !file && (
            <motion.div
              key="upload"
              className={`upload-zone${dragging ? " is-dragging" : ""}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              onDragEnter={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <Upload aria-hidden="true" />
              <div>
                <strong>Drop a recording here</strong>
                <p>or choose a supported audio file from this device</p>
              </div>
              <button type="button" className="button button-secondary" onClick={() => inputRef.current?.click()}>
                Choose recording
              </button>
              <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a" onChange={handleFileInput} hidden />
            </motion.div>
          )}

          {mode === "record" && (
            <motion.div
              key="record"
              className="record-panel"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`record-indicator${recording ? " is-recording" : ""}`}>
                <Mic aria-hidden="true" />
              </div>
              <div>
                <strong>{recording ? `Recording ${formatSeconds(recordSeconds)}` : "Record up to 30 seconds"}</strong>
                <p>Use a quiet room and keep the microphone position steady. Recording stops automatically at 30 seconds.</p>
              </div>
              <button type="button" className={recording ? "button button-danger" : "button button-secondary"} onClick={recording ? stopRecording : startRecording}>
                {recording ? <><CircleStop size={17} /> Stop</> : <><Mic size={17} /> Start recording</>}
              </button>
            </motion.div>
          )}

          {mode === "sample" && (
            <motion.div
              key="sample"
              className="sample-picker"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <div>
                <strong>Use an available ICBHI dataset example</strong>
                <p>The requested label selects a file; it does not guarantee what the model will output.</p>
              </div>
              <div className="sample-options">
                {SAMPLE_LABELS.map((label) => (
                  <button key={label} type="button" className={sample === label ? "is-selected" : ""} onClick={() => chooseSample(label)}>
                    {label === "healthy" ? "No adventitious sound" : label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
          </>}

          <AudioVisuals audioUrl={audioUrl} fileName={file?.name} />

          {audioUrl && (
            <div className="audio-player-row">
              <Play size={18} aria-hidden="true" />
              <audio controls src={audioUrl} preload="metadata" aria-label={`Playback ${file?.name ?? "recording"}`} />
            </div>
          )}

          {!result && <details className="advanced-disclosure" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
            <summary>
              <span><ChevronDown aria-hidden="true" /> Optional context and processing</span>
              <small>Only include non-identifying research notes</small>
            </summary>
            <div className="advanced-content">
              <label>
                Research ID
                <input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="e.g. STUDY-042" />
              </label>
              <label>
                Age
                <input type="number" min="0" max="120" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Years" />
              </label>
              <label className="field-wide">
                Context note
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Recording position, device, environment, or study note" />
              </label>
              <label className="checkbox-field field-wide">
                <input type="checkbox" checked={denoise} onChange={(event) => setDenoise(event.target.checked)} />
                <span><strong>Apply experimental denoising</strong><small>This changes the processed input and is recorded with the result.</small></span>
              </label>
            </div>
          </details>}

          {!result && !server.online && (
            <div className="inline-alert alert-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div><strong>Backend unavailable</strong><p>Start the Flask server, then this page will reconnect automatically.</p></div>
            </div>
          )}
          {!result && server.online && !server.modelLoaded && (
            <div className="inline-alert alert-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div><strong>Model artifact unavailable</strong><p>The server is online, but inference cannot run until a compatible model is loaded.</p></div>
            </div>
          )}
          {!result && server.online && server.modelLoaded && !contractVerified && (
            <div className="inline-alert alert-warning" role="alert">
              <ShieldCheck aria-hidden="true" />
              <div><strong>Model contract is not verified</strong><p>Analysis is paused because the model’s class order and preprocessing metadata cannot be confirmed.</p></div>
            </div>
          )}
          {error && (
            <div className="inline-alert alert-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div><strong>Analysis could not complete</strong><p>{error}</p></div>
            </div>
          )}

          <div className="analysis-action-row">
            <div className="readiness-copy" aria-live="polite">
              <span className={modelReady ? "readiness-dot is-ready" : "readiness-dot"} />
              {modelReady ? "Verified model contract ready" : "Waiting for a verified model"}
            </div>
            {result && (
              <button type="button" className="button button-quiet" onClick={reset}>
                <RefreshCw size={17} aria-hidden="true" /> Start over
              </button>
            )}
            <button
              type="button"
              className="button button-primary analyze-button"
              disabled={!hasSource || !modelReady || status === "running"}
              onClick={runAnalysis}
            >
              <AudioLines size={20} aria-hidden="true" />
              {status === "running" ? "Analyzing recording…" : result ? "Run analysis again" : "Run research analysis"}
            </button>
          </div>
        </section>

        <section className="results-section" aria-labelledby="results-title" aria-live="polite">
          <div className="section-rule-heading">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2 id="results-title">Read the evidence</h2>
            </div>
            {result && <span className="status-chip status-neutral">Analysis complete</span>}
          </div>

          {!result ? (
            <div className="results-empty">
              <Sparkles aria-hidden="true" />
              <div>
                <strong>Results will appear here</strong>
                <p>Select a recording and run the verified model. This area will show direct-labeled scores, alternatives, and limitations.</p>
              </div>
            </div>
          ) : (
            <div className="result-panel">
              <div className="score-column">
                <div className="result-heading-row">
                  <div>
                    <p className="eyebrow">Model scores — uncalibrated</p>
                    <h3>{safeLabel(result.prediction)}</h3>
                  </div>
                  <strong className="top-score">{result.confidence.toFixed(1)}<span>%</span></strong>
                </div>
                <p className="score-caveat">Scores describe this model’s output. They do not prove or rule out disease.</p>
                <div className="score-list" role="table" aria-label="Model scores">
                  {sortedScores.map(([label, value], index) => (
                    <motion.div
                      className="score-row"
                      role="row"
                      key={label}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.07 + 0.15, ease: "easeOut" }}
                    >
                      <span className="score-rank" aria-hidden="true">{index + 1}</span>
                      <span className="score-label" role="rowheader">{safeLabel(label)}</span>
                      <span className="score-track">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(1, value)}%` }}
                          transition={{ duration: 0.8, delay: index * 0.07 + 0.2, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </span>
                      <span className="score-value mono-meta" role="cell">{value.toFixed(1)}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="summary-column">
                <p className="eyebrow">Plain-language summary</p>
                <h3>How to read this result</h3>
                <p>
                  This recording’s strongest model match is <strong>{safeLabel(result.prediction)}</strong>. The ranking compares the input with patterns learned from the project’s training data; it is not a clinical probability.
                </p>
                <dl className="result-metadata">
                  <div><dt>Analyzed duration</dt><dd>{formatSeconds(result.duration_s)}</dd></div>
                  <div><dt>Sample rate</dt><dd>{(result.sample_rate / 1000).toFixed(1)} kHz</dd></div>
                  <div><dt>Denoising</dt><dd>{result.noise_cancellation ? "Applied" : "Not applied"}</dd></div>
                  <div><dt>Source</dt><dd>{result.filename ?? file?.name ?? `ICBHI ${sample} example`}</dd></div>
                </dl>
                <div className="learning-note">
                  <BookOpenNote />
                  <div><strong>Why “uncalibrated” matters</strong><p>A high score can still be wrong. Modern neural networks can produce scores that overstate certainty.</p><a href="https://proceedings.mlr.press/v70/guo17a.html" target="_blank" rel="noreferrer">Guo et al., 2017</a></div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="result-actions">
              <button type="button" className="button button-secondary" disabled={!file} onClick={() => navigate("/explainability")} title={!file ? "Explainability requires an uploaded or recorded file" : undefined}>
                <Sparkles size={17} aria-hidden="true" /> Inspect experimental attribution
              </button>
              <label className="consent-row">
                <input type="checkbox" checked={reportConsent} onChange={(event) => setReportConsent(event.target.checked)} />
                <span>I consent to sending de-identified structured context to the configured external LLM provider.</span>
              </label>
              <button type="button" className="button button-primary" disabled={!reportConsent || reportStatus === "loading"} onClick={generateReport}>
                <FileText size={17} aria-hidden="true" /> {reportStatus === "loading" ? "Generating summary…" : "Generate research summary"}
              </button>
              {reportError && <p className="form-error" role="alert">{reportError}</p>}
            </div>
          )}
        </section>
      </section>

      <aside className="evidence-rail" aria-label="How to interpret this workspace">
        <GuideItem icon={<EyeIcon />} title="What the model saw">
          The classifier receives a time–frequency representation derived from the recording. It may respond to short discontinuous sounds, tonal sounds, background noise, or device characteristics.
        </GuideItem>
        <GuideItem icon={<TrendIcon />} title="What the score means">
          Scores rank how strongly this recording matches patterns learned by the model. They are uncalibrated outputs, not guaranteed probabilities.
        </GuideItem>
        <GuideItem icon={<AlertTriangle />} title="What it cannot mean" tone="warning">
          <ul>
            <li>It does not diagnose or rule out disease.</li>
            <li>It does not measure severity.</li>
            <li>It cannot replace clinical context, imaging, laboratory tests, or expert review.</li>
            <li>It may be wrong on unfamiliar sounds, devices, or populations.</li>
          </ul>
        </GuideItem>
        <div className="source-limitations">
          <Info aria-hidden="true" />
          <div>
            <h3>Source & limitations</h3>
            <p>Project model trained on ICBHI-derived data. The disease-label split is highly imbalanced and differs from the original event-classification challenge.</p>
            <a href="/evidence#dataset">View evidence and limitations <ArrowRight size={15} /></a>
          </div>
        </div>
      </aside>
    </div>
  );
}

function GuideItem({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <section className={`guide-item${tone ? ` guide-${tone}` : ""}`}>
      <span className="guide-icon">{icon}</span>
      <div><h2>{title}</h2><div className="guide-copy">{children}</div></div>
    </section>
  );
}

function EyeIcon() {
  return <Eye aria-hidden="true" />;
}

function TrendIcon() {
  return <ChartNoAxesCombined aria-hidden="true" />;
}

function BookOpenNote() {
  return <FileText aria-hidden="true" />;
}
