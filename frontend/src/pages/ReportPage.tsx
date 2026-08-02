import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.js";
import CalendarClock from "lucide-react/dist/esm/icons/calendar-clock.js";
import Download from "lucide-react/dist/esm/icons/download.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import Info from "lucide-react/dist/esm/icons/info.js";
import Printer from "lucide-react/dist/esm/icons/printer.js";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useReportStore } from "../store/reportStore";

function safeLabel(label: string) {
  return label.toLowerCase() === "healthy" ? "No adventitious sound pattern" : label;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const report = useReportStore((state) => state.report);

  if (!report) {
    return (
      <div className="empty-page-state">
        <FileText aria-hidden="true" />
        <p className="eyebrow">Research summary</p>
        <h1>No generated summary is available.</h1>
        <p>Run an analysis and explicitly consent to external summary generation before opening this page.</p>
        <button type="button" className="button button-primary" onClick={() => navigate("/analyze")}><ArrowLeft size={17} /> Return to Analyze</button>
      </div>
    );
  }

  const sorted = Object.entries(report.modelResult.probabilities).sort((a, b) => b[1] - a[1]);
  const download = () => {
    const body = [
      "RESPINET RESEARCH SUMMARY",
      "Research prototype — not a diagnostic device",
      "",
      `Generated: ${new Date(report.createdAt).toLocaleString()}`,
      `Top model output: ${safeLabel(report.modelResult.prediction)} (${report.modelResult.confidence.toFixed(1)}%)`,
      `Summary model: ${report.model}`,
      "",
      report.summary,
      "",
      "Model scores are uncalibrated outputs, not proof of disease or guaranteed probabilities of correctness.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `respinet-research-summary-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="editorial-page report-page">
      <header className="report-header">
        <div>
          <p className="eyebrow">Generated research summary</p>
          <h1>Recording evidence, organized for review.</h1>
          <p className="research-warning">Research prototype — not a diagnostic device</p>
        </div>
        <div className="report-header-actions">
          <button type="button" className="button button-secondary" onClick={() => window.print()}><Printer size={17} /> Print</button>
          <button type="button" className="button button-primary" onClick={download}><Download size={17} /> Download text</button>
        </div>
      </header>

      <div className="report-layout">
        <article className="report-document">
          <div className="report-document-meta">
            <span><CalendarClock size={16} /> {new Date(report.createdAt).toLocaleString()}</span>
            <span>Summary model: <strong>{report.model}</strong></span>
          </div>
          <div className="generated-copy">
            {report.summary.split("\n").map((line, index) => line.trim() ? <p key={`${line}-${index}`}>{line}</p> : null)}
          </div>
          <div className="inline-alert alert-warning">
            <Info aria-hidden="true" />
            <div><strong>Generated content can contain errors.</strong><p>This summary reorganizes supplied information. It does not add clinical validation and is not medical advice.</p></div>
          </div>
        </article>

        <aside className="report-evidence">
          <p className="eyebrow">Recorded model output</p>
          <h2>{safeLabel(report.modelResult.prediction)}</h2>
          <strong className="top-score">{report.modelResult.confidence.toFixed(1)}<span>%</span></strong>
          <p>Top uncalibrated model score</p>
          <div className="score-list compact" role="table" aria-label="Model score distribution">
            {sorted.map(([label, value], index) => (
              <div className="score-row" role="row" key={label}>
                <span className="score-rank">{index + 1}</span>
                <span className="score-label" role="rowheader">{safeLabel(label)}</span>
                <span className="score-track"><span style={{ width: `${Math.max(1, value)}%` }} /></span>
                <span className="score-value mono-meta" role="cell">{value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <dl className="result-metadata">
            <div><dt>Duration</dt><dd>{report.modelResult.duration_s.toFixed(1)} s</dd></div>
            <div><dt>Sample rate</dt><dd>{(report.modelResult.sample_rate / 1000).toFixed(1)} kHz</dd></div>
            <div><dt>Denoising</dt><dd>{report.modelResult.noise_cancellation ? "Applied" : "Not applied"}</dd></div>
          </dl>
        </aside>
      </div>

      <div className="page-footer-actions">
        <button type="button" className="button button-secondary" onClick={() => navigate("/analyze")}><ArrowLeft size={17} /> Back to Analyze</button>
      </div>
    </div>
  );
}
