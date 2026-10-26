import { Link } from "react-router";
import { StoryShell } from "../features/story/StoryShell";
import { Stage } from "../features/three/Stage";
import { S00Opening } from "../features/story/scenes/S00Opening";
import { S01Listening } from "../features/story/scenes/S01Listening";
import { S02Data } from "../features/story/scenes/S02Data";
import { S03Cleaning } from "../features/story/scenes/S03Cleaning";
import { S04Slicing } from "../features/story/scenes/S04Slicing";
import { S05Fingerprint } from "../features/story/scenes/S05Fingerprint";

export function StoryPage() {
  return (
    <StoryShell>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-4 lg:px-12">
        <span className="font-serif text-xl text-ink">RespiNet</span>
        <Link to="/analyze" className="rounded-full border border-ink px-4 py-1.5 text-sm font-semibold text-ink hover:bg-track">Try it</Link>
      </header>
      <Stage />
      <main data-testid="story-page" className="relative">
        <S00Opening />
        <S01Listening />
        <S02Data />
        <S03Cleaning />
        <S04Slicing />
        <S05Fingerprint />
      </main>
    </StoryShell>
  );
}
