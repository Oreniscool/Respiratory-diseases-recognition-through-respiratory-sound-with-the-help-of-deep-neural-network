import { Navigate, Route, Routes } from "react-router";
import { StoryPage } from "./pages/StoryPage";
import { AnalyzePage } from "./pages/AnalyzePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StoryPage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
