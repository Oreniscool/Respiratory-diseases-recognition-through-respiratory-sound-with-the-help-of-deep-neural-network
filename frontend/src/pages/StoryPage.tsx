import { Link } from "react-router";
import { StoryShell } from "../features/story/StoryShell";
import { Stage } from "../features/three/Stage";
import { S00Opening } from "../features/story/scenes/S00Opening";
import { S01Listening } from "../features/story/scenes/S01Listening";
import { SOrigin } from "../features/story/scenes/SOrigin";
import { SLeaks } from "../features/story/scenes/SLeaks";
import { SPatients } from "../features/story/scenes/SPatients";
import { SClasses } from "../features/story/scenes/SClasses";
import { SMatch } from "../features/story/scenes/SMatch";
import { SGap } from "../features/story/scenes/SGap";
import { SProvenance } from "../features/story/scenes/SProvenance";
import { SOneRecording } from "../features/story/scenes/SOneRecording";
import { SChecks } from "../features/story/scenes/SChecks";
import { SConsequence } from "../features/story/scenes/SConsequence";
import { SPaper } from "../features/story/scenes/SPaper";
import { S02Data } from "../features/story/scenes/S02Data";
import { S03Cleaning } from "../features/story/scenes/S03Cleaning";
import { S04Slicing } from "../features/story/scenes/S04Slicing";
import { S05Fingerprint } from "../features/story/scenes/S05Fingerprint";
import { S06Network } from "../features/story/scenes/S06Network";
import { STraining } from "../features/story/scenes/STraining";
import { SLearning } from "../features/story/scenes/SLearning";
import { S07Seeds } from "../features/story/scenes/S07Seeds";
import { SSelection } from "../features/story/scenes/SSelection";
import { S08Vote } from "../features/story/scenes/S08Vote";
import { S09Confidence } from "../features/story/scenes/S09Confidence";
import { S10Abstain } from "../features/story/scenes/S10Abstain";
import { S11Challenges } from "../features/story/scenes/S11Challenges";
import { S12Performance } from "../features/story/scenes/S12Performance";
import { SServer } from "../features/story/scenes/SServer";
import { S13EndToEnd } from "../features/story/scenes/S13EndToEnd";
import { STakeaways } from "../features/story/scenes/STakeaways";
import { Analyzer } from "../features/analyzer/Analyzer";

/** The scenes in story order; this order must match SCENES in features/story/scenes.ts (presenter steps). */
export function StoryPage() {
  return (
    <StoryShell>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-4 lg:px-12">
        <span className="font-serif text-xl text-ink">RespiNet</span>
        <Link to="/analyze" className="rounded-full border border-ink px-4 py-1.5 text-sm font-semibold text-ink hover:bg-track">Try it</Link>
      </header>
      <Stage />
      <main data-testid="story-page" className="relative">
        {/* Chapter 1: where it began */}
        <S00Opening />
        <S01Listening />
        <SOrigin />
        <SLeaks />
        <SPatients />
        {/* Chapter 2: the discovery */}
        <SClasses />
        <SMatch />
        <SGap />
        <SProvenance />
        <SOneRecording />
        <SChecks />
        <SConsequence />
        <SPaper />
        {/* Chapter 3: from sound to features */}
        <S02Data />
        <S03Cleaning />
        <S04Slicing />
        <S05Fingerprint />
        {/* Chapter 4: the model */}
        <S06Network />
        <STraining />
        <SLearning />
        <S07Seeds />
        <SSelection />
        <S08Vote />
        <S09Confidence />
        <S10Abstain />
        {/* Chapter 5: results and the system */}
        <S11Challenges />
        <S12Performance />
        <SServer />
        <S13EndToEnd />
        <STakeaways />
        <section id="try" aria-label="Try it" className="relative z-10 mx-auto max-w-5xl px-6 py-24">
          <Analyzer />
        </section>
      </main>
    </StoryShell>
  );
}
