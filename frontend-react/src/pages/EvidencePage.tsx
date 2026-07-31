import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.js";
import AudioLines from "lucide-react/dist/esm/icons/audio-lines.js";
import Braces from "lucide-react/dist/esm/icons/braces.js";
import CheckCircle2 from "lucide-react/dist/esm/icons/circle-check-big.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import FileSearch from "lucide-react/dist/esm/icons/file-search.js";
import Layers3 from "lucide-react/dist/esm/icons/layers-3.js";
import Scale from "lucide-react/dist/esm/icons/scale.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import { useServerStatus } from "../hooks/useServerStatus";

const METHOD_STEPS = [
  {
    icon: AudioLines,
    title: "1. Recording intake",
    body: "A supported audio file is decoded and validated. Duration, sample rate, file type, and optional denoising state travel with the result.",
  },
  {
    icon: SlidersHorizontal,
    title: "2. Feature extraction",
    body: "The pipeline converts the signal to a fixed-length sequence of 40 Mel-frequency cepstral coefficients (MFCCs). Long recordings are truncated and short recordings are padded.",
  },
  {
    icon: Layers3,
    title: "3. Sequence model",
    body: "A Conv1D front end feeds bidirectional GRU layers. The network produces one score for each project label.",
  },
  {
    icon: Braces,
    title: "4. Ranked output",
    body: "A softmax layer converts logits into a score distribution. These values are shown as uncalibrated model scores, not clinical probabilities.",
  },
];

