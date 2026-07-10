import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Brain,
  MessageCircle,
  BookOpen,
  BarChart2,
} from "lucide-react";
import AnimatedCounter from "../components/AnimatedCounter";
import TiltCard from "../components/TiltCard";

const STATS = [
  { value: 75.36, decimals: 2, suffix: "%", label: "Historical Best Val*" },
  { value: 8, decimals: 0, suffix: "", label: "Disease Classes" },
  { value: 920, decimals: 0, suffix: "", label: "Audio Recordings" },
  { value: 126, decimals: 0, suffix: "", label: "Patients" },
];

const FEATURES = [
  {
    icon: <Activity size={24} />,
    title: "Live Diagnose",
    desc: "Upload or record respiratory sounds and get instant AI classification.",
    to: "/diagnose",
    color: "#06b6d4",
  },
  {
    icon: <BookOpen size={24} />,
    title: "Disease Library",
    desc: "Explore detailed profiles of 8 respiratory conditions with acoustic signatures.",
    to: "/diseases",
    color: "#8b5cf6",
  },
  {
    icon: <Brain size={24} />,
    title: "How It Works",
    desc: "Deep dive into MFCC extraction, GRU architecture, and the ICBHI dataset.",
    to: "/how-it-works",
    color: "#6366f1",
  },
  {
    icon: <BarChart2 size={24} />,
    title: "Model Metrics",
    desc: "View the captured historical run and its evaluation limitations.",
    to: "/metrics",
    color: "#f59e0b",
  },
  {
    icon: <MessageCircle size={24} />,
    title: "Research Info Guide",
    desc: "Browse general respiratory information with clear non-clinical limitations.",
    to: "/chat",
    color: "#10b981",
  },
];

