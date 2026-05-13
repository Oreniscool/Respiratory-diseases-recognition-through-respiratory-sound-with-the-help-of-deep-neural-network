import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DiagnosePage from "./pages/DiagnosePage";
import DiseasesPage from "./pages/DiseasesPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import MetricsPage from "./pages/MetricsPage";
import ChatPage from "./pages/ChatPage";
import ReportPage from "./pages/ReportPage";
import ExplainabilityPage from "./pages/ExplainabilityPage";

export default function App() {
  return (
    <div
      className="scan-overlay min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <Navbar />
      <main>
        <Routes>
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
      </main>
    </div>
  );
}
