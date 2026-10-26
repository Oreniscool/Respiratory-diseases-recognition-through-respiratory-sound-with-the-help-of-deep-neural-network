import { Link } from "react-router";
import { Analyzer } from "../features/analyzer/Analyzer";

export function AnalyzePage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <Link to="/" className="font-serif text-xl text-ink">RespiNet</Link>
        <Link to="/" className="text-sm font-semibold text-ink-muted hover:text-ink">← The story</Link>
      </header>
      <main data-testid="analyze-page" className="mx-auto max-w-5xl px-6 pb-24 pt-8">
        <Analyzer />
      </main>
    </div>
  );
}
