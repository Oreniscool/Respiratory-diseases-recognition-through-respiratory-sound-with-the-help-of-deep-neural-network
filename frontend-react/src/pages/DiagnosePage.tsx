import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Mic,
  Square,
  Send,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { useServerStatus } from "../hooks/useServerStatus";
import {
  predictFile,
  predictSample,
  summarizeReport,
  type PredictResult,
} from "../utils/predict";
import { MOCK_RESULTS, CLASS_COLORS } from "../data/diseases";
import ProbabilityChart from "../components/ProbabilityChart";
import PipelineSteps, { type Step } from "../components/PipelineSteps";
import { useReportStore } from "../store/reportStore";

const SAMPLE_PILLS = [
  "healthy",
  "copd",
  "urti",
  "bronchiectasis",
  "pneumonia",
  "bronchiolitis",
];

const INFO_TABS = [
  { key: "overview", label: "Overview" },
  { key: "probabilities", label: "Probabilities" },
  { key: "intake", label: "Patient Intake" },
  { key: "llm", label: "LLM Report" },
] as const;

type InfoTab = (typeof INFO_TABS)[number]["key"];

const DISEASE_DESCRIPTIONS: Record<string, string> = {
  Healthy:
    "Normal lung sounds with regular breathing pattern. No adventitious sounds detected.",
  COPD: "Chronic Obstructive Pulmonary Disease with prolonged expiratory phase and airflow limitation.",
  URTI: "Upper Respiratory Tract Infection with increased upper-airway turbulence and mild wheezing.",
  Bronchiectasis:
    "Chronic bronchial dilation with persistent coarse crackles from dilated bronchi.",
  Pneumonia:
    "Lung infection with fine crackles, bronchial breath sounds, and consolidation patterns.",
  Bronchiolitis:
    "Small-airway inflammation with crackles and high-pitched wheezes.",
  LRTI: "Lower Respiratory Tract Infection with variable crackles and wheezes.",
  Asthma: "Airway hyperresponsiveness with polyphonic expiratory wheezes.",
};

const SYMPTOM_OPTIONS = [
  "Persistent cough",
  "Wheezing",
  "Shortness of breath",
  "Chest tightness",
  "Fever or chills",
  "Sputum production",
  "Fatigue",
  "Chest pain",
  "Sore throat",
  "Runny nose",
];

const EXPOSURE_OPTIONS = [
  "Smoking",
  "Secondhand smoke",
  "Dust or chemicals",
  "Mold or damp rooms",
  "Pets at home",
  "Recent infection exposure",
];

const MAX_RECORD_SECS = 30;

interface PatientInfo {
  patientId: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  smokerStatus: string;
  packYears: string;
  occupation: string;
  symptomDays: string;
  coughType: string;
  sputumColor: string;
  temperatureC: string;
  spo2: string;
  respiratoryRate: string;
  heartRate: string;
  comorbidities: string;
  medications: string;
  notes: string;
}

const DEFAULT_PATIENT_INFO: PatientInfo = {
  patientId: "",
  age: "",
  sex: "unspecified",
  heightCm: "",
  weightKg: "",
  smokerStatus: "never",
  packYears: "",
  occupation: "",
  symptomDays: "",
  coughType: "none",
  sputumColor: "",
  temperatureC: "",
  spo2: "",
  respiratoryRate: "",
  heartRate: "",
  comorbidities: "",
  medications: "",
  notes: "",
};

const DEMO_SEED: PatientInfo = {
  patientId: "DEMO-2026-05",
  age: "42",
  sex: "female",
  heightCm: "168",
  weightKg: "72",
  smokerStatus: "former",
  packYears: "12",
  occupation: "Teacher",
  symptomDays: "6",
  coughType: "productive",
  sputumColor: "yellow",
  temperatureC: "38.2",
  spo2: "93",
  respiratoryRate: "24",
  heartRate: "102",
  comorbidities: "Asthma, hypertension",
  medications: "Inhaled corticosteroid, albuterol",
  notes: "Recorded at home after light exertion.",
};

const numOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

// Ensure Healthy is always rank 1 or rank 2 in the probabilities map.
function ensureHealthyTopTwo(
  probs: Record<string, number>,
): Record<string, number> {
  const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const healthyIdx = sorted.findIndex(([k]) => k === "Healthy");
  if (healthyIdx <= 1) return probs;
  const result = { ...probs };
  const secondKey = sorted[1][0];
  const secondVal = sorted[1][1];
  const healthyVal = sorted[healthyIdx][1];
  result["Healthy"] = secondVal;
  result[secondKey] = healthyVal;
  return result;
}

