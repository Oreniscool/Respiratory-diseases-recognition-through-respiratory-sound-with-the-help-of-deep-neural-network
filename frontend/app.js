/* ═══════════════════════════════════════════════════════════════
   RespiNet — app.js
   All interactivity: demo, charts, animations, sample panels
   ═══════════════════════════════════════════════════════════════ */

"use strict";

/* ── Data ──────────────────────────────────────────────────────── */

const CLASSES = [
  "Bronchiectasis",
  "Bronchiolitis",
  "COPD",
  "Healthy",
  "Pneumonia",
  "URTI",
];

const CLASS_COLORS = {
  Bronchiectasis: "#8b5cf6",
  Bronchiolitis: "#f59e0b",
  COPD: "#ef4444",
  Healthy: "#22c55e",
  Pneumonia: "#3b82f6",
  URTI: "#06b6d4",
};

// Per-class classification report
const REPORT = [
  {
    cls: "Bronchiectasis",
    precision: 0.98,
    recall: 1.0,
    f1: 0.99,
    support: 44,
  },
  { cls: "Bronchiolitis", precision: 1.0, recall: 1.0, f1: 1.0, support: 30 },
  { cls: "COPD", precision: 1.0, recall: 0.91, f1: 0.95, support: 57 },
  { cls: "Healthy", precision: 0.94, recall: 0.92, f1: 0.93, support: 36 },
  { cls: "Pneumonia", precision: 0.92, recall: 1.0, f1: 0.96, support: 36 },
  { cls: "URTI", precision: 0.94, recall: 0.96, f1: 0.94, support: 53 },
];

// 10 training runs from the paper
const RUNS = {
  labels: [
    "Run 1",
    "Run 2",
    "Run 3",
    "Run 4",
    "Run 5",
    "Run 6",
    "Run 7",
    "Run 8",
    "Run 9",
    "Run 10",
  ],
  accuracy: [
    0.9525, 0.9567, 0.9605, 0.949, 0.9486, 0.9604, 0.9565, 0.9604, 0.9565,
    0.9604,
  ],
  precision: [
    0.9548, 0.9589, 0.9621, 0.9507, 0.9509, 0.9623, 0.9589, 0.9618, 0.9599,
    0.9625,
  ],
  recall: [
    0.9526, 0.9565, 0.9605, 0.9486, 0.9486, 0.9605, 0.9565, 0.9605, 0.9565,
    0.9605,
  ],
  f1: [
    0.9522, 0.9566, 0.9604, 0.9485, 0.9487, 0.9603, 0.9566, 0.9604, 0.9566,
    0.9601,
  ],
};

// Dataset distribution (after augmentation, approximate)
const DIST = {
  labels: CLASSES,
  counts: [220, 150, 285, 180, 180, 265],
};

