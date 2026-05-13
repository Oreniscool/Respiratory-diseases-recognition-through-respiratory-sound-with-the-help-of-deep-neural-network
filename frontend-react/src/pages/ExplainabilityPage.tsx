import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  requestExplainability,
  type ExplainabilityResponse,
} from "../utils/predict";
import { useReportStore } from "../store/reportStore";

function renderInlineBold(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <strong
        key={`bold-${match.index}`}
        style={{ color: "var(--text-primary)" }}
      >
        {match[1]}
      </strong>,
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function renderRichText(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyBase: string) => {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul
        key={`${keyBase}-list`}
        style={{ paddingLeft: "1.1rem", marginBottom: "0.6rem" }}
      >
        {items.map((item, idx) => (
          <li key={`${keyBase}-item-${idx}`} style={{ marginBottom: "0.3rem" }}>
            {renderInlineBold(item)}
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const keyBase = `line-${idx}`;

    if (!trimmed) {
      flushList(keyBase);
      blocks.push(<div key={`${keyBase}-spacer`} style={{ height: 8 }} />);
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    const boldHeading = trimmed.match(/^\*\*(.+)\*\*$/);
    if (boldHeading) {
      flushList(keyBase);
      blocks.push(
        <div
          key={`${keyBase}-bold`}
          style={{ margin: "0.7rem 0 0.35rem", fontWeight: 700 }}
        >
          {renderInlineBold(boldHeading[1])}
        </div>,
      );
      return;
    }

    flushList(keyBase);
    blocks.push(
      <p
        key={`${keyBase}-p`}
        style={{ marginBottom: "0.6rem", color: "var(--text-secondary)" }}
      >
        {renderInlineBold(trimmed)}
      </p>,
    );
  });

  flushList("final");
  return blocks;
}

export default function ExplainabilityPage() {
  const navigate = useNavigate();
  const analysis = useReportStore((state) => state.analysis);
  const report = useReportStore((state) => state.report);
  const [includeReason, setIncludeReason] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ExplainabilityResponse | null>(null);

  const summaryMeta = useMemo(() => {
    if (!analysis?.modelResult) return null;
    return {
      prediction: analysis.modelResult.prediction,
      confidence: analysis.modelResult.confidence.toFixed(1),
      duration: analysis.modelResult.duration_s.toFixed(1),
    };
  }, [analysis]);

  const canExplain = !!analysis?.audioFile;

  const generateExplainability = async () => {
    if (!analysis?.audioFile || !analysis.modelResult) return;
    setLoading(true);
    setError(null);
    try {
      const res = await requestExplainability({
        file: analysis.audioFile,
        model_result: analysis.modelResult,
        patient_info: analysis.patientInfo,
        include_reason: includeReason,
        denoise: analysis.modelResult?.noise_cancellation,
      });
      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Explainability failed");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis?.modelResult) {
    return (
      <div className="diagnostic-shell" style={{ paddingTop: 64 }}>
        <div
          className="diagnostic-container"
          style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}
        >
          <div
            className="diag-card"
            style={{ padding: "2rem", textAlign: "center" }}
          >
            <div className="diag-label">No Analysis</div>
            <h2 className="diag-title" style={{ fontSize: "1.6rem" }}>
              Run a diagnostic first
            </h2>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.6rem" }}>
              Explainability requires a recent analysis. Return to diagnostics
              to create one.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: "1.2rem" }}
              onClick={() => navigate("/diagnose")}
            >
              Back to Diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div className="section-tag">Explainability</div>
            <h1
              className="diag-title"
              style={{
                fontSize: "2.2rem",
                fontWeight: 700,
                marginTop: "0.5rem",
              }}
            >
              Reasoning & Visual Evidence
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.6rem" }}>
              Visual overlays highlight time regions that influenced the model.
              This is not a clinical diagnosis.
            </p>
          </div>
          <div
            style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}
          >
            <button
              className="btn-ghost"
              onClick={() => navigate(report ? "/report" : "/diagnose")}
            >
              Back
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
            gap: "1.5rem",
          }}
        >
          <div className="diag-card" style={{ padding: "1.5rem" }}>
            <div className="diag-label">Visual Evidence</div>
            <div style={{ display: "grid", gap: "1rem", marginTop: "0.8rem" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Spectrogram
                </div>
                {response?.spectrogram ? (
                  <img
                    src={response.spectrogram}
                    alt="Spectrogram"
                    className="explain-image"
                  />
                ) : (
                  <div className="explain-placeholder">
                    Generate to view the spectrogram.
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Saliency Overlay
                </div>
                {response?.overlay ? (
                  <img
                    src={response.overlay}
                    alt="Saliency overlay"
                    className="explain-image"
                  />
                ) : (
                  <div className="explain-placeholder">
                    Generate to view the saliency overlay.
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Saliency Heatmap
                </div>
                {response?.saliency ? (
                  <img
                    src={response.saliency}
                    alt="Saliency heatmap"
                    className="explain-image"
                  />
                ) : (
                  <div className="explain-placeholder">
                    Generate to view the heatmap.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">Analysis Snapshot</div>
              {summaryMeta && (
                <div
                  style={{
                    display: "grid",
                    gap: "0.5rem",
                    marginTop: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1.4rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {summaryMeta.prediction}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Confidence: {summaryMeta.confidence}%
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Duration: {summaryMeta.duration} s
                  </div>
                </div>
              )}
            </div>

            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">Explainability Controls</div>
              <div
                style={{ display: "grid", gap: "0.6rem", marginTop: "0.6rem" }}
              >
                <label
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeReason}
                    onChange={(e) => setIncludeReason(e.target.checked)}
                  />
                  Include LLM reasoning
                </label>
                <button
                  className="btn-primary"
                  onClick={generateExplainability}
                  disabled={!canExplain || loading}
                >
                  {loading ? "Generating..." : "Generate Explainability"}
                </button>
                {!canExplain && (
                  <div
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    Explainability requires an uploaded or recorded audio file.
                  </div>
                )}
                {error && (
                  <div style={{ fontSize: "0.78rem", color: "#fca5a5" }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">LLM Reasoning</div>
              {!includeReason && (
                <div
                  style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                >
                  Enable the LLM reasoning toggle to generate a narrative
                  explanation.
                </div>
              )}
              {response?.reasoning_error && (
                <div
                  style={{
                    color: "#fca5a5",
                    fontSize: "0.85rem",
                    marginTop: "0.6rem",
                  }}
                >
                  {response.reasoning_error}
                </div>
              )}
              {response?.reasoning && (
                <div className="report-content" style={{ marginTop: "0.6rem" }}>
                  {renderRichText(response.reasoning)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