// Animated waveform bars for the hero
function WaveformHero() {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className="hero-waveform"
      aria-hidden="true"
      style={{ display: "flex", alignItems: "center", gap: 3, height: 80 }}
    >
      {Array.from({ length: 52 }, (_, i) => {
        const h = 35 + Math.sin(i * 0.6) * 20 + ((i * 17) % 23);
        const delay = (i / 52) * 1.4;
        const dur = 0.8 + (i % 5) * 0.15;
        return (
          <motion.div
            key={i}
            animate={
              reduceMotion
                ? { scaleY: 1 }
                : { scaleY: [0.42, 1, 0.58, 0.86, 0.42], opacity: [0.45, 1, 0.62, 0.8, 0.45] }
            }
            transition={{
              duration: dur * 2.1,
              delay: -delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              width: 4,
              height: `${h}%`,
              borderRadius: 2,
              flexShrink: 0,
              background: `linear-gradient(to top, #06b6d4, #6366f1)`,
              opacity: 0.7,
              transformOrigin: "center",
            }}
          />
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page" style={{ paddingTop: 64 }}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="home-hero"
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          padding: "4rem 1.5rem",
        }}
      >
        {/* Background gradient blobs */}
        <div
          className="home-hero-panel"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 600,
              height: 600,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
              top: "-10%",
              left: "-5%",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 500,
              height: 500,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
              bottom: "0%",
              right: "-5%",
            }}
          />
          {/* Grid overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            position: "relative",
          }}
        >
          <div
            className="responsive-two-column home-hero-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4rem",
              alignItems: "center",
            }}
          >
            {/* Left: text */}
            <motion.div
              className="home-copy"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="section-tag" style={{ marginBottom: "1.2rem" }}>
                Deep Learning · Audio AI · Medical
              </div>
              <h1
                style={{
                  fontSize: "clamp(2.2rem,5vw,3.4rem)",
                  fontWeight: 900,
                  lineHeight: 1.1,
                  letterSpacing: "-0.03em",
                  marginBottom: "1.25rem",
                }}
              >
                Respiratory Disease
                <br />
                <span className="gradient-text">Recognition System</span>
              </h1>
              <p
                className="hero-lead"
                style={{
                  fontSize: "1.05rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.75,
                  marginBottom: "2rem",
                  maxWidth: 480,
                }}
              >
                A Conv1D and bidirectional GRU research prototype that assigns
                lung-sound recordings to 8 respiratory classes. The displayed
                historical metrics have not yet been reproduced with the new
                patient-level train/validation/test split.
              </p>

              {/* Stats */}
              <div
                className="responsive-stat-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "1rem",
                  marginBottom: "2.5rem",
                }}
              >
                {STATS.map((s) => (
                  <motion.div
                    key={s.label}
                    className="stat-tile"
                    whileHover={{ y: -5, scale: 1.035 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20 }}
                    style={{
                      padding: "0.9rem",
                      borderRadius: "0.75rem",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: "var(--cyan-400)",
                      }}
                    >
                      <AnimatedCounter
                        target={s.value}
                        decimals={s.decimals}
                        suffix={s.suffix}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {s.label}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CTAs */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  className="btn-primary kinetic-button"
                  onClick={() => navigate("/diagnose")}
                  style={{ fontSize: "0.95rem", padding: "0.75rem 1.75rem" }}
                >
                  Try Live Demo <ArrowRight size={16} />
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => navigate("/how-it-works")}
                  style={{ fontSize: "0.95rem" }}
                >
                  How It Works
                </button>
              </div>
            </motion.div>

            {/* Right: visual card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="animate-float home-visual"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* Waveform card */}
              <div className="glass-card spectral-card" style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.75rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Live Respiratory Waveform
                </div>
                <WaveformHero />
              </div>

              {/* Prediction card */}
              <div className="glass-card holographic-card" style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Model Prediction
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#10b981",
                      background: "rgba(16,185,129,0.1)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: 999,
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                  >
                    Illustrative demo
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: 800,
                    color: "#ef4444",
                    marginBottom: "0.25rem",
                  }}
                >
                  COPD
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    marginBottom: "1rem",
                  }}
                >
                  Illustrative probability:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    91.3%
                  </strong>
                </div>
                {[
                  ["COPD", "#ef4444", 91.3],
                  ["Healthy", "#10b981", 4.1],
                  ["URTI", "#06b6d4", 2.8],
                  ["Bronchiectasis", "#8b5cf6", 1.8],
                ].map(([label, color, pct]) => (
                  <div
                    key={label as string}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        minWidth: "7rem",
                      }}
                    >
                      {label}
                    </span>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: color as string,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                        minWidth: "2.5rem",
                        textAlign: "right",
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Feature cards ───────────────────────────────────────────── */}
      <section
        className="platform-section"
        style={{ padding: "5rem 1.5rem", background: "var(--bg-secondary)" }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-heading" style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div className="section-tag">Platform</div>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginTop: "0.5rem",
              }}
            >
              Everything you need
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                marginTop: "0.75rem",
                maxWidth: 500,
                margin: "0.75rem auto 0",
              }}
            >
              From local research inference to technical inspection, RespiNet
              exposes the complete prototype workflow.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {FEATURES.map((f, i) => (
              <TiltCard
                key={f.title}
                delay={i * 0.08}
                onClick={() => navigate(f.to)}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(f.to);
                  }
                }}
                className="glass-card glass-card-hover feature-tilt-card"
                style={{ padding: "1.5rem", cursor: "pointer" }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "0.75rem",
                    background: `${f.color}20`,
                    color: f.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    marginBottom: "0.5rem",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    marginTop: "1rem",
                    color: f.color,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Explore <ArrowRight size={14} />
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="final-cta-section" style={{ padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
              className="glass-card cta-orbit-card"
            style={{ padding: "3rem 2rem" }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🫁</div>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: "0.75rem",
              }}
            >
              Ready to analyze lung sounds?
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "2rem",
                lineHeight: 1.7,
              }}
            >
              Upload a supported recording or use your microphone to exercise
              the research classifier. Results are not a medical diagnosis.
            </p>
            <button
              className="btn-primary kinetic-button"
              onClick={() => navigate("/diagnose")}
              style={{ fontSize: "1rem", padding: "0.85rem 2rem" }}
            >
              Start Diagnosing <ArrowRight size={18} />
            </button>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginTop: "1.25rem",
              }}
            >
              ⚕️ For research and educational purposes only — not a substitute
              for professional medical advice.
              <br />* Historical metric from the previous leakage-prone split;
              replace it after a patient-level rerun.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
