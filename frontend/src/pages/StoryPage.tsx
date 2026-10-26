import { Link } from "react-router";
import { StoryShell } from "../features/story/StoryShell";
import { Stage } from "../features/three/Stage";
import { S00Opening } from "../features/story/scenes/S00Opening";
import { S01Listening } from "../features/story/scenes/S01Listening";
import { S02Data } from "../features/story/scenes/S02Data";
import { S03Cleaning } from "../features/story/scenes/S03Cleaning";
import { S04Slicing } from "../features/story/scenes/S04Slicing";
import { S05Fingerprint } from "../features/story/scenes/S05Fingerprint";
import { S06Network } from "../features/story/scenes/S06Network";
import { S07Seeds } from "../features/story/scenes/S07Seeds";
import { S08Vote } from "../features/story/scenes/S08Vote";
import { S09Confidence } from "../features/story/scenes/S09Confidence";
import { S10Abstain } from "../features/story/scenes/S10Abstain";
import { S11Challenges } from "../features/story/scenes/S11Challenges";
import { S12Performance } from "../features/story/scenes/S12Performance";
import { S13EndToEnd } from "../features/story/scenes/S13EndToEnd";
import { Analyzer } from "../features/analyzer/Analyzer";

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
        <S06Network />
        <S07Seeds />
        <S08Vote />
        <S09Confidence />
        <S10Abstain />
        <S11Challenges />
        <S12Performance />
        <S13EndToEnd />
        <section id="try" aria-label="Try it" className="relative z-10 mx-auto max-w-5xl px-6 py-24">
          <Analyzer />
        </section>
      </main>
    </StoryShell>
  );
}
