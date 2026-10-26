import { Check } from "../../components/icons";
import { MEMBER_INFO, memberTop } from "../../content/members";
import type { PredictResult } from "../../lib/api/types";
import { agreement } from "./result";

export function MemberVotes({ result }: { result: PredictResult }) {
  const votes = agreement(result);
  if (!votes || !result.members) return null;
  return (
    <div className="space-y-3">
      <h3 className="m-0">How the four models voted</h3>
      <p className="m-0 text-sm text-ink-muted">Each scored the recording on its own; the fusion averages them. <strong className="text-ink">{votes.agree} of {votes.total} agree</strong>.</p>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {result.members.map((m) => {
          const top = memberTop(m);
          const agrees = top.label === result.model_prediction;
          return (
            <li key={m.name} className="rounded-xl border border-line bg-paper-raised p-4">
              <div className="text-sm font-semibold text-ink">{MEMBER_INFO[m.name]?.label ?? m.name}</div>
              <div className="mb-2 text-xs text-ink-muted">{MEMBER_INFO[m.name]?.description}</div>
              <div className="font-serif text-2xl text-ink">{top.label} <span className="tabular font-sans text-sm text-ink-muted">{top.score.toFixed(1)}%</span></div>
              <div className={`mt-2 inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${agrees ? "text-accent" : "text-warn"}`}>
                {agrees ? <Check size={14} /> : <span aria-hidden="true">≠</span>}{agrees ? "Agrees" : "Disagrees"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
