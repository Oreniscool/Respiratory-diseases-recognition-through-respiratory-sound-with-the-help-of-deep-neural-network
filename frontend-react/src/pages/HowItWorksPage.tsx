import { motion } from "framer-motion";

const PIPELINE_STEPS = [
  {
    step: "01",
    icon: "🎙️",
    color: "#06b6d4",
    title: "Audio Acquisition",
    desc: "Respiratory sounds are recorded using stethoscopes or microphones. The ICBHI 2017 dataset contains recordings from multiple chest locations using professional medical-grade devices.",
    details: [
      "Devices: Meditron, AKGC417L, Littmann",
      "Sample rates: 4 kHz – 44.1 kHz",
      "920 annotated recordings across 126 patients",
      "Locations: anterior, posterior, lateral",
    ],
  },
  {
    step: "02",
    icon: "🔉",
    color: "#8b5cf6",
    title: "Preprocessing",
    desc: "Raw audio is resampled to a consistent rate using librosa's kaiser_fast resampler. Silence and noise are handled before feature extraction.",
    details: [
      "Resampling via librosa (kaiser_fast)",
      "Duration normalisation to 20 s per clip",
      "Augmentation: time stretch, pitch shift, noise",
      "Data balancing: COPD capped at 3/patient",
    ],
  },
  {
    step: "03",
    icon: "📊",
    color: "#6366f1",
    title: "MFCC Feature Extraction",
    desc: "Mel-Frequency Cepstral Coefficients capture the shape of the vocal tract. We extract 40 MFCCs plus their first and second derivatives (delta and delta-delta), yielding 120 features per frame.",
    details: [
      "40 MFCC coefficients per frame",
      "Delta and delta-delta computed via librosa",
      "Final shape: (200 time steps × 120 features)",
      "Padded/truncated to MAX_LEN = 200",
    ],
  },
  {
    step: "04",
    icon: "🧠",
    color: "#f59e0b",
    title: "GRU Neural Network",
    desc: "A multi-branch Bidirectional GRU (Gated Recurrent Unit) network processes the temporal sequence of MFCC features. Two parallel branches capture features at different granularities before merging.",
    details: [
      "Branch 1: GRU(32) → LeakyReLU → GRU(128)",
      "Branch 2: GRU(64) → LeakyReLU → GRU(128)",
      "Merge: Concatenate + Dense(128) + Dropout(0.3)",
      "Optimizer: Adamax | Loss: Categorical Cross-entropy",
    ],
  },
  {
    step: "05",
    icon: "🎯",
    color: "#10b981",
    title: "Softmax Classification",
    desc: "The final Dense layer produces a probability distribution over all disease classes using softmax activation. The class with the highest probability is returned as the prediction.",
    details: [
      "Dense(num_classes) + Softmax",
      "Returns confidence % per class",
      "Threshold-free — purely probabilistic",
      "Epoch 50/50: 84.66% train / 76.79% val",
    ],
  },
];

const ARCH_DETAILS = [
  {
    label: "Input shape",
    value: "(1, 200, 120)",
    desc: "1 sample × 200 time steps × 120 features",
  },
  {
    label: "Branch 1",
    value: "GRU 32→128",
    desc: "Fine-grained temporal patterns",
  },
  {
    label: "Branch 2",
    value: "GRU 64→128",
    desc: "Coarser multi-scale patterns",
  },
  {
    label: "Merge",
    value: "Concat + Dense",
    desc: "256 merged → 128 dense + Dropout 0.3",
  },
  {
    label: "Output",
    value: "Softmax",
    desc: "N-class probability distribution",
  },
  { label: "Parameters", value: "~1.7 M", desc: "Stored in best_model.h5" },
  { label: "Optimizer", value: "Adamax", desc: "Learning rate 0.001" },
  {
    label: "Loss",
    value: "Cat. Cross-entropy",
    desc: "One-hot encoded labels",
  },
];

export default function HowItWorksPage() {
  return (
    <div style={{ paddingTop: 64, minHeight: "100vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div className="section-tag">Technical Deep Dive</div>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginTop: "0.5rem",
            }}
          >
            How It <span className="gradient-text">Works</span>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: "0.75rem",
              maxWidth: 520,
              margin: "0.75rem auto 0",
            }}
          >
            From raw lung sounds to a diagnosis — a step-by-step walkthrough of
            the AI pipeline.
          </p>
        </div>

        {/* Pipeline steps */}
        <div style={{ position: "relative", marginBottom: "4rem" }}>
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 0,
              bottom: 0,
              width: 2,
              background: "var(--border)",
              zIndex: 0,
            }}
          />

          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {PIPELINE_STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {/* Circle */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: `${s.color}20`,
                    border: `2px solid ${s.color}60`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                  }}
                >
                  {s.icon}
                </div>
                {/* Content */}
                <div
                  className="glass-card"
                  style={{
                    flex: 1,
                    padding: "1.5rem",
                    borderColor: `${s.color}25`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontFamily: "monospace",
                        color: s.color,
                        fontWeight: 700,
                      }}
                    >
                      STEP {s.step}
                    </span>
                    <h3
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        color: "var(--text-primary)",
                      }}
                    >
                      {s.title}
                    </h3>
                  </div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.75,
                      marginBottom: "1rem",
                    }}
                  >
                    {s.desc}
                  </p>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
                  >
                    {s.details.map((d) => (
                      <span
                        key={d}
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: 999,
                          background: `${s.color}10`,
                          color: s.color,
                          border: `1px solid ${s.color}30`,
                          fontFamily: "monospace",
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Architecture table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card"
          style={{ padding: "1.75rem", marginBottom: "3rem" }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              marginBottom: "1.25rem",
            }}
          >
            🏗️ Architecture Summary
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {ARCH_DETAILS.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "0.85rem",
                  borderRadius: "0.6rem",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.25rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--cyan-400)",
                    fontFamily: "monospace",
                    marginBottom: "0.2rem",
                  }}
                >
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: "0.73rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dataset */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card"
          style={{ padding: "1.75rem" }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              marginBottom: "0.75rem",
            }}
          >
            📦 ICBHI 2017 Dataset
          </h2>
          <p
            style={{
              fontSize: "0.87rem",
              color: "var(--text-secondary)",
              lineHeight: 1.75,
              marginBottom: "1.25rem",
            }}
          >
            The International Conference on Biomedical and Health Informatics
            (ICBHI) 2017 Respiratory Sound Database is the benchmark dataset
            used for this project. It contains lung sound recordings collected
            from 126 subjects.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {[
              ["920", "Audio recordings"],
              ["6898", "Respiratory cycles"],
              ["126", "Unique patients"],
              ["8", "Disease classes"],
              ["4–44.1 kHz", "Sample rates"],
              ["5–120 s", "Recording lengths"],
            ].map(([val, label]) => (
              <div
                key={label}
                style={{
                  padding: "0.85rem",
                  borderRadius: "0.6rem",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    color: "var(--cyan-400)",
                  }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    marginTop: "0.2rem",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
