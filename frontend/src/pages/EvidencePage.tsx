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
import { motion } from "framer-motion";
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
    body: "Audio is resampled to 22.05 kHz and band-pass filtered (100–2,000 Hz). Each frame is described by 40 Mel-frequency cepstral coefficients (MFCCs) plus their first and second derivatives—120 values, normalized per recording. Overlapping 200-frame (≈4.6 s) windows cover the whole recording, so nothing is truncated.",
  },
  {
    icon: Layers3,
    title: "3. Sequence model",
    body: "A multi-scale Conv1D block with channel attention feeds two bidirectional GRU layers and dual temporal pooling (attention plus max), scoring the five project labels for every window. In parallel, Google’s pretrained YAMNet audio model summarizes the whole recording, and a simple classifier scores the same labels from that summary.",
  },
  {
    icon: Braces,
    title: "4. Ranked output",
    body: "Window scores are averaged, each model’s scores are temperature-calibrated on validation recordings, and the two are averaged and calibrated once more. When the top score is too low or the distribution too uncertain, the result is reported as uncertain. Calibrated scores are still model output, not clinical probabilities.",
  },
];

export default function EvidencePage() {
  const server = useServerStatus();
  const contractVerified = server.modelContract === "verified-metadata";

  return (
    <div className="editorial-page evidence-page">
      <motion.header
        className="editorial-hero"
        id="about"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
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
      </motion.header>

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
          {METHOD_STEPS.map(({ icon: Icon, title, body }, index) => (
            <motion.article
              key={title}
              className="method-row"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.1, ease: "easeOut" }}
            >
              <span><Icon aria-hidden="true" /></span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </motion.article>
          ))}
        </div>
        <div className="technical-table-wrap">
          <table className="technical-table">
            <caption>Current frontend-facing model contract</caption>
            <tbody>
              <tr><th scope="row">Input representation</th><td>40 MFCC + Δ + Δ² (120 values per frame) in overlapping 200-frame windows across the whole recording</td></tr>
              <tr><th scope="row">Network family</th><td>Multi-scale Conv1D plus bidirectional GRU (RespiNet-Attention v3, 458,701 parameters), averaged with a classifier over pretrained YAMNet embeddings</td></tr>
              <tr><th scope="row">Output</th><td>Five labels: asthma, bronchial, COPD, healthy, pneumonia</td></tr>
              <tr><th scope="row">Score interpretation</th><td>Temperature-calibrated model score with an abstention rule; not a clinical probability</td></tr>
              <tr><th scope="row">Required safeguard</th><td>Verified metadata for preprocessing and class order; hash checks on both models</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="editorial-section section-tint" id="dataset">
        <div className="section-intro">
          <p className="eyebrow">Dataset</p>
          <h2>Two public datasets—and an overlap we removed.</h2>
          <p>
            The model is trained on the 2017 ICBHI Respiratory Sound Database (920 recordings from 126 participants, about 5.5 hours, several chest locations and devices) merged with the Kaggle Asthma Detection Dataset V2. An audit found that 631 Kaggle clips—including every Kaggle COPD clip—are cut from ICBHI recordings. They were removed so the same audio can never appear in both training and test data.
          </p>
        </div>
        {/* Cohort facts: backend/artifacts/latest/dataset_audit.json (2026-10-22). */}
        <div className="fact-strip" aria-label="Training cohort facts">
          <Fact value="1,488" label="Recordings used" />
          <Fact value="243" label="Patient groups" />
          <Fact value="631" label="Duplicated ICBHI clips removed" />
          <Fact value="5" label="Labels" />
        </div>
        <div className="evidence-two-column">
          <article>
            <Database aria-hidden="true" />
            <div>
              <h3>What the original challenge measured</h3>
              <p>
                Respiratory cycles were annotated for crackles, wheezes, both, or neither. The official challenge evaluated respiratory-sound-event classification—not automatic clinical diagnosis.
              </p>
            </div>
          </article>
          <article>
            <Scale aria-hidden="true" />
            <div>
              <h3>Why rare ICBHI labels are grouped</h3>
              <p>
                ICBHI includes only one asthma subject and two LRTI subjects, too few for a patient-level train/validation/test split. URTI, bronchiectasis, bronchiolitis and LRTI are therefore grouped as “bronchial”. Kaggle’s file names do not identify patients reliably, so its patient groups are approximate.
              </p>
            </div>
          </article>
        </div>
        <div className="inline-alert alert-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Do not compare unlike benchmarks.</strong>
            <p>Five-label disease classification is not the same task as the official four-event ICBHI challenge, so their scores are not directly interchangeable.</p>
          </div>
        </div>
      </section>

      <section className="editorial-section" id="benchmark">
        <div className="section-intro">
          <p className="eyebrow">Benchmark status</p>
          <h2>Leakage-free results on one held-out split—not a clinical claim.</h2>
          <p>
            On 45 patients held out from training, the model reaches 73.3% patient-level and 81.3% recording-level accuracy. These patients come from the same datasets it was trained on. On 45 patients from another hospital, recorded with a different stethoscope, it failed completely: it called healthy and COPD patients “asthma”, because nearly all of its training audio from that kind of recording was asthma. Earlier figures (82%, then 77.6%) came from splits that still let recordings of the same patients appear on both sides. These are research measurements on one split of public data, with no external or clinical validation.
          </p>
        </div>
        {/* Results: backend/artifacts/latest/test_metrics.json and calibration.json (2026-10-22). */}
        <div className="benchmark-ledger">
          <div><span>Patient-level test accuracy</span><strong>73.3%</strong><small>45 held-out patients; 95% CI 60–87%</small></div>
          <div><span>Balanced accuracy</span><strong>71.9%</strong><small>Average recall across the five labels</small></div>
          <div><span>Calibration</span><strong>Applied</strong><small>Temperature scaling (fused T = 0.56); per-recording calibration error 0.05</small></div>
          <div><span>External hospital test</span><strong>Failed</strong><small>45 KAUH patients (new hospital and stethoscope): 0% correct, nearly all called asthma</small></div>
        </div>
        <p>
          By source: 70.4% on 27 ICBHI test patients and 77.8% on 18 Kaggle patients. The weakest label is “bronchial” (12.5% patient-level sensitivity). The model recognizes the recording source more easily than the disease, so these scores do not carry over to new clinics or devices. Full evidence: <code>documentation/ROUND2_EXPERIMENTS_REPORT.md</code>, <code>documentation/ACCURACY_EXPERIMENTS_REPORT.md</code> and <code>documentation/FINAL_PHASE_IMPROVEMENT_REPORT.md</code> in the repository.
        </p>
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
          <SourceLink href="https://www.kaggle.com/datasets/mohammedtawfikmusaed/asthma-detection-dataset-version-2" label="Kaggle Asthma Detection Dataset Version 2" />
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