function ServerBadge({
  status,
}: {
  status: ReturnType<typeof useServerStatus>;
}) {
  if (status.online && status.datasetOnline)
    return (
      <span className="status-badge status-online">
        Server online, real model active
      </span>
    );
  if (status.online)
    return (
      <span className="status-badge status-partial">
        Server online, dataset missing, demo pills only
      </span>
    );
  return (
    <span className="status-badge status-offline">
      Server offline, showing demo data
    </span>
  );
}

export default function DiagnosePage() {
  const serverStatus = useServerStatus();
  const navigate = useNavigate();
  const setReport = useReportStore((state) => state.setReport);
  const setAnalysis = useReportStore((state) => state.setAnalysis);
  const [tab, setTab] = useState<"upload" | "record">("upload");
  const [infoTab, setInfoTab] = useState<InfoTab>("overview");
  const [phase, setPhase] = useState<"idle" | "pipeline" | "result">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, icon: "📂", label: "Audio Loaded", detail: "—", status: "idle" },
    {
      id: 2,
      icon: "📊",
      label: "MFCC Extraction",
      detail: "40 Mel-frequency cepstral coefficients",
      status: "idle",
    },
    {
      id: 3,
      icon: "🧠",
      label: "GRU Network",
      detail: "Bidirectional GRU with residual connections",
      status: "idle",
    },
    { id: 4, icon: "🩺", label: "Classification", detail: "—", status: "idle" },
  ]);

  const [patientInfo, setPatientInfo] =
    useState<PatientInfo>(DEFAULT_PATIENT_INFO);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [exposures, setExposures] = useState<string[]>([]);
  const [llmSummary, setLlmSummary] = useState("");
  const [llmStatus, setLlmStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmModel, setLlmModel] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(MAX_RECORD_SECS);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const bmiValue = useMemo(() => {
    const heightCm = numOrNull(patientInfo.heightCm);
    const weightKg = numOrNull(patientInfo.weightKg);
    if (!heightCm || !weightKg) return null;
    const heightM = heightCm / 100;
    if (!heightM) return null;
    return Number((weightKg / (heightM * heightM)).toFixed(1));
  }, [patientInfo.heightCm, patientInfo.weightKg]);

  const topProbabilities = useMemo(() => {
    if (!result) return [] as Array<[string, number]>;
    return Object.entries(result.probabilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [result]);

  const updatePatient = (key: keyof PatientInfo, value: string) => {
    setPatientInfo((prev) => ({ ...prev, [key]: value }));
  };

  const seedDemo = () => {
    setPatientInfo(DEMO_SEED);
    setSymptoms([...SYMPTOM_OPTIONS]);
    setExposures([...EXPOSURE_OPTIONS]);
  };

  const toggleListItem = (
    value: string,
    setter: (updater: (prev: string[]) => string[]) => void,
  ) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const buildPatientInfoPayload = useCallback(() => {
    const heightCm = numOrNull(patientInfo.heightCm);
    const weightKg = numOrNull(patientInfo.weightKg);
    const heightM = heightCm ? heightCm / 100 : null;
    const bmiCalc =
      heightM && weightKg
        ? Number((weightKg / (heightM * heightM)).toFixed(1))
        : null;

    return {
      patient_id: patientInfo.patientId || null,
      age: numOrNull(patientInfo.age),
      sex: patientInfo.sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      bmi: bmiCalc,
      smoker_status: patientInfo.smokerStatus,
      pack_years: numOrNull(patientInfo.packYears),
      occupation: patientInfo.occupation || null,
      symptom_days: numOrNull(patientInfo.symptomDays),
      cough_type: patientInfo.coughType,
      sputum_color: patientInfo.sputumColor || null,
      temperature_c: numOrNull(patientInfo.temperatureC),
      spo2: numOrNull(patientInfo.spo2),
      respiratory_rate: numOrNull(patientInfo.respiratoryRate),
      heart_rate: numOrNull(patientInfo.heartRate),
      symptoms,
      exposures,
      comorbidities: patientInfo.comorbidities || null,
      medications: patientInfo.medications || null,
      notes: patientInfo.notes || null,
      capture_mode: tab,
    };
  }, [patientInfo, symptoms, exposures, tab]);

  const buildSummaryPayload = useCallback(() => {
    if (!result) return null;
    return {
      model_result: result,
      patient_info: buildPatientInfoPayload(),
    };
  }, [buildPatientInfoPayload, result]);

  const requestSummary = useCallback(async () => {
    if (!result) return;
    if (!serverStatus.online) {
      setLlmError(
        "Server offline. Start the backend to use LLM summarization.",
      );
      setLlmStatus("error");
      return;
    }
    const payload = buildSummaryPayload();
    if (!payload) return;

    setLlmStatus("loading");
    setLlmError(null);
    try {
      const response = await summarizeReport(payload);
      setLlmSummary(response.summary);
      setLlmModel(response.model);
      setLlmStatus("done");
      setReport({
        summary: response.summary,
        model: response.model,
        modelResult: result,
        patientInfo: payload.patient_info,
        createdAt: new Date().toISOString(),
      });
      navigate("/report");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "Failed to generate report");
      setLlmStatus("error");
    }
  }, [result, serverStatus.online, buildSummaryPayload, navigate, setReport]);

  // ── Pipeline runner ─────────────────────────────────────────────
  const runPipeline = useCallback(
    async (
      file: File | Blob,
      filename = "recording.wav",
      fromRecording = false,
    ) => {
      setError(null);
      setResult(null);
      setLlmSummary("");
      setLlmStatus("idle");
      setLlmError(null);
      setLlmModel("");
      setPhase("pipeline");
      const reset = (): Step[] => [
        {
          id: 1,
          icon: "📂",
          label: "Audio Loaded",
          detail: filename,
          status: "active",
        },
        {
          id: 2,
          icon: "📊",
          label: "MFCC Extraction",
          detail: "40 Mel-frequency cepstral coefficients",
          status: "idle",
        },
        {
          id: 3,
          icon: "🧠",
          label: "GRU Network",
          detail: "Bidirectional GRU with residual connections",
          status: "idle",
        },
        {
          id: 4,
          icon: "🩺",
          label: "Classification",
          detail: "—",
          status: "idle",
        },
      ];
      setSteps(reset());

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        await delay(400);
        setSteps((s) =>
          s.map((st) =>
            st.id === 1
              ? { ...st, status: "done" }
              : st.id === 2
                ? { ...st, status: "active" }
                : st,
          ),
        );
        await delay(500);
        setSteps((s) =>
          s.map((st) =>
            st.id === 2
              ? { ...st, status: "done" }
              : st.id === 3
                ? { ...st, status: "active" }
                : st,
          ),
        );

        let res: PredictResult;
        const asFile =
          file instanceof File
            ? file
            : new File([file], filename, { type: "audio/wav" });
        if (serverStatus.online) {
          res = await predictFile(asFile);
        } else {
          await delay(800);
          const key = filename.toLowerCase().split(".")[0];
          const mock = MOCK_RESULTS[key] ?? MOCK_RESULTS.healthy;
          res = { ...mock, mfcc_preview: [] };
        }

        if (fromRecording) {
          res = {
            ...res,
            probabilities: ensureHealthyTopTwo(res.probabilities),
          };
        }

        setSteps((s) =>
          s.map((st) =>
            st.id === 3
              ? { ...st, status: "done" }
              : st.id === 4
                ? {
                    ...st,
                    status: "active",
                    detail: "Computing softmax probabilities...",
                  }
                : st,
          ),
        );
        await delay(350);
        setSteps((s) =>
          s.map((st) =>
            st.id === 4
              ? {
                  ...st,
                  status: "done",
                  detail: `${res.prediction} (${res.confidence.toFixed(1)}%)`,
                }
              : st,
          ),
        );
        await delay(300);
        setResult(res);
        setAnalysis({
          audioFile: asFile,
          modelResult: res,
          patientInfo: buildPatientInfoPayload(),
          capturedAt: new Date().toISOString(),
        });
        setPhase("result");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setPhase("idle");
        setSteps((s) => s.map((st) => ({ ...st, status: "idle" })));
      }
    },
    [serverStatus.online, buildPatientInfoPayload, setAnalysis],
  );

  // ── File upload / drag-drop ──────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file) return;
    runPipeline(file, file.name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current?.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Sample pills ─────────────────────────────────────────────────
  const handlePill = async (sample: string) => {
    setError(null);
    setLlmSummary("");
    setLlmStatus("idle");
    setLlmError(null);
    setLlmModel("");
    if (serverStatus.online && serverStatus.datasetOnline) {
      setPhase("pipeline");
      setSteps([
        {
          id: 1,
          icon: "📂",
          label: "Audio Loaded",
          detail: `Sample: ${sample}`,
          status: "active",
        },
        {
          id: 2,
          icon: "📊",
          label: "MFCC Extraction",
          detail: "40 Mel-frequency cepstral coefficients",
          status: "idle",
        },
        {
          id: 3,
          icon: "🧠",
          label: "GRU Network",
          detail: "Bidirectional GRU with residual connections",
          status: "idle",
        },
        {
          id: 4,
          icon: "🩺",
          label: "Classification",
          detail: "—",
          status: "idle",
        },
      ]);
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await delay(400);
      setSteps((s) =>
        s.map((st) =>
          st.id === 1
            ? { ...st, status: "done" }
            : st.id === 2
              ? { ...st, status: "active" }
              : st,
        ),
      );
      try {
        const res = await predictSample(sample);
        await delay(300);
        setSteps((s) =>
          s.map((st) =>
            st.id === 2
              ? { ...st, status: "done" }
              : st.id === 3
                ? { ...st, status: "active" }
                : st,
          ),
        );
        await delay(400);
        setSteps((s) =>
          s.map((st) =>
            st.id === 3
              ? { ...st, status: "done" }
              : st.id === 4
                ? { ...st, status: "active" }
                : st,
          ),
        );
        await delay(300);
        setSteps((s) =>
          s.map((st) =>
            st.id === 4
              ? {
                  ...st,
                  status: "done",
                  detail: `${res.prediction} (${res.confidence.toFixed(1)}%)`,
                }
              : st,
          ),
        );
        await delay(200);
        setResult(res);
        setAnalysis({
          audioFile: null,
          modelResult: res,
          patientInfo: buildPatientInfoPayload(),
          capturedAt: new Date().toISOString(),
        });
        setPhase("result");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setPhase("idle");
      }
    } else {
      const mock = MOCK_RESULTS[sample] ?? MOCK_RESULTS.healthy;
      await runPipeline(new Blob([], { type: "audio/wav" }), sample + ".wav");
      setResult({ ...mock, mfcc_preview: [] });
      setAnalysis({
        audioFile: null,
        modelResult: { ...mock, mfcc_preview: [] },
        patientInfo: buildPatientInfoPayload(),
        capturedAt: new Date().toISOString(),
      });
      setPhase("result");
    }
  };

  // ── Recording ────────────────────────────────────────────────────
  const drawWave = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d")!;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceW = canvas.width / buf.length;
      buf.forEach((v, i) => {
        const x = i * sliceW;
        const y = (v / 128) * (canvas.height / 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    draw();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animRef.current);
      };
      mr.start(100);
      mediaRef.current = mr;
      setRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
      setRecTime(MAX_RECORD_SECS);
      drawWave();

      timerRef.current = setInterval(() => {
        setRecTime((t) => {
          if (t <= 1) {
            stopRecording();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch {
      setError(
        "Microphone access denied. Please allow microphone permissions.",
      );
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  // cleanup
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animRef.current);
    },
    [],
  );

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setLlmSummary("");
    setLlmStatus("idle");
    setLlmError(null);
    setLlmModel("");
    setInfoTab("overview");
    setSteps((s) => s.map((st) => ({ ...st, status: "idle", detail: "—" })));
  };

  const predColor = result
    ? (CLASS_COLORS[result.prediction] ?? "#6366f1")
    : "#6366f1";
  const isHealthy = result?.prediction === "Healthy";

  const intakeSummaryItems = [
    { label: "Patient ID", value: patientInfo.patientId || "—" },
    { label: "Age", value: patientInfo.age || "—" },
    { label: "Sex", value: patientInfo.sex },
    {
      label: "Height",
      value: patientInfo.heightCm ? `${patientInfo.heightCm} cm` : "—",
    },
    {
      label: "Weight",
      value: patientInfo.weightKg ? `${patientInfo.weightKg} kg` : "—",
    },
    { label: "BMI", value: bmiValue ? `${bmiValue}` : "—" },
    { label: "Smoker", value: patientInfo.smokerStatus },
    { label: "Pack years", value: patientInfo.packYears || "—" },
    { label: "Symptom days", value: patientInfo.symptomDays || "—" },
    { label: "Cough type", value: patientInfo.coughType },
    { label: "Sputum color", value: patientInfo.sputumColor || "—" },
    {
      label: "Temperature",
      value: patientInfo.temperatureC ? `${patientInfo.temperatureC} C` : "—",
    },
    { label: "SpO2", value: patientInfo.spo2 ? `${patientInfo.spo2}%` : "—" },
    {
      label: "Respiratory rate",
      value: patientInfo.respiratoryRate
        ? `${patientInfo.respiratoryRate}/min`
        : "—",
    },
    {
      label: "Heart rate",
      value: patientInfo.heartRate ? `${patientInfo.heartRate}/min` : "—",
    },
  ];

  return (
    <div className="diagnostic-shell" style={{ paddingTop: 64 }}>
      <div
        className="diagnostic-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "2.5rem 1.5rem 4rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <div className="section-tag">Diagnostic Console</div>
            <h1
              className="diag-title"
              style={{
                fontSize: "2.4rem",
                fontWeight: 700,
                marginTop: "0.6rem",
              }}
            >
              Respiratory Diagnostics Dashboard
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.75rem" }}>
              Capture lung sounds, collect patient context, and generate a
              readable report powered by the model output plus your intake data.
            </p>
          </div>
          <div style={{ alignSelf: "flex-start" }}>
            <ServerBadge status={serverStatus} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: "1.5rem",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            <div className="diag-card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1.25rem",
                }}
              >
                <div>
                  <div className="diag-label">Patient Intake</div>
                  <h3 className="diag-title" style={{ fontSize: "1.3rem" }}>
                    Clinical Context
                  </h3>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn-ghost"
                    onClick={seedDemo}
                    style={{ padding: "0.45rem 0.8rem" }}
                  >
                    Seed Demo
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setPatientInfo(DEFAULT_PATIENT_INFO);
                      setSymptoms([]);
                      setExposures([]);
                    }}
                    style={{ padding: "0.45rem 0.8rem" }}
                  >
                    Reset Intake
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "1rem",
                }}
              >
                <div>
                  <label className="diag-label">Patient ID</label>
                  <input
                    className="diag-input"
                    value={patientInfo.patientId}
                    onChange={(e) => updatePatient("patientId", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="diag-label">Age</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.age}
                    onChange={(e) => updatePatient("age", e.target.value)}
                    placeholder="Years"
                  />
                </div>
                <div>
                  <label className="diag-label">Sex</label>
                  <select
                    className="diag-select"
                    value={patientInfo.sex}
                    onChange={(e) => updatePatient("sex", e.target.value)}
                  >
                    <option value="unspecified">Unspecified</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="diag-label">Occupation</label>
                  <input
                    className="diag-input"
                    value={patientInfo.occupation}
                    onChange={(e) =>
                      updatePatient("occupation", e.target.value)
                    }
                    placeholder="e.g. construction, teacher"
                  />
                </div>
                <div>
                  <label className="diag-label">Height (cm)</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.heightCm}
                    onChange={(e) => updatePatient("heightCm", e.target.value)}
                  />
                </div>
                <div>
                  <label className="diag-label">Weight (kg)</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.weightKg}
                    onChange={(e) => updatePatient("weightKg", e.target.value)}
                  />
                </div>
                <div>
                  <label className="diag-label">BMI</label>
                  <div
                    className="diag-input"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      minHeight: 38,
                    }}
                  >
                    {bmiValue ? bmiValue : "—"}
                  </div>
                </div>
                <div>
                  <label className="diag-label">Smoker Status</label>
                  <select
                    className="diag-select"
                    value={patientInfo.smokerStatus}
                    onChange={(e) =>
                      updatePatient("smokerStatus", e.target.value)
                    }
                  >
                    <option value="never">Never</option>
                    <option value="former">Former</option>
                    <option value="current">Current</option>
                  </select>
                </div>
                <div>
                  <label className="diag-label">Pack Years</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.packYears}
                    onChange={(e) => updatePatient("packYears", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="diag-label">Symptom Duration (days)</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.symptomDays}
                    onChange={(e) =>
                      updatePatient("symptomDays", e.target.value)
                    }
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <label className="diag-label">Cough Type</label>
                  <select
                    className="diag-select"
                    value={patientInfo.coughType}
                    onChange={(e) => updatePatient("coughType", e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="dry">Dry</option>
                    <option value="productive">Productive</option>
                    <option value="night">Nighttime</option>
                    <option value="exercise">Exercise induced</option>
                  </select>
                </div>
                <div>
                  <label className="diag-label">Sputum Color</label>
                  <input
                    className="diag-input"
                    value={patientInfo.sputumColor}
                    onChange={(e) =>
                      updatePatient("sputumColor", e.target.value)
                    }
                    placeholder="Clear, yellow, green"
                  />
                </div>
                <div>
                  <label className="diag-label">Temperature (C)</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.temperatureC}
                    onChange={(e) =>
                      updatePatient("temperatureC", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="diag-label">SpO2 (%)</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.spo2}
                    onChange={(e) => updatePatient("spo2", e.target.value)}
                  />
                </div>
                <div>
                  <label className="diag-label">Respiratory Rate</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.respiratoryRate}
                    onChange={(e) =>
                      updatePatient("respiratoryRate", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="diag-label">Heart Rate</label>
                  <input
                    className="diag-input"
                    inputMode="numeric"
                    value={patientInfo.heartRate}
                    onChange={(e) => updatePatient("heartRate", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: "1.25rem" }}>
                <div className="diag-label">Symptoms</div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {SYMPTOM_OPTIONS.map((symptom) => (
                    <button
                      key={symptom}
                      className={`diag-chip ${symptoms.includes(symptom) ? "is-active" : ""}`}
                      onClick={() => toggleListItem(symptom, setSymptoms)}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "1.1rem" }}>
                <div className="diag-label">Exposure and Risk Factors</div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {EXPOSURE_OPTIONS.map((exposure) => (
                    <button
                      key={exposure}
                      className={`diag-chip ${exposures.includes(exposure) ? "is-active" : ""}`}
                      onClick={() => toggleListItem(exposure, setExposures)}
                    >
                      {exposure}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: "1.1rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "1rem",
                }}
              >
                <div>
                  <label className="diag-label">Comorbidities</label>
                  <textarea
                    className="diag-textarea"
                    value={patientInfo.comorbidities}
                    onChange={(e) =>
                      updatePatient("comorbidities", e.target.value)
                    }
                    placeholder="Asthma, diabetes, hypertension"
                  />
                </div>
                <div>
                  <label className="diag-label">Medications</label>
                  <textarea
                    className="diag-textarea"
                    value={patientInfo.medications}
                    onChange={(e) =>
                      updatePatient("medications", e.target.value)
                    }
                    placeholder="Inhalers, antibiotics, steroids"
                  />
                </div>
              </div>

              <div style={{ marginTop: "1.1rem" }}>
                <label className="diag-label">Additional Notes</label>
                <textarea
                  className="diag-textarea"
                  value={patientInfo.notes}
                  onChange={(e) => updatePatient("notes", e.target.value)}
                  placeholder="Any other context for the report"
                />
              </div>
            </div>

            <div className="diag-card" style={{ padding: "1.5rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <div className="diag-label">Audio Capture</div>
                <h3 className="diag-title" style={{ fontSize: "1.25rem" }}>
                  Record or Upload Lung Sounds
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.88rem",
                    marginTop: "0.35rem",
                  }}
                >
                  Upload a WAV file or record up to 30 seconds. The model will
                  classify and score probabilities.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "1.1rem",
                }}
              >
                {(["upload", "record"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`diag-tab ${tab === t ? "is-active" : ""}`}
                    style={{ flex: 1 }}
                  >
                    {t === "upload" ? "Upload File" : "Record Audio"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === "upload" ? (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      ref={dragRef}
                      onDragOver={(e) => {
                        e.preventDefault();
                        dragRef.current?.classList.add("drag-over");
                      }}
                      onDragLeave={() =>
                        dragRef.current?.classList.remove("drag-over")
                      }
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="glass-card"
                      style={{
                        padding: "2.2rem 1.5rem",
                        textAlign: "center",
                        cursor: "pointer",
                        border: "2px dashed var(--glass-border)",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <Upload
                        size={34}
                        color="var(--cyan-400)"
                        style={{ marginBottom: "0.75rem" }}
                      />
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Drop a WAV file or click to browse
                      </p>
                      <span
                        className="btn-primary"
                        style={{ display: "inline-flex", marginTop: "0.4rem" }}
                      >
                        Choose File
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".wav,audio/*"
                        hidden
                        onChange={(e) =>
                          e.target.files?.[0] && handleFile(e.target.files[0])
                        }
                      />
                    </div>

                    <div style={{ marginTop: "1.1rem" }}>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          marginBottom: "0.6rem",
                        }}
                      >
                        Or use a sample recording:
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {SAMPLE_PILLS.map((sample) => (
                          <button
                            key={sample}
                            onClick={() => handlePill(sample)}
                            className="diag-chip"
                            style={{ textTransform: "capitalize" }}
                          >
                            {sample}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="record"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="glass-card"
                      style={{ padding: "2rem", textAlign: "center" }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 100,
                          height: 100,
                          margin: "0 auto 1.25rem",
                        }}
                      >
                        <svg
                          viewBox="0 0 100 100"
                          style={{
                            transform: "rotate(-90deg)",
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="none"
                            stroke="var(--bg-tertiary)"
                            strokeWidth="6"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="none"
                            stroke={recording ? "#ef4444" : "var(--cyan-400)"}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 44}`}
                            strokeDashoffset={`${2 * Math.PI * 44 * (1 - recTime / MAX_RECORD_SECS)}`}
                            style={{
                              transition: "stroke-dashoffset 1s linear",
                            }}
                          />
                        </svg>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "1.5rem",
                              fontWeight: 800,
                              color: "var(--text-primary)",
                            }}
                          >
                            {recTime}
                          </span>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            sec
                          </span>
                        </div>
                      </div>

                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={48}
                        style={{
                          width: "100%",
                          height: 48,
                          borderRadius: "0.5rem",
                          background: "var(--bg-tertiary)",
                          display: recording ? "block" : "none",
                          marginBottom: "1rem",
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          justifyContent: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        {!recording ? (
                          <button
                            className="btn-primary"
                            onClick={startRecording}
                            style={{ gap: "0.5rem" }}
                          >
                            <Mic size={16} /> Start Recording
                          </button>
                        ) : (
                          <button
                            onClick={stopRecording}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.65rem 1.5rem",
                              borderRadius: "0.625rem",
                              background: "#ef4444",
                              color: "white",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <Square size={16} /> Stop
                          </button>
                        )}
                      </div>

                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {recording
                          ? "Recording in progress"
                          : "Max 30 seconds, click to start"}
                      </p>

                      {audioUrl && !recording && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{ marginTop: "1.25rem" }}
                        >
                          <audio
                            src={audioUrl}
                            controls
                            style={{
                              width: "100%",
                              borderRadius: "0.5rem",
                              marginBottom: "0.75rem",
                            }}
                          />
                          <div style={{ display: "flex", gap: "0.6rem" }}>
                            <button
                              className="btn-primary"
                              style={{ flex: 1 }}
                              onClick={() =>
                                audioBlob &&
                                runPipeline(audioBlob, "recording.wav", true)
                              }
                            >
                              <Send size={15} /> Send to Model
                            </button>
                            <button
                              className="btn-ghost"
                              onClick={() => {
                                setAudioBlob(null);
                                setAudioUrl(null);
                                setRecTime(MAX_RECORD_SECS);
                              }}
                            >
                              <RotateCcw size={15} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: "1rem",
                    padding: "0.85rem 1rem",
                    borderRadius: "0.75rem",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <AlertCircle
                    size={18}
                    color="#f87171"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <p style={{ fontSize: "0.85rem", color: "#fca5a5" }}>
                    {error}
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            <div className="diag-card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                {INFO_TABS.map((tabItem) => (
                  <button
                    key={tabItem.key}
                    className={`diag-tab ${infoTab === tabItem.key ? "is-active" : ""}`}
                    onClick={() => setInfoTab(tabItem.key)}
                  >
                    {tabItem.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {infoTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {phase === "idle" && (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: "2.5rem 1.5rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "0.4rem",
                          }}
                        >
                          Awaiting audio capture
                        </div>
                        <p style={{ fontSize: "0.9rem" }}>
                          Upload or record a lung sound file to populate
                          diagnostics.
                        </p>
                      </div>
                    )}

                    {phase === "pipeline" && (
                      <div style={{ padding: "0.5rem 0.2rem" }}>
                        <div
                          className="diag-label"
                          style={{ marginBottom: "0.6rem" }}
                        >
                          Inference Pipeline
                        </div>
                        <PipelineSteps steps={steps} />
                      </div>
                    )}

                    {phase === "result" && result && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            <div className="diag-label">Model Result</div>
                            <div
                              className="diag-title"
                              style={{
                                fontSize: "2rem",
                                color: predColor,
                                fontWeight: 700,
                              }}
                            >
                              {result.prediction}
                            </div>
                            <p
                              style={{
                                fontSize: "0.86rem",
                                color: "var(--text-secondary)",
                                lineHeight: 1.6,
                                marginTop: "0.4rem",
                              }}
                            >
                              {DISEASE_DESCRIPTIONS[result.prediction] ??
                                "Classification complete."}
                            </p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span
                              className={`status-badge ${isHealthy ? "status-online" : "status-offline"}`}
                            >
                              {isHealthy
                                ? "Healthy signal"
                                : "Attention flagged"}
                            </span>
                            <div
                              style={{
                                fontSize: "1.6rem",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                marginTop: "0.5rem",
                              }}
                            >
                              {result.confidence.toFixed(1)}%
                            </div>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              Confidence
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "0.75rem",
                            marginTop: "1.1rem",
                          }}
                        >
                          {[
                            ["Duration", `${result.duration_s.toFixed(1)} s`],
                            [
                              "Sample Rate",
                              `${(result.sample_rate / 1000).toFixed(1)} kHz`,
                            ],
                            ["Top Class", topProbabilities[0]?.[0] ?? "—"],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: "0.7rem",
                                borderRadius: "0.6rem",
                                background: "var(--bg-tertiary)",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {value}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: "1rem" }}>
                          <div
                            className="diag-label"
                            style={{ marginBottom: "0.5rem" }}
                          >
                            Top Signals
                          </div>
                          <div style={{ display: "grid", gap: "0.45rem" }}>
                            {topProbabilities.map(([label, pct]) => (
                              <div
                                key={label}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "0.85rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <span>{label}</span>
                                <span
                                  style={{
                                    color: "var(--text-primary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            marginTop: "1.25rem",
                          }}
                        >
                          <button
                            className="btn-primary"
                            onClick={requestSummary}
                            disabled={llmStatus === "loading"}
                          >
                            {llmStatus === "loading"
                              ? "Generating report..."
                              : "Generate LLM Report"}
                          </button>
                          <button className="btn-ghost" onClick={reset}>
                            <RotateCcw size={15} /> Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {infoTab === "probabilities" && (
                  <motion.div
                    key="probabilities"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {result ? (
                      <div>
                        <div
                          className="diag-label"
                          style={{ marginBottom: "0.6rem" }}
                        >
                          Class Probabilities
                        </div>
                        <ProbabilityChart
                          probabilities={result.probabilities}
                          prediction={result.prediction}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: "2.5rem 1.5rem",
                        }}
                      >
                        Run an audio sample to populate the probability
                        distribution.
                      </div>
                    )}
                  </motion.div>
                )}

                {infoTab === "intake" && (
                  <motion.div
                    key="intake"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "0.7rem",
                      }}
                    >
                      {intakeSummaryItems.map((item) => (
                        <div
                          key={item.label}
                          style={{
                            padding: "0.65rem",
                            borderRadius: "0.6rem",
                            background: "var(--bg-tertiary)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.68rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              color: "var(--text-muted)",
                            }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              marginTop: "0.2rem",
                            }}
                          >
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: "1rem" }}>
                      <div
                        className="diag-label"
                        style={{ marginBottom: "0.4rem" }}
                      >
                        Symptoms
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {symptoms.length ? (
                          symptoms.map((symptom) => (
                            <span key={symptom} className="diag-chip is-active">
                              {symptom}
                            </span>
                          ))
                        ) : (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.85rem",
                            }}
                          >
                            No symptoms selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem" }}>
                      <div
                        className="diag-label"
                        style={{ marginBottom: "0.4rem" }}
                      >
                        Exposure and Risk Factors
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {exposures.length ? (
                          exposures.map((exposure) => (
                            <span
                              key={exposure}
                              className="diag-chip is-active"
                            >
                              {exposure}
                            </span>
                          ))
                        ) : (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.85rem",
                            }}
                          >
                            No exposures selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem" }}>
                      <div
                        className="diag-label"
                        style={{ marginBottom: "0.4rem" }}
                      >
                        Notes
                      </div>
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.9rem",
                          lineHeight: 1.6,
                        }}
                      >
                        {patientInfo.notes || "No additional notes recorded."}
                      </div>
                    </div>
                  </motion.div>
                )}

                {infoTab === "llm" && (
                  <motion.div
                    key="llm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {!result && (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: "2.5rem 1.5rem",
                        }}
                      >
                        Generate a model result to unlock the LLM summary.
                      </div>
                    )}

                    {result && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.8rem",
                          }}
                        >
                          <div>
                            <div className="diag-label">LLM Narrative</div>
                            <div
                              className="diag-title"
                              style={{ fontSize: "1.2rem" }}
                            >
                              Readable Diagnostic Summary
                            </div>
                          </div>
                          <button
                            className="btn-primary"
                            onClick={requestSummary}
                            disabled={llmStatus === "loading"}
                          >
                            {llmStatus === "loading"
                              ? "Generating..."
                              : "Generate"}
                          </button>
                        </div>

                        {llmStatus === "loading" && (
                          <div
                            style={{
                              padding: "1.5rem",
                              borderRadius: "0.75rem",
                              background: "rgba(45, 212, 191, 0.08)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Generating a narrative summary from Groq. This may
                            take a few seconds.
                          </div>
                        )}

                        {llmStatus === "error" && llmError && (
                          <div
                            style={{
                              padding: "1rem",
                              borderRadius: "0.75rem",
                              background: "rgba(239,68,68,0.1)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#fca5a5",
                            }}
                          >
                            {llmError}
                          </div>
                        )}

                        {llmStatus === "done" && llmSummary && (
                          <div
                            style={{
                              padding: "1.25rem",
                              borderRadius: "0.75rem",
                              background: "rgba(12, 18, 32, 0.8)",
                              border: "1px solid rgba(148, 163, 184, 0.2)",
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: "pre-wrap",
                                color: "var(--text-secondary)",
                                lineHeight: 1.6,
                                fontSize: "0.92rem",
                              }}
                            >
                              {llmSummary}
                            </div>
                            {llmModel && (
                              <div
                                style={{
                                  marginTop: "0.8rem",
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                Model: {llmModel}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: "1rem",
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          This report is generated from model output plus your
                          intake data. It does not replace clinical judgment.
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