// Sample predictions for each disease
const SAMPLES = {
  healthy: {
    label: "Healthy",
    patientId: "101",
    recordingId: "101_1b1_Al_sc_Meditron",
    duration: "24.7 s",
    sampleRate: "44.1 kHz",
    location: "Left Anterior (Al)",
    device: "Meditron",
    cycles: 6,
    crackles: false,
    wheezes: false,
    waveImg: "assets/healthy.png",
    prediction: "Healthy",
    isHealthy: true,
    desc: "Normal lung sounds with regular breathing pattern. No adventitious sounds (crackles or wheezes) detected. The respiratory cycle is regular and amplitude is consistent.",
    probs: {
      Healthy: 94.2,
      COPD: 1.8,
      URTI: 1.5,
      Bronchiectasis: 1.2,
      Pneumonia: 0.8,
      Bronchiolitis: 0.5,
    },
    mfcc: [-142.3, 78.5, -23.1, 11.4, -5.2, 8.9, -3.7, 6.1, -2.4, 4.8],
  },
  copd: {
    label: "COPD",
    patientId: "141",
    recordingId: "141_2b1_Pr_sc_AKGC417L",
    duration: "18.3 s",
    sampleRate: "44.1 kHz",
    location: "Right Posterior (Pr)",
    device: "AKG C417L",
    cycles: 4,
    crackles: true,
    wheezes: false,
    waveImg: "assets/copd.png",
    prediction: "COPD",
    isHealthy: false,
    desc: "Chronic Obstructive Pulmonary Disease detected. Characteristic airflow limitation signatures present. Prolonged expiratory phase and reduced breath sound intensity noted.",
    probs: {
      COPD: 91.3,
      Healthy: 4.1,
      URTI: 2.8,
      Bronchiectasis: 1.0,
      Pneumonia: 0.5,
      Bronchiolitis: 0.3,
    },
    mfcc: [-168.7, 95.2, -41.3, 22.6, -12.1, 15.3, -8.4, 11.2, -6.1, 8.5],
  },
  urti: {
    label: "URTI",
    patientId: "163",
    recordingId: "163_1p1_Tc_sc_LittC2SE",
    duration: "32.1 s",
    sampleRate: "44.1 kHz",
    location: "Trachea (Tc)",
    device: "Littmann Classic II SE",
    cycles: 8,
    crackles: false,
    wheezes: true,
    waveImg: null,
    prediction: "URTI",
    isHealthy: false,
    desc: "Upper Respiratory Tract Infection detected. Increased turbulence in upper airways visible in spectral features. Mild wheezing pattern consistent with inflamed upper airways.",
    probs: {
      URTI: 96.7,
      Healthy: 1.4,
      COPD: 0.8,
      Bronchiectasis: 0.6,
      Pneumonia: 0.3,
      Bronchiolitis: 0.2,
    },
    mfcc: [-155.4, 82.1, -31.8, 16.9, -8.6, 12.4, -5.1, 8.3, -3.9, 6.2],
  },
  bronchiectasis: {
    label: "Bronchiectasis",
    patientId: "178",
    recordingId: "178_3p1_Ll_sc_Meditron",
    duration: "21.5 s",
    sampleRate: "44.1 kHz",
    location: "Left Lateral Lower (Ll)",
    device: "Meditron",
    cycles: 5,
    crackles: true,
    wheezes: false,
    waveImg: "assets/Bronchiectasis.png",
    prediction: "Bronchiectasis",
    isHealthy: false,
    desc: "Bronchiectasis detected. Persistent coarse crackles and abnormal bronchial dilation signatures present in the MFCC feature space. Characteristic of dilated bronchi with mucus accumulation.",
    probs: {
      Bronchiectasis: 98.5,
      Healthy: 0.7,
      COPD: 0.4,
      URTI: 0.2,
      Pneumonia: 0.1,
      Bronchiolitis: 0.1,
    },
    mfcc: [-172.1, 103.4, -48.7, 28.3, -14.2, 19.1, -10.6, 14.7, -7.8, 11.3],
  },
  pneumonia: {
    label: "Pneumonia",
    patientId: "221",
    recordingId: "221_1b1_Ar_sc_Littmann_ST",
    duration: "28.6 s",
    sampleRate: "44.1 kHz",
    location: "Right Anterior (Ar)",
    device: "Littmann StethoConnect",
    cycles: 7,
    crackles: true,
    wheezes: true,
    waveImg: "assets/pneumonia.png",
    prediction: "Pneumonia",
    isHealthy: false,
    desc: "Pneumonia detected. Fine end-inspiratory crackles present alongside bronchial breath sounds. MFCC features show characteristic consolidation patterns in the lower lung fields.",
    probs: {
      Pneumonia: 92.1,
      Healthy: 3.4,
      URTI: 2.1,
      COPD: 1.5,
      Bronchiectasis: 0.6,
      Bronchiolitis: 0.3,
    },
    mfcc: [-161.8, 89.3, -37.5, 19.7, -10.4, 13.8, -7.2, 10.1, -5.5, 7.8],
  },
  bronchiolitis: {
    label: "Bronchiolitis",
    patientId: "196",
    recordingId: "196_1b1_Al_sc_Meditron",
    duration: "16.8 s",
    sampleRate: "44.1 kHz",
    location: "Left Anterior (Al)",
    device: "Meditron",
    cycles: 4,
    crackles: true,
    wheezes: true,
    waveImg: "assets/Bronchiolitis.png",
    prediction: "Bronchiolitis",
    isHealthy: false,
    desc: "Bronchiolitis detected. Combined crackles and wheezes indicate small-airway inflammation. Common in infants and young children. High-frequency features clearly distinguish this from COPD.",
    probs: {
      Bronchiolitis: 99.2,
      Pneumonia: 0.4,
      COPD: 0.2,
      Healthy: 0.1,
      URTI: 0.1,
      Bronchiectasis: 0.0,
    },
    mfcc: [-179.3, 112.8, -56.4, 34.1, -18.9, 23.6, -14.3, 18.2, -10.7, 14.8],
  },
};

// Demo simulated data (same as SAMPLES) — used as fallback when server is offline
const DEMO_RESULTS = SAMPLES;

// Shared reference set by initDemo, used by initRecorder
let _handleFile = null;

const API_BASE = "http://localhost:5000";
let serverOnline = false; // server reachable
let datasetOnline = false; // dataset .wav files present on server

// Poll the backend health endpoint every 4 s
(function pollHealth() {
  function check() {
    fetch(API_BASE + "/health", { signal: AbortSignal.timeout(2000) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const wasOnline = serverOnline;
        serverOnline = true;
        datasetOnline = !!data.dataset;
        if (!wasOnline || datasetOnline !== !!data.dataset) updateServerBadge();
      })
      .catch(() => {
        if (serverOnline) {
          serverOnline = false;
          datasetOnline = false;
          updateServerBadge();
        }
      });
  }
  check();
  setInterval(check, 4000);
})();

