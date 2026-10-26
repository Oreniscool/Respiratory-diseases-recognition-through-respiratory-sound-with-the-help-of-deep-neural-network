import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Button } from "../../components/Button";
import type { PredictResult } from "../../lib/api/types";
import { AllScores } from "./AllScores";
import { MemberVotes } from "./MemberVotes";
import { Verdict } from "./Verdict";
import { WindowStrip } from "./WindowStrip";

function Reveal({ children }: { children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} className="border-t border-line pt-8">
      {children}
    </motion.section>
  );
}

/** The story report: verdict, then why (the votes), then where (the windows), then every score. */
export function ResultView({ result, onExplain }: { result: PredictResult; onExplain?: () => void }) {
  return (
    <div className="space-y-8">
      <Verdict result={result} />
      {result.members?.length ? <Reveal><MemberVotes result={result} /></Reveal> : null}
      {result.window_scores?.length ? <Reveal><WindowStrip result={result} /></Reveal> : null}
      <Reveal><AllScores result={result} /></Reveal>
      {onExplain && (
        <Reveal>
          <Button variant="secondary" onClick={onExplain}>Where did the model listen?</Button>
        </Reveal>
      )}
    </div>
  );
}
