import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CLASS_COLORS } from "../data/diseases";
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

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList(keyBase);
      const level = headingMatch[1].length;
      const content = renderInlineBold(headingMatch[2]);
      const size = level === 1 ? "1.2rem" : level === 2 ? "1.05rem" : "0.95rem";
      blocks.push(
        <div key={`${keyBase}-heading`} style={{ margin: "0.75rem 0 0.4rem" }}>
          <div
            style={{
              fontSize: size,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {content}
          </div>
        </div>,
      );
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

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export default function ReportPage() {
  const navigate = useNavigate();
  const report = useReportStore((state) => state.report);
  const analysis = useReportStore((state) => state.analysis);
  const clearReport = useReportStore((state) => state.clearReport);

  const metaItems = useMemo(() => {
    if (!report) return [];
    const info = report.patientInfo || {};
    const entries: Array<[string, unknown]> = [
      ["Patient ID", info["patient_id"]],
      ["Age", info["age"]],
      ["Sex", info["sex"]],
      ["Occupation", info["occupation"]],
      ["Temperature (C)", info["temperature_c"]],
      ["SpO2 (%)", info["spo2"]],
      ["Respiratory Rate", info["respiratory_rate"]],
      ["Heart Rate", info["heart_rate"]],
      ["Smoker Status", info["smoker_status"]],
      ["Pack Years", info["pack_years"]],
    ];
    return entries.map(([label, value]) => ({
      label,
      value: formatValue(value),
    }));
  }, [report]);

  if (!report) {
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
            <div className="diag-label">No Report</div>
            <h2 className="diag-title" style={{ fontSize: "1.6rem" }}>
              Generate a report first
            </h2>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.6rem" }}>
              Return to diagnostics and run an analysis to create a report.
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

  const predColor = CLASS_COLORS[report.modelResult.prediction] ?? "#6366f1";
  const createdAt = new Date(report.createdAt).toLocaleString();

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
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div className="section-tag">Report</div>
            <h1
              className="diag-title"
              style={{
                fontSize: "2.2rem",
                fontWeight: 700,
                marginTop: "0.5rem",
              }}
            >
              Diagnostic Summary
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.6rem" }}>
              Generated {createdAt} using {report.model}.
            </p>
          </div>
          <div
            style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}
          >
            <button
              className="btn-ghost"
              onClick={() => navigate("/explainability")}
              disabled={!analysis?.audioFile}
            >
              View Explainability
            </button>
            <button className="btn-ghost" onClick={() => navigate("/diagnose")}>
              Back
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                clearReport();
                navigate("/diagnose");
              }}
            >
              Clear Report
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
          <div className="diag-card" style={{ padding: "1.6rem" }}>
            <div className="diag-label">LLM Narrative</div>
            <div className="report-content" style={{ marginTop: "0.6rem" }}>
              {renderRichText(report.summary)}
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">Model Output</div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: predColor,
                }}
              >
                {report.modelResult.prediction}
              </div>
              <div
                style={{ color: "var(--text-secondary)", marginTop: "0.3rem" }}
              >
                Confidence: {report.modelResult.confidence.toFixed(1)}%
              </div>
              <div
                style={{
                  marginTop: "0.6rem",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                }}
              >
                Duration: {report.modelResult.duration_s.toFixed(1)} s
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Sample Rate:{" "}
                {(report.modelResult.sample_rate / 1000).toFixed(1)} kHz
              </div>
            </div>

            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">Patient Snapshot</div>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {metaItems.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.78rem",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="diag-card" style={{ padding: "1.2rem" }}>
              <div className="diag-label">Notes</div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                {formatValue(report.patientInfo?.["notes"])}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