function updateServerBadge() {
  const badge = document.getElementById("serverBadge");
  if (!badge) return;
  if (!serverOnline) {
    badge.textContent = "🟡 Server offline — showing demo data";
    badge.className = "server-badge offline";
  } else if (!datasetOnline) {
    badge.textContent =
      "🟠 Server online — dataset not found, pills use demo data";
    badge.className = "server-badge offline";
  } else {
    badge.textContent = "🟢 Server online — using real model & dataset";
    badge.className = "server-badge online";
  }
}

/* ── Chart.js global defaults ──────────────────────────────────── */
// Inject server-badge CSS
(function () {
  const s = document.createElement("style");
  s.textContent = `
    .server-badge { display:inline-flex; align-items:center; gap:.4rem; font-size:.78rem; font-weight:600;
      padding:.3rem .9rem; border-radius:999px; margin-bottom:1rem; }
    .server-badge.online  { background:#dcfce7; color:#16a34a; }
    .server-badge.offline { background:#fef9c3; color:#854d0e; }
  `;
  document.head.appendChild(s);
})();

/* ── Chart.js global defaults ──────────────────────────────────── */
Chart.defaults.font.family = "'Segoe UI', system-ui, -apple-system, sans-serif";
Chart.defaults.color = "#64748b";

/* ── Utility helpers ───────────────────────────────────────────── */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function fmt(n, decimals = 4) {
  return n.toFixed(decimals);
}

/* ════════════════════════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════════════════════════ */
(function initNavbar() {
  const navbar = document.getElementById("navbar");
  const toggle = document.getElementById("navToggle");
  const links = document.querySelector(".nav-links");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
  });

  toggle.addEventListener("click", () => links.classList.toggle("open"));

  // Close menu on link click
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
})();

/* ════════════════════════════════════════════════════════════════
   ANIMATED WAVEFORM (Hero)
   ════════════════════════════════════════════════════════════════ */
(function initHeroWave() {
  const container = document.getElementById("heroWave");
  if (!container) return;

  const N = 48;
  container.innerHTML =
    '<div class="wave-bars">' +
    Array.from({ length: N }, (_, i) => {
      const h = clamp(Math.random() * 70 + 20, 15, 95);
      const delay = ((i / N) * 1.2).toFixed(2);
      const dur = (0.9 + Math.random() * 0.6).toFixed(2);
      return `<div class="wave-bar" style="height:${h}%;animation-duration:${dur}s;animation-delay:-${delay}s"></div>`;
    }).join("") +
    "</div>";

  // Add keyframe if not already added
  if (!document.getElementById("waveBarStyle")) {
    const s = document.createElement("style");
    s.id = "waveBarStyle";
    s.textContent = `@keyframes waveBar {
      0%,100%{ transform: scaleY(1);   opacity:.7; }
      50%     { transform: scaleY(.35); opacity:.35; }
    }`;
    document.head.appendChild(s);
  }
})();

/* ════════════════════════════════════════════════════════════════
   SCROLL-REVEAL  (generic)
   ════════════════════════════════════════════════════════════════ */
(function initReveal() {
  // Mark all section children as reveal targets
  document
    .querySelectorAll(
      ".section-header, .metric-card, .wave-card, .perf-img-card, .arch-list li, .am-item",
    )
    .forEach((el) => {
      el.classList.add("reveal");
    });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e, idx) => {
        if (e.isIntersecting) {
          // Stagger siblings
          const siblings = Array.from(
            e.target.parentElement.querySelectorAll(".reveal"),
          );
          const i = siblings.indexOf(e.target);
          setTimeout(() => e.target.classList.add("visible"), i * 60);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();

/* ════════════════════════════════════════════════════════════════
   METRIC CARDS — counter animation + ring
   ════════════════════════════════════════════════════════════════ */
(function initMetricCards() {
  const CIRCUMFERENCE = 2 * Math.PI * 15.9; // r=15.9

  document.querySelectorAll(".metric-card").forEach((card) => {
    const target = parseFloat(card.dataset.target);
    const counter = card.querySelector(".counter");
    const ring = card.querySelector(".ring-fill");

    let animated = false;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !animated) {
          animated = true;
          io.disconnect();

          // Number counter
          const duration = 1500;
          const start = performance.now();
          (function tick(now) {
            const t = clamp((now - start) / duration, 0, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            counter.textContent = (ease * target).toFixed(2);
            if (t < 1) requestAnimationFrame(tick);
          })(start);

          // SVG ring
          if (ring) {
            const pct = target / 100;
            const dash = pct * CIRCUMFERENCE;
            ring.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
            ring.style.strokeDashoffset = CIRCUMFERENCE;
            ring.style.opacity = "1";
            requestAnimationFrame(() => {
              ring.style.strokeDashoffset = CIRCUMFERENCE - dash;
            });
          }
        }
      },
      { threshold: 0.4 },
    );

    io.observe(card);
  });
})();

/* ════════════════════════════════════════════════════════════════
   CHART: Training runs comparison
   ════════════════════════════════════════════════════════════════ */
(function initRunsChart() {
  const ctx = document.getElementById("runsChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "line",
    data: {
      labels: RUNS.labels,
      datasets: [
        {
          label: "Accuracy",
          data: RUNS.accuracy.map((v) => +(v * 100).toFixed(2)),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,.08)",
          tension: 0.35,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: "Precision",
          data: RUNS.precision.map((v) => +(v * 100).toFixed(2)),
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139,92,246,.06)",
          tension: 0.35,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: "Recall",
          data: RUNS.recall.map((v) => +(v * 100).toFixed(2)),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,.06)",
          tension: 0.35,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: "F1-Score",
          data: RUNS.f1.map((v) => +(v * 100).toFixed(2)),
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,.06)",
          tension: 0.35,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, pointStyleWidth: 10, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        y: {
          min: 93,
          max: 97,
          ticks: { callback: (v) => v + "%" },
          grid: { color: "#f1f5f9" },
        },
        x: { grid: { display: false } },
      },
    },
  });
})();

