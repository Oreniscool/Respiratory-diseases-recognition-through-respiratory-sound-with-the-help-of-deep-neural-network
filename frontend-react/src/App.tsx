import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import Navbar from "./components/Navbar";
import AmbientEffects from "./components/AmbientEffects";
import HomePage from "./pages/HomePage";
import DiagnosePage from "./pages/DiagnosePage";
import DiseasesPage from "./pages/DiseasesPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import MetricsPage from "./pages/MetricsPage";
import ChatPage from "./pages/ChatPage";
import ReportPage from "./pages/ReportPage";
import ExplainabilityPage from "./pages/ExplainabilityPage";

export default function App() {
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="min-h-screen app-shell"
        style={{ background: "var(--bg-primary)" }}
      >
        <AmbientEffects />
        <Navbar />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            className="route-stage"
            initial={{ opacity: 0, y: 14, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/diagnose" element={<DiagnosePage />} />
              <Route path="/diseases" element={<DiseasesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/explainability" element={<ExplainabilityPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.main>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
