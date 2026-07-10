import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import AnimatedCounter from "../components/AnimatedCounter";
import { REPORT_DATA, RUNS_DATA, CLASS_COLORS } from "../data/diseases";

const OVERALL_METRICS = [
  {
    label: "Final Train Accuracy",
    value: 82.12,
    err: "Epoch 50/50",
    color: "#3b82f6",
  },
  { label: "Final Val Accuracy", value: 73.44, err: "Epoch 50/50", color: "#10b981" },
  { label: "Best Val Accuracy", value: 75.36, err: "Epoch 48/50", color: "#f59e0b" },
];

const CIRC = 2 * Math.PI * 38;

function MetricRing({ value, color }: { value: number; color: string }) {
  const offset = CIRC * (1 - value / 100);
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: 80, height: 80 }}
      role="img"
      aria-label={`${value.toFixed(2)} percent`}
    >
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="var(--bg-tertiary)"
        strokeWidth="7"
      />
      <motion.circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}
      />
    </svg>
  );
}

// Recharts tooltip theme
const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

const hasReportData = REPORT_DATA.length > 0;

// Build runs chart data
const runsChartData = RUNS_DATA.labels.map((label, i) => ({
  name: label,
  "Train Accuracy": RUNS_DATA.trainAccuracy[i],
  "Val Accuracy": RUNS_DATA.valAccuracy[i],
}));

// Build per-class bar data
const classChartData = hasReportData
  ? REPORT_DATA.map((r) => ({
      name: r.cls,
      Precision: +(r.precision * 100).toFixed(1),
      Recall: +(r.recall * 100).toFixed(1),
      F1: +(r.f1 * 100).toFixed(1),
      color: CLASS_COLORS[r.cls] ?? "#6366f1",
    }))
  : [];

export default function MetricsPage() {
  return (
    <div style={{ paddingTop: 64, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <motion.div
          className="page-intro"
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <div className="section-tag">Performance</div>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginTop: "0.5rem",
            }}
          >
            Model <span className="gradient-text">Metrics</span>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: "0.75rem",
              maxWidth: 520,
              margin: "0.75rem auto 0",
            }}
          >
            Captured historical run: final train loss 0.4229 and validation
            loss 0.8203. Best validation loss was 0.7183 at epoch 48.
          </p>
          <motion.div
            className="historical-data-notice"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            style={{
              margin: "1rem auto 0",
              maxWidth: 720,
              padding: "0.8rem 1rem",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: "0.75rem",
              color: "#fbbf24",
              background: "rgba(245,158,11,0.08)",
              fontSize: "0.8rem",
            }}
          >
            Historical and not clinically valid: this run used the previous
            sample-level split after augmentation. Replace these values with
            artifacts/latest/test_metrics.json after a patient-level rerun.
          </motion.div>
        </motion.div>

        {/* Overall metric cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1rem",
            marginBottom: "3rem",
          }}
        >
          {OVERALL_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 230, damping: 22 }}
              whileHover={{ y: -8, scale: 1.025 }}
              className="glass-card metric-orbit-card"
              style={{
                padding: "1.25rem",
                textAlign: "center",
                borderColor: `${m.color}30`,
              }}
            >
              <MetricRing value={m.value} color={m.color} />
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: m.color,
                  marginTop: "0.5rem",
                }}
              >
                <AnimatedCounter target={m.value} decimals={2} suffix="%" />
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginTop: "0.2rem",
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  marginTop: "0.15rem",
                }}
              >
                {m.err}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Training runs chart */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          whileHover={{ y: -4 }}
          className="glass-card data-glow-card"
          style={{ padding: "1.75rem", marginBottom: "2rem" }}
        >
          <h2
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
            }}
          >
            Final Epoch Accuracy (Train vs Val)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={runsChartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.08)"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              />
              <YAxis
                domain={[70, 90]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Legend wrapperStyle={{ fontSize: "0.78rem" }} />
              {[
                ["Train Accuracy", "#3b82f6"],
                ["Val Accuracy", "#10b981"],
              ].map(([key, color]) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color as string}
                  dot={{ r: 4, fill: color as string }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Per-class grouped bar */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          whileHover={{ y: -4 }}
          className="glass-card data-glow-card"
          style={{ padding: "1.75rem", marginBottom: "2rem" }}
        >
          <h2
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
            }}
          >
            Per-Class Performance
          </h2>
          {hasReportData ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={classChartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.08)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                />
                <YAxis
                  domain={[60, 90]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Legend wrapperStyle={{ fontSize: "0.78rem" }} />
                <Bar
                  dataKey="Precision"
                  fill="rgba(59,130,246,0.8)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Recall"
                  fill="rgba(16,185,129,0.8)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="F1"
                  fill="rgba(245,158,11,0.8)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}
            >
              Per-class report data is not available for this training snapshot.
            </div>
          )}
        </motion.div>

        {/* Classification report table */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          whileHover={{ y: -4 }}
          className="glass-card data-glow-card"
          style={{ padding: "1.75rem", overflowX: "auto" }}
        >
          <h2
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              marginBottom: "1.25rem",
            }}
          >
            Classification Report
          </h2>
          {hasReportData ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    "Class",
                    "Precision",
                    "Recall",
                    "F1-Score",
                    "Support",
                    "Performance",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.6rem 0.75rem",
                        textAlign: "left",
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPORT_DATA.map((r, i) => {
                  const color = CLASS_COLORS[r.cls] ?? "#6366f1";
                  return (
                    <tr
                      key={r.cls}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background:
                          i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.015)",
                      }}
                    >
                      <td
                        style={{
                          padding: "0.7rem 0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{r.cls}</span>
                      </td>
                      <td
                        style={{
                          padding: "0.7rem 0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {r.precision.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "0.7rem 0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {r.recall.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "0.7rem 0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {r.f1.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "0.7rem 0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {r.support}
                      </td>
                      <td
                        style={{ padding: "0.7rem 0.75rem", minWidth: "8rem" }}
                      >
                        <div className="mini-bar-track">
                          <motion.div
                            className="mini-bar-fill"
                            initial={{ width: 0 }}
                            whileInView={{
                              width: `${(r.f1 * 100).toFixed(0)}%`,
                            }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            style={{ background: color }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div
              style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}
            >
              Classification report data is not available for this training
              snapshot.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