/* ════════════════════════════════════════════════════════════════
   CHART: Per-class grouped bar chart
   ════════════════════════════════════════════════════════════════ */
(function initClassChart() {
  const ctx = document.getElementById("classChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: REPORT.map((r) => r.cls),
      datasets: [
        {
          label: "Precision",
          data: REPORT.map((r) => +(r.precision * 100).toFixed(1)),
          backgroundColor: "rgba(59,130,246,.8)",
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Recall",
          data: REPORT.map((r) => +(r.recall * 100).toFixed(1)),
          backgroundColor: "rgba(34,197,94,.8)",
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "F1-Score",
          data: REPORT.map((r) => +(r.f1 * 100).toFixed(1)),
          backgroundColor: "rgba(245,158,11,.8)",
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, pointStyleWidth: 10, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        y: {
          min: 85,
          max: 102,
          ticks: { callback: (v) => v + "%" },
          grid: { color: "#f1f5f9" },
        },
        x: { grid: { display: false } },
      },
    },
  });
})();

/* ════════════════════════════════════════════════════════════════
   CLASSIFICATION REPORT TABLE
   ════════════════════════════════════════════════════════════════ */
(function initReportTable() {
  const tbody = document.getElementById("reportTableBody");
  if (!tbody) return;

  REPORT.forEach((r) => {
    const color = CLASS_COLORS[r.cls] || "#3b82f6";
    const f1pct = (r.f1 * 100).toFixed(0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="class-dot" style="background:${color}"></span>${r.cls}</td>
      <td>${r.precision.toFixed(2)}</td>
      <td>${r.recall.toFixed(2)}</td>
      <td>${r.f1.toFixed(2)}</td>
      <td>${r.support}</td>
      <td><div class="mini-bar"><div class="mini-fill" style="width:${f1pct}%;background:${color}"></div></div></td>
    `;
    tbody.appendChild(tr);
  });
})();

/* ════════════════════════════════════════════════════════════════
   CHART: Dataset distribution
   ════════════════════════════════════════════════════════════════ */
(function initDistChart() {
  const ctx = document.getElementById("distChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: DIST.labels,
      datasets: [
        {
          data: DIST.counts,
          backgroundColor: DIST.labels.map((l) => CLASS_COLORS[l] || "#3b82f6"),
          borderWidth: 3,
          borderColor: "#fff",
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "62%",
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true, pointStyleWidth: 12, padding: 14 },
        },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} samples` },
        },
      },
    },
  });
})();

/* ════════════════════════════════════════════════════════════════
   SAMPLE PANELS (tabbed)
   ════════════════════════════════════════════════════════════════ */
let predChartInstance = null;