export default function EvidencePage() {
  const server = useServerStatus();
  const contractVerified = server.modelContract === "verified-metadata";

  return (
    <div className="editorial-page evidence-page">
      <header className="editorial-hero" id="about">
        <div>
          <p className="eyebrow">Evidence library</p>
          <h1>Understand the model before reading its output.</h1>
          <p className="hero-deck">
            RespiNet is an experimental research prototype. This library separates what the software does, what its training data contains, and what still needs to be validated.
          </p>
        </div>
        <div className="evidence-status-panel">
          <p className="eyebrow">Current runtime</p>
          <StatusLine ok={server.online} label={server.online ? "Backend responding" : "Backend unavailable"} />
          <StatusLine ok={server.modelLoaded} label={server.modelLoaded ? "Model artifact loaded" : "Model artifact unavailable"} />
          <StatusLine ok={contractVerified} label={contractVerified ? "Model metadata contract verified" : "Model metadata contract unverified"} />
          <small>Status is checked from the local `/health` endpoint.</small>
        </div>
      </header>

      <nav className="section-index" aria-label="Evidence sections">
        <a href="#method">Method</a>
        <a href="#dataset">Dataset</a>
        <a href="#benchmark">Benchmark</a>
        <a href="#responsible-use">Responsible use</a>
        <a href="#sources">Sources</a>
      </nav>

      <section className="editorial-section" id="method">
        <div className="section-intro">
          <p className="eyebrow">Method</p>
          <h2>From sound to a ranked research label</h2>
          <p>
            The model receives acoustic features rather than clinical history, imaging, laboratory results, or a physical examination. Its output is therefore one narrow signal—not a clinical conclusion.
          </p>
        </div>
        <div className="method-list">
          {METHOD_STEPS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="method-row">
              <span><Icon aria-hidden="true" /></span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
        <div className="technical-table-wrap">
          <table className="technical-table">
            <caption>Current frontend-facing model contract</caption>
            <tbody>
              <tr><th scope="row">Input representation</th><td>40 MFCC features across a fixed sequence</td></tr>
              <tr><th scope="row">Network family</th><td>Conv1D plus bidirectional GRU</td></tr>
              <tr><th scope="row">Output</th><td>Eight project disease/health labels</td></tr>
              <tr><th scope="row">Score interpretation</th><td>Uncalibrated model output; not a clinical probability</td></tr>
              <tr><th scope="row">Required safeguard</th><td>Verified metadata for preprocessing and class order</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="editorial-section section-tint" id="dataset">
        <div className="section-intro">
          <p className="eyebrow">Dataset</p>
          <h2>The ICBHI database is valuable—and limited.</h2>
          <p>
            The 2017 ICBHI Respiratory Sound Database contains approximately 5.5 hours of audio: 920 recordings from 126 participants, split into 6,898 annotated respiratory cycles. Recordings came from different chest locations and devices.
          </p>
        </div>
        <div className="fact-strip" aria-label="ICBHI dataset facts">
          <Fact value="5.5 h" label="Approximate audio" />
          <Fact value="920" label="Recordings" />
          <Fact value="126" label="Participants" />
          <Fact value="6,898" label="Annotated cycles" />
        </div>
        <div className="evidence-two-column">
          <article>
            <Database aria-hidden="true" />
            <h3>What the original challenge measured</h3>
            <p>
              Respiratory cycles were annotated for crackles, wheezes, both, or neither. The official challenge evaluated respiratory-sound-event classification—not automatic clinical diagnosis.
            </p>
          </article>
          <article>
            <Scale aria-hidden="true" />
            <h3>Why the project’s eight labels need caution</h3>
            <p>
              Published disease counts are highly imbalanced, including only one asthma subject and two LRTI subjects. A patient-level split can therefore leave some labels absent from validation or test sets.
            </p>
          </article>
        </div>
        <div className="inline-alert alert-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Do not compare unlike benchmarks.</strong>
            <p>Eight-label disease classification is not the same task as the official four-event ICBHI challenge, so their scores are not directly interchangeable.</p>
          </div>
        </div>
      </section>

      <section className="editorial-section" id="benchmark">
        <div className="section-intro">
          <p className="eyebrow">Benchmark status</p>
          <h2>No clinically valid performance claim is available yet.</h2>
          <p>
            The repository records a historical best validation value of 75.36%, but that run used an earlier leakage-prone split. It has not been reproduced with a feasible patient-level train/validation/test evaluation across all eight labels.
          </p>
        </div>
        <div className="benchmark-ledger">
          <div><span>Historical validation value</span><strong>75.36%</strong><small>Not suitable for a current performance claim</small></div>
          <div><span>Patient-level rerun</span><strong>Pending</strong><small>Required before updated benchmark reporting</small></div>
          <div><span>Calibration study</span><strong>Not run</strong><small>Scores must remain labeled uncalibrated</small></div>
          <div><span>External clinical validation</span><strong>None</strong><small>Prototype is not screening- or diagnostic-grade</small></div>
        </div>
        <a className="text-link" href="/ARCHITECTURE_AND_BENCHMARK_REPORT.md" target="_blank" rel="noreferrer">
          Read the repository architecture and benchmark report <ArrowUpRight size={16} />
        </a>
      </section>

      <section className="editorial-section section-tint" id="responsible-use">
        <div className="section-intro">
          <p className="eyebrow">Responsible use</p>
          <h2>Human oversight is a product requirement.</h2>
          <p>
            A responsible interface states intended use, shows data and model limitations, keeps uncertainty visible, and makes it easy to inspect provenance or stop when the model contract is unsafe.
          </p>
        </div>
        <div className="principle-grid">
          <Principle icon={<ShieldCheck />} title="Bounded purpose">Use for research and education; never to diagnose, rule out disease, choose treatment, or delay care.</Principle>
          <Principle icon={<FileSearch />} title="Traceable output">Keep the recording source, preprocessing state, model version, class mapping, and time of analysis alongside every result.</Principle>
          <Principle icon={<Scale />} title="Visible uncertainty">Show alternatives and limitations. Do not convert a model score into clinical confidence.</Principle>
          <Principle icon={<Database />} title="Representative evaluation">Report participant-level splits, device mix, class support, and failure modes before making performance claims.</Principle>
        </div>
      </section>

      <section className="editorial-section source-section" id="sources">
        <div className="section-intro">
          <p className="eyebrow">Primary sources</p>
          <h2>Follow the evidence to its origin.</h2>
        </div>
        <ul className="source-list">
          <SourceLink href="https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge" label="Official ICBHI 2017 Challenge" />
          <SourceLink href="https://doi.org/10.1088/1361-6579/ab03ea" label="Rocha et al.: Respiratory sound database for development of automated classification" />
          <SourceLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7795327/" label="Peer-reviewed ICBHI disease-count table and classification study" />
          <SourceLink href="https://proceedings.mlr.press/v70/guo17a.html" label="Guo et al.: On Calibration of Modern Neural Networks" />
          <SourceLink href="https://www.who.int/news/item/28-06-2021-who-issues-first-global-report-on-ai-in-health-and-six-guiding-principles-for-its-design-and-use" label="WHO guidance on ethics and governance of AI for health" />
          <SourceLink href="https://www.fda.gov/medical-devices/software-medical-device-samd/transparency-machine-learning-enabled-medical-devices-guiding-principles" label="FDA transparency principles for machine-learning-enabled medical devices" />
        </ul>
      </section>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return <div className={ok ? "runtime-line is-ok" : "runtime-line"}>{ok ? <CheckCircle2 /> : <AlertTriangle />}<span>{label}</span></div>;
}

function Fact({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function Principle({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="principle"><span>{icon}</span><div><h3>{title}</h3><p>{children}</p></div></article>;
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return <li><a href={href} target="_blank" rel="noreferrer"><span>{label}</span><ArrowUpRight size={17} aria-hidden="true" /></a></li>;
}
