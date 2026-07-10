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
    desc: "Raw audio is converted to mono and resampled to 22.05 kHz. Optional inference-time denoising is experimental and may change the input distribution.",
    details: [
      "Resampling via librosa (kaiser_fast)",
      "Explicit target rate: 22.05 kHz",
      "Fixed 200-frame feature window",
      "Training-only augmentation: stretch, zero-fill shift, SNR noise",
      "Patient split occurs before augmentation",
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
    title: "Conv1D + BiGRU Network",
    desc: "Two temporal convolution layers feed two stacked bidirectional GRU layers, followed by global average pooling and a dense classifier.",
    details: [
      "Conv1D(64, kernel 5) → Conv1D(64, kernel 3)",
      "Bidirectional GRU(64) → Bidirectional GRU(32)",
      "Global average pooling → Dense(64) → Dropout",
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
      "Returns an uncalibrated model probability per class",
      "Threshold-free — purely probabilistic",
      "Probabilities require calibration before clinical interpretation",
    ],
  },
];

const ARCH_DETAILS = [
  {
    label: "Input shape",
    value: "(200, 120)",
    desc: "200 time steps × 120 features per sample",
  },
  {
    label: "Convolutions",
    value: "64@5 → 64@3",
    desc: "Local temporal patterns",
  },
  {
    label: "Recurrent stack",
    value: "BiGRU 64→32",
    desc: "Bidirectional temporal context",
  },
  {
    label: "Pooling",
    value: "Global average",
    desc: "Sequence to fixed-size representation",
  },
  {
    label: "Output",
    value: "Softmax",
    desc: "N-class probability distribution",
  },
  { label: "Parameters", value: "≈137k", desc: "Verify from the next saved model summary" },
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
        <motion.div
          className="page-intro"
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
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
            From raw lung sounds to a research classification — a step-by-step walkthrough of
            the AI pipeline.
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div style={{ position: "relative", marginBottom: "4rem" }}>
          {/* Vertical line */}
          <motion.div
            className="pipeline-rail"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              left: 28,
              top: 0,
              bottom: 0,
              width: 2,
              background: "var(--border)",
              zIndex: 0,
              transformOrigin: "top",
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
                transition={{ delay: i * 0.1, type: "spring", stiffness: 190, damping: 22 }}
                whileHover={{ x: 8 }}
                className="process-step"
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {/* Circle */}
                <motion.div
                  className="process-node"
                  whileHover={{ scale: 1.12, rotate: -6 }}
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
                </motion.div>
                {/* Content */}
                <div
                  className="glass-card process-card"
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
                        className="tech-chip"
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
          className="glass-card data-glow-card"
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
            {ARCH_DETAILS.map((item, i) => (
              <motion.div
                key={item.label}
                className="tech-spec-tile"
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: i * 0.045 }}
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
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Dataset */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card data-glow-card"
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
            ].map(([val, label], i) => (
              <motion.div
                key={label}
                className="dataset-stat"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.03 }}
                transition={{ delay: i * 0.055 }}
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
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