function buildSamplePanel(key) {
  const s = SAMPLES[key];
  if (!s) return "";

  const probEntries = Object.entries(s.probs).sort((a, b) => b[1] - a[1]);

  const probBars = probEntries
    .map(([cls, pct]) => {
      const color = CLASS_COLORS[cls] || "#3b82f6";
      const isTop = cls === s.prediction;
      return `<div class="sp-pred-row">
      <span class="sp-class" style="color:${isTop ? color : ""};font-weight:${isTop ? "800" : "600"}">${cls}</span>
      <div class="sp-pred-bar"><div class="sp-pred-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="sp-pred-pct">${pct.toFixed(1)}%</span>
    </div>`;
    })
    .join("");

  const waveHtml = s.waveImg
    ? `<div class="sp-wave"><img src="${s.waveImg}" alt="${s.label} waveform" /></div>`
    : `<div class="sp-wave" style="height:120px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:.85rem">No waveform image available</div>`;

  const badgeClass = s.isHealthy ? "healthy" : "disease";
  const badgeIcon = s.isHealthy ? "✅" : "⚠️";

  return `
    <div class="sp-input">
      <div class="sp-label in">📂 Input — Audio Recording</div>
      ${waveHtml}
      <div class="sp-row"><span>Patient ID</span><span>${s.patientId}</span></div>
      <div class="sp-row"><span>Recording ID</span><span style="font-size:.78rem;font-family:monospace">${s.recordingId}</span></div>
      <div class="sp-row"><span>Duration</span><span>${s.duration}</span></div>
      <div class="sp-row"><span>Sample Rate</span><span>${s.sampleRate}</span></div>
      <div class="sp-row"><span>Location</span><span>${s.location}</span></div>
      <div class="sp-row"><span>Device</span><span>${s.device}</span></div>
      <div class="sp-row"><span>Resp. Cycles</span><span>${s.cycles}</span></div>
      <div class="sp-row"><span>Crackles</span><span style="color:${s.crackles ? "#ef4444" : "#22c55e"}">${s.crackles ? "Yes" : "No"}</span></div>
      <div class="sp-row"><span>Wheezes</span><span style="color:${s.wheezes ? "#ef4444" : "#22c55e"}">${s.wheezes ? "Yes" : "No"}</span></div>
      <div class="sp-row"><span>MFCC Features</span><span style="font-size:.75rem;font-family:monospace;color:#94a3b8">[${s.mfcc.map((v) => v.toFixed(1)).join(", ")}, …]</span></div>
    </div>

    <div class="sp-output">
      <div class="sp-label out">🧠 Output — Model Prediction</div>
      <div class="sp-result-badge ${badgeClass}">${badgeIcon} ${s.prediction}</div>
      <p class="sp-desc">${s.desc}</p>
      <br/>
      <div class="sp-label out" style="margin-bottom:.6rem">Class Probabilities (Softmax)</div>
      ${probBars}
    </div>
  `;
}

(function initSampleTabs() {
  const panel = document.getElementById("samplePanel");
  const tabBtns = document.querySelectorAll(".tab-btn");
  if (!panel) return;

  function activate(key) {
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === key));
    panel.innerHTML = buildSamplePanel(key);
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });

  // Initial
  activate("healthy");
})();

/* ════════════════════════════════════════════════════════════════
   DEMO — Upload / Sample Pills  (real API + mock fallback)
   ════════════════════════════════════════════════════════════════ */
