import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";

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

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="route-stage">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<AnalyzePage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/explainability" element={<ExplainabilityPage />} />

            <Route path="/diagnose" element={<Navigate to="/" replace />} />
            <Route path="/diseases" element={<Navigate to="/learn" replace />} />
            <Route path="/chat" element={<Navigate to="/learn" replace />} />
            <Route path="/how-it-works" element={<Navigate to="/evidence" replace />} />
            <Route path="/metrics" element={<Navigate to="/evidence" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
