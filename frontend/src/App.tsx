import { Navigate, Route, Routes } from "react-router";
import { StoryPage } from "./pages/StoryPage";
import { AnalyzePage } from "./pages/AnalyzePage";
import { StagePreview } from "./dev/StagePreview";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StoryPage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      {import.meta.env.DEV && <Route path="/__stage" element={<StagePreview />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