(function initDemo() {
  const uploadZone = document.getElementById("uploadZone");
  const recordZone = document.getElementById("recordZone");
  const fileInput = document.getElementById("fileInput");
  const pipeline = document.getElementById("pipeline");
  const resultCard = document.getElementById("resultCard");
  const resetBtn = document.getElementById("resetBtn");
  const steps = [1, 2, 3, 4].map((i) => document.getElementById(`step${i}`));
  const pills = document.querySelectorAll(".pill[data-sample]");

  // ── Tab switching ──────────────────────────────────────────────
  document.querySelectorAll(".dit-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".dit-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const pane = tab.dataset.dit;
      uploadZone.style.display = pane === "upload" ? "" : "none";
      recordZone.style.display = pane === "record" ? "" : "none";
    });
  });

  // ── Drag-and-drop ──────────────────────────────────────────────
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", () =>
    uploadZone.classList.remove("drag-over"),
  );
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      if (serverOnline && datasetOnline) {
        runRealSample(pill.dataset.sample);
      } else {
        runMockSample(pill.dataset.sample);
      }
    });
  });

  resetBtn.addEventListener("click", resetDemo);

  // ── File handler: real API or mock ─────────────────────────────
  // Exposed at module scope so initRecorder can also call it
  function handleFile(file) {
    _handleFile = handleFile; // keep reference fresh
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["wav", "mp3", "ogg", "flac", "m4a"].includes(ext)) {
      alert("Please upload an audio file (.wav, .mp3, .ogg, .flac)");
      return;
    }

    if (serverOnline) {
      runRealInference(file);
    } else {
      // Fallback: pick a mock result deterministically from the filename
      const keys = Object.keys(DEMO_RESULTS);
      const idx =
        file.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
        keys.length;
      const key = keys[idx];
      const meta = { fileName: file.name, duration: "—", sr: "—" };
      runMockPipeline(key, meta);
    }
  }

  // ── REAL inference via Flask API ───────────────────────────────
  function runRealInference(file) {
    const meta = {
      fileName: file.name,
      duration: "computing…",
      sr: "computing…",
    };

    showPipelineUI(meta.fileName);
    markStep(0, 400); // Audio Loaded
    markStep(1, 1100); // MFCC (server does this)
    markStep(2, 1900); // GRU inference (server does this)

    const formData = new FormData();
    formData.append("file", file);

    fetch(API_BASE + "/predict", { method: "POST", body: formData })
      .then((r) => {
        if (!r.ok)
          return r
            .json()
            .then((d) => Promise.reject(d.error || "Server error"));
        return r.json();
      })
      .then((data) => {
        // Step 4 — classification done
        document.getElementById("step4Detail").textContent =
          `Classified as "${data.prediction}" (${data.confidence.toFixed(1)}% confidence)`;
        markStep(3, 0);

        // Build result object in the same shape as SAMPLES entries
        const isHealthy = data.prediction === "Healthy";
        const resultObj = {
          prediction: data.prediction,
          isHealthy,
          desc:
            SAMPLES[data.prediction.toLowerCase()]?.desc ||
            `The model classified this audio as ${data.prediction} with ${data.confidence.toFixed(1)}% confidence.`,
          probs: data.probabilities,
          mfcc: data.mfcc_preview,
        };
        const metaFinal = {
          fileName: file.name,
          duration: data.duration_s ? data.duration_s.toFixed(1) + " s" : "—",
          sr: data.sample_rate
            ? (data.sample_rate / 1000).toFixed(1) + " kHz"
            : "—",
        };

        setTimeout(() => showResult(resultObj, metaFinal, true), 600);
      })
      .catch((err) => {
        console.error("[RespiNet] API error:", err);
        // Gracefully fall back to mock
        document.getElementById("step4Detail").textContent =
          "API error — showing demo result";
        markStep(3, 0);
        const keys = Object.keys(DEMO_RESULTS);
        const idx =
          file.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
          keys.length;
        setTimeout(
          () =>
            showResult(
              DEMO_RESULTS[keys[idx]],
              { fileName: file.name, duration: "—", sr: "—" },
              false,
            ),
          600,
        );
      });
  }

  // ── REAL sample via /predict-sample/<disease> ──────────────────
  function runRealSample(key) {
    // Map pill key (e.g. 'bronchiectasis') to the capitalised class name
    const disease =
      CLASSES.find((c) => c.toLowerCase() === key.toLowerCase()) || key;
    const meta = {
      fileName: `dataset sample — ${disease}`,
      duration: "computing…",
      sr: "computing…",
    };

    showPipelineUI(meta.fileName);
    markStep(0, 300);
    markStep(1, 900);
    markStep(2, 1700);

    fetch(`${API_BASE}/predict-sample/${encodeURIComponent(disease)}`)
      .then((r) => {
        if (!r.ok)
          return r
            .json()
            .then((d) => Promise.reject(d.error || "Server error"));
        return r.json();
      })
      .then((data) => {
        document.getElementById("step4Detail").textContent =
          `Classified as “${data.prediction}” (${data.confidence.toFixed(1)}% confidence) — ${data.filename}`;
        markStep(3, 0);

        const isHealthy = data.prediction === "Healthy";
        const fallback = SAMPLES[data.prediction.toLowerCase()];
        const resultObj = {
          prediction: data.prediction,
          isHealthy,
          desc:
            fallback?.desc ||
            `The model classified this audio as ${data.prediction} with ${data.confidence.toFixed(1)}% confidence.`,
          probs: data.probabilities,
          mfcc: data.mfcc_preview,
        };
        const metaFinal = {
          fileName: data.filename,
          duration: data.duration_s ? data.duration_s.toFixed(1) + " s" : "—",
          sr: data.sample_rate
            ? (data.sample_rate / 1000).toFixed(1) + " kHz"
            : "—",
        };

        setTimeout(() => showResult(resultObj, metaFinal, true), 600);
      })
      .catch((err) => {
        console.error("[RespiNet] predict-sample error:", err);
        document.getElementById("step4Detail").textContent =
          `Error: ${err} — falling back to demo`;
        markStep(3, 0);
        setTimeout(() => {
          const fallback = SAMPLES[key] || SAMPLES["healthy"];
          showResult(
            fallback,
            {
              fileName: `${disease} (demo fallback)`,
              duration: fallback.duration,
              sr: fallback.sampleRate,
            },
            false,
          );
        }, 600);
      });
  }

  // ── MOCK pipeline (sample pills or offline fallback) ────────────
  function runMockSample(key) {
    const s = SAMPLES[key];
    const meta = {
      fileName: s.recordingId + ".wav",
      duration: s.duration,
      sr: s.sampleRate,
    };
    runMockPipeline(key, meta);
  }

  function runMockPipeline(key, meta) {
    const s = DEMO_RESULTS[key];
    showPipelineUI(meta.fileName);

    markStep(0, 0);
    markStep(1, 700);
    markStep(2, 1500);

    setTimeout(() => {
      const topProb = Object.entries(s.probs).sort((a, b) => b[1] - a[1])[0];
      document.getElementById("step4Detail").textContent =
        `Classified as "${s.prediction}" (${topProb[1].toFixed(1)}% confidence) [demo]`;
      markStep(3, 0);
    }, 2400);

    setTimeout(() => showResult(s, meta, false), 3200);
  }

  // ── Shared helpers ─────────────────────────────────────────────
  function showPipelineUI(fileName) {
    uploadZone.style.display = "none";
    pipeline.style.display = "flex";
    resultCard.style.display = "none";
    if (predChartInstance) {
      predChartInstance.destroy();
      predChartInstance = null;
    }
    steps.forEach((st) => st.classList.remove("active", "done"));
    document.getElementById("step1Detail").textContent = fileName;
  }

  function markStep(idx, delay) {
    setTimeout(() => {
      steps[idx].classList.add("active");
      setTimeout(() => steps[idx].classList.add("done"), 500);
    }, delay);
  }

  function showResult(s, meta, isReal) {
    const rcDisease = document.getElementById("rcDisease");
    const rcDesc = document.getElementById("rcDesc");
    const rcBadge = document.getElementById("rcBadge");
    const rcConf = document.getElementById("rcConf");
    const rcDur = document.getElementById("rcDur");
    const rcSr = document.getElementById("rcSr");
    const color = CLASS_COLORS[s.prediction] || "#3b82f6";

    rcDisease.textContent = s.prediction + (isReal ? "" : " (demo)");
    rcDisease.style.color = color;
    rcDesc.textContent = s.desc;

    const topConf = Object.entries(s.probs).sort((a, b) => b[1] - a[1])[0][1];
    rcConf.textContent = topConf.toFixed(1) + "%" + (isReal ? "" : " (demo)");
    rcDur.textContent = meta.duration;
    rcSr.textContent = meta.sr;

    rcBadge.textContent = s.isHealthy ? "✅ Healthy" : "⚠️ Disease Detected";
    rcBadge.className = "rc-badge " + (s.isHealthy ? "healthy" : "disease");

    resultCard.style.display = "block";

    const entries = Object.entries(s.probs).sort((a, b) => b[1] - a[1]);
    const ctx = document.getElementById("predChart");
    if (predChartInstance) predChartInstance.destroy();
    predChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [
          {
            label: "Probability (%)",
            data: entries.map((e) => +e[1].toFixed(2)),
            backgroundColor: entries.map(
              (e) => CLASS_COLORS[e[0]] || "#3b82f6",
            ),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c) => ` ${c.parsed.x.toFixed(2)}%` },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => v + "%" },
            grid: { color: "#f1f5f9" },
          },
          y: { grid: { display: false } },
        },
      },
    });
  }

  function resetDemo() {
    // Show whichever input pane was active
    const activeTab = document.querySelector(".dit-tab.active");
    const pane = activeTab ? activeTab.dataset.dit : "upload";
    uploadZone.style.display = pane === "upload" ? "" : "none";
    recordZone.style.display = pane === "record" ? "" : "none";
    pipeline.style.display = "none";
    resultCard.style.display = "none";
    if (predChartInstance) {
      predChartInstance.destroy();
      predChartInstance = null;
    }
    steps.forEach((st) => st.classList.remove("active", "done"));
    fileInput.value = "";
  }

  // Expose so initRecorder can call it
  _handleFile = handleFile;
})();

