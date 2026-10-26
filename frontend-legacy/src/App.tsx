import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AnalyzePage = lazy(() => import("./pages/AnalyzePage"));
const EvidencePage = lazy(() => import("./pages/EvidencePage"));
const LearnPage = lazy(() => import("./pages/LearnPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const ExplainabilityPage = lazy(() => import("./pages/ExplainabilityPage"));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-dot" />
      Loading workspace…
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -6 },
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeInOut",
  duration: 0.22,
};

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <div className="app-shell">
      {!isLanding && <Navbar />}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          className={isLanding ? "" : "route-stage"}
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/analyze" element={<AnalyzePage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/explainability" element={<ExplainabilityPage />} />

              {/* Legacy redirects */}
              <Route path="/diagnose" element={<Navigate to="/analyze" replace />} />
              <Route path="/diseases" element={<Navigate to="/learn" replace />} />
              <Route path="/chat" element={<Navigate to="/learn" replace />} />
              <Route path="/how-it-works" element={<Navigate to="/evidence" replace />} />
              <Route path="/metrics" element={<Navigate to="/evidence" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
