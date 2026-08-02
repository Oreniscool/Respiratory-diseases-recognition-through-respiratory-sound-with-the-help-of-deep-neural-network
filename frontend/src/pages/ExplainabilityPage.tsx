import { useState } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.js";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import Image from "lucide-react/dist/esm/icons/image.js";
import Info from "lucide-react/dist/esm/icons/info.js";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.js";
import { useNavigate } from "react-router-dom";
import { useReportStore } from "../store/reportStore";
import { requestExplainability, type ExplainabilityResponse } from "../utils/predict";

export default function ExplainabilityPage() {
  const navigate = useNavigate();
  const analysis = useReportStore((state) => state.analysis);
  const [result, setResult] = useState<ExplainabilityResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [includeReason, setIncludeReason] = useState(false);
  const [consent, setConsent] = useState(false);

  if (!analysis?.audioFile || !analysis.modelResult) {
    return (
      <div className="empty-page-state">
        <Eye aria-hidden="true" />
        <p className="eyebrow">Experimental attribution</p>
        <h1>An uploaded or recorded analysis is required.</h1>
        <p>Dataset examples are processed remotely and do not expose the source audio needed for this view.</p>
        <button type="button" className="button button-primary" onClick={() => navigate("/analyze")}><ArrowLeft size={17} /> Return to Analyze</button>
      </div>
    );
  }

  const run = async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await requestExplainability({
        file: analysis.audioFile!,
        patient_info: analysis.patientInfo,
        include_reason: includeReason,
        denoise: analysis.modelResult?.noise_cancellation,
        external_llm_consent: includeReason && consent,
      });
      setResult(response);
      setStatus("idle");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Attribution could not be generated.");
    }
  };

  return (
    <div className="editorial-page explain-page">
      <header className="editorial-hero explain-hero">
        <div>
          <p className="eyebrow">Experimental attribution</p>
          <h1>Inspect where the model was sensitive.</h1>
          <p className="hero-deck">This view can help debug model behavior. It cannot prove why a prediction occurred or provide clinical evidence.</p>
        </div>
        <div className="learn-callout">
          <AlertTriangle aria-hidden="true" />
          <div><strong>Not causal or clinical evidence</strong><p>The backend repeats one time-sensitivity score across all frequencies. Read the overlay accordingly.</p></div>
        </div>
      </header>

      <section className="explain-controls">
        <div>
          <span className="file-icon"><Image aria-hidden="true" /></span>
          <div><strong>{analysis.audioFile.name}</strong><p className="mono-meta">Top model output: {analysis.modelResult.prediction} · {analysis.modelResult.confidence.toFixed(1)}%</p></div>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" checked={includeReason} onChange={(event) => setIncludeReason(event.target.checked)} />
          <span><strong>Request generated interpretation</strong><small>Optional; may contain errors</small></span>
        </label>
        {includeReason && (
          <label className="consent-row">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I consent to sending de-identified structured context to the configured external LLM provider.</span>
          </label>
        )}
        <button type="button" className="button button-primary" disabled={status === "loading" || (includeReason && !consent)} onClick={run}>
          <Sparkles size={17} /> {status === "loading" ? "Generating attribution…" : "Generate attribution"}
        </button>
      </section>

      {error && <div className="inline-alert alert-error" role="alert"><AlertTriangle /><div><strong>Attribution unavailable</strong><p>{error}</p></div></div>}

      {!result ? (
        <div className="results-empty explain-empty"><Eye aria-hidden="true" /><div><strong>No attribution generated yet</strong><p>Generate the view to compare the processed spectrogram, time sensitivity, and overlay.</p></div></div>
      ) : (
        <>
          <section className="explain-gallery" aria-label="Attribution visualizations">
            <ExplainFigure title="Processed spectrogram" body="Time–frequency energy after preprocessing." src={result.spectrogram} />
            <ExplainFigure title="Time sensitivity" body="The model gradient summarized over features." src={result.saliency} />
            <ExplainFigure title="Sensitivity overlay" body="Time sensitivity aligned over the spectrogram." src={result.overlay} />
          </section>
          <section className="explain-reading">
            <div>
              <p className="eyebrow">How to read this view</p>
              <h2>Attention is not explanation.</h2>
              <p>{result.attribution_warning ?? "Highlighted regions show where the model was sensitive in the processed audio. They do not prove cause or establish why a prediction is correct."}</p>
              <dl className="result-metadata">
                <div><dt>Attribution scope</dt><dd>{result.attribution_scope ?? "Experimental"}</dd></div>
                <div><dt>Saliency class</dt><dd>{result.saliency_class}</dd></div>
              </dl>
            </div>
            <div className="generated-reasoning">
              <p className="eyebrow">Generated interpretation</p>
              {result.reasoning ? <div className="generated-copy">{result.reasoning.split("\n").map((line, index) => line.trim() ? <p key={`${line}-${index}`}>{line}</p> : null)}</div> : <p>{result.reasoning_error ?? "No generated interpretation was requested."}</p>}
              <div className="inline-alert alert-warning"><Info /><div><strong>Interpretation may be wrong.</strong><p>Generated text does not add clinical validation and is not medical advice.</p></div></div>
            </div>
          </section>
        </>
      )}

      <div className="page-footer-actions"><button type="button" className="button button-secondary" onClick={() => navigate("/analyze")}><ArrowLeft size={17} /> Back to Analyze</button></div>
    </div>
  );
}

function ExplainFigure({ title, body, src }: { title: string; body: string; src: string }) {
  return <figure><img src={src} alt={title} /><figcaption><strong>{title}</strong><p>{body}</p></figcaption></figure>;
}