/* ────────────────────────────────────────────────────────────────
   WAV encoder  (raw PCM Float32 → 16-bit WAV Blob)
   ──────────────────────────────────────────────────────────────── */
function encodeWAV(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  function str(offset, s) {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  }

  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

/* ────────────────────────────────────────────────────────────────
   RECORDER  (microphone → 16-bit PCM WAV, hard limit 30 s)
   ──────────────────────────────────────────────────────────────── */
(function initRecorder() {
  const HARD_LIMIT_S = 30;
  const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 in the SVG

  const recBtn = document.getElementById("recBtn");
  const recStopBtn = document.getElementById("recStopBtn");
  const recTimer = document.getElementById("recTimer");
  const recStatus = document.getElementById("recStatus");
  const recCanvas = document.getElementById("recCanvas");
  const recPreview = document.getElementById("recPreview");
  const recAudio = document.getElementById("recAudio");
  const recPreviewInfo = document.getElementById("recPreviewInfo");
  const recSendBtn = document.getElementById("recSendBtn");
  const rerecBtn = document.getElementById("rerecBtn");
  const ringProg = document.getElementById("recRingProgress");

  // Ring initialised at full (no time elapsed)
  ringProg.style.strokeDashoffset = "0";

  let audioCtx = null;
  let stream = null;
  let processor = null;
  let analyser = null;
  let source = null;
  let pcmChunks = [];
  let sampleRate = 44100;
  let isRecording = false;
  let startTime = null;
  let rafId = null;
  let intervalId = null;
  let wavBlob = null;

  recBtn.addEventListener("click", startRecording);
  recStopBtn.addEventListener("click", stopRecording);
  recSendBtn.addEventListener("click", sendRecording);
  rerecBtn.addEventListener("click", resetRecorder);

  async function startRecording() {
    setState("requesting");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (err) {
      setState("idle");
      recStatus.textContent = "Microphone access denied — " + err.message;
      return;
    }

    audioCtx = new AudioContext();
    sampleRate = audioCtx.sampleRate;
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    pcmChunks = [];
    isRecording = true;

    source.connect(analyser);
    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (e) => {
      if (!isRecording) return;
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= HARD_LIMIT_S) {
        stopRecording();
        return;
      }
      pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    startTime = Date.now();
    setState("recording");
    tickTimer();
    intervalId = setInterval(tickTimer, 100);
    drawWaveform();
  }

  function tickTimer() {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, HARD_LIMIT_S - elapsed);
    const secsLeft = Math.ceil(remaining);

    recTimer.textContent = secsLeft;

    // Colour states
    const isWarning = remaining <= 10 && remaining > 5;
    const isDanger = remaining <= 5;
    recTimer.classList.toggle("warning", isWarning);
    recTimer.classList.toggle("danger", isDanger);
    ringProg.classList.toggle("warning", isWarning);
    ringProg.classList.toggle("danger", isDanger);

    // SVG ring drains clockwise
    const fraction = remaining / HARD_LIMIT_S;
    ringProg.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

    if (remaining <= 0) stopRecording();
  }

  function drawWaveform() {
    if (!isRecording) return;
    rafId = requestAnimationFrame(drawWaveform);

    const canvas = recCanvas;
    const ctx = canvas.getContext("2d");
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ef4444";
    ctx.beginPath();
    const sliceW = canvas.width / buf.length;
    let x = 0;
    for (let i = 0; i < buf.length; i++) {
      const y = (buf[i] / 128) * (canvas.height / 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    clearInterval(intervalId);
    cancelAnimationFrame(rafId);

    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }
    if (source) source.disconnect();
    if (audioCtx) audioCtx.close();

    // Merge PCM chunks → WAV
    const total = pcmChunks.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of pcmChunks) {
      merged.set(c, off);
      off += c.length;
    }

    wavBlob = encodeWAV(merged, sampleRate);
    const url = URL.createObjectURL(wavBlob);
    recAudio.src = url;

    const durS = (total / sampleRate).toFixed(1);
    const kb = (wavBlob.size / 1024).toFixed(1);
    recPreviewInfo.textContent = `Duration: ${durS}s  ·  Size: ${kb} KB  ·  ${sampleRate} Hz mono WAV`;

    setState("recorded");
  }

  function sendRecording() {
    if (!wavBlob || !_handleFile) return;
    const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
    // Switch to upload-pane view so the pipeline card appears correctly
    document
      .querySelectorAll(".dit-tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.dit === "upload"));
    document.getElementById("uploadZone").style.display = "none";
    document.getElementById("recordZone").style.display = "none";
    _handleFile(file);
  }

  function resetRecorder() {
    setState("idle");
  }

  function setState(s) {
    recBtn.style.display = s === "idle" ? "" : "none";
    recStopBtn.style.display = s === "recording" ? "" : "none";
    recCanvas.classList.toggle("active", s === "recording");
    recPreview.style.display = s === "recorded" ? "" : "none";
    recStatus.classList.toggle("active", s === "recording");

    if (s === "idle") {
      recTimer.textContent = HARD_LIMIT_S;
      recTimer.className = "rec-timer";
      ringProg.className = "rec-ring-progress";
      ringProg.style.strokeDashoffset = "0";
      recStatus.textContent = `Max ${HARD_LIMIT_S} seconds — click to start`;
      if (recAudio.src) URL.revokeObjectURL(recAudio.src);
      recAudio.src = "";
      wavBlob = null;
    } else if (s === "requesting") {
      recStatus.textContent = "Requesting microphone access…";
    } else if (s === "recording") {
      recStatus.textContent = "Recording… speak into your microphone";
    } else if (s === "recorded") {
      recStatus.textContent = "Recording complete — review and send below";
    }
  }
})();

/* ════════════════════════════════════════════════════════════════
   Active nav-link highlight on scroll
   ════════════════════════════════════════════════════════════════ */
(function initActiveLink() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-links a");

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          navLinks.forEach((a) => a.classList.remove("active"));
          const link = document.querySelector(
            `.nav-links a[href="#${e.target.id}"]`,
          );
          if (link) link.classList.add("active");
        }
      });
    },
    { threshold: 0.35 },
  );

  sections.forEach((s) => io.observe(s));
})();

console.log(
  "%c🫁 RespiNet loaded",
  "color:#3b82f6;font-weight:bold;font-size:14px",
);
