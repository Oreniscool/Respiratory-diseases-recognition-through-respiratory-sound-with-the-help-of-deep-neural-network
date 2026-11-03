import { useState } from "react";
import type { CopyClip } from "../../../../content/storyData";
import { LABEL, SMALL } from "./chartText";

const W = 560, H = 190, PAD = 16, LANE_Y = 70, LANE_H = 34;
/** Three neutral shades for Kaggle's file-name groups (identity, never text). */
const GROUP_FILLS = ["var(--color-accent)", "var(--color-fill-strong)", "var(--color-ink-soft)"];

/** One ICBHI recording on a time axis, with the Kaggle clips cut from it at their offsets, coloured by file-name group. */
export function RecordingTimeline({ reference, clips }: { reference: string; clips: CopyClip[] }) {
  const [active, setActive] = useState<number | null>(null);
  const end = Math.max(...clips.map((c) => c.offset + c.seconds));
  const x = (s: number) => PAD + (s / end) * (W - 2 * PAD);
  const groups = [...new Set(clips.map((c) => c.group))];
  const shown = active === null ? null : clips[active]!;
  return (
    <figure className="m-0 space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group"
           aria-label={`ICBHI recording ${reference}: ${clips.length} Kaggle clips cut back to back, filed under ${groups.length} different file-name groups`}>
        <text x={PAD} y={22} style={LABEL}>ICBHI {reference}</text>
        <rect x={x(0)} y={LANE_Y - 22} width={x(end) - x(0)} height={12} rx={3} fill="var(--color-track)" />
        <text x={x(end)} y={LANE_Y - 28} textAnchor="end" style={SMALL}>one recording, one patient</text>
        {clips.map((c, i) => (
          <g key={c.clip} data-copy tabIndex={0} role="button" aria-label={`${c.clip} at ${c.offset} s, score ${c.ncc}`}
             onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} style={{ cursor: "pointer" }}>
            <rect x={x(c.offset) + 1} y={LANE_Y} width={x(c.seconds) - x(0) - 2} height={LANE_H} rx={3}
                  fill={GROUP_FILLS[groups.indexOf(c.group) % GROUP_FILLS.length]} opacity={active === null || active === i ? 1 : 0.45} />
          </g>
        ))}
        {groups.map((g) => {
          const members = clips.filter((c) => c.group === g);
          const a = x(members[0]!.offset), b = x(members[members.length - 1]!.offset + members[members.length - 1]!.seconds);
          return (
            <g key={g}>
              <path d={`M${a + 2},${LANE_Y + LANE_H + 8} v6 H${b - 2} v-6`} fill="none" stroke="var(--color-ink-soft)" />
              <text x={Math.min(Math.max((a + b) / 2, PAD + 40), W - PAD - 40)} y={LANE_Y + LANE_H + 30} textAnchor="middle" style={LABEL}>Kaggle "{g}"</text>
              <text x={Math.min(Math.max((a + b) / 2, PAD + 40), W - PAD - 40)} y={LANE_Y + LANE_H + 44} textAnchor="middle" style={SMALL}>
                {members.length} {members.length === 1 ? "clip" : "clips"}
              </text>
            </g>
          );
        })}
        {[0, 20, 40, 60].filter((s) => s <= end).map((s) => (
          <text key={s} x={x(s)} y={H - 6} textAnchor="middle" style={SMALL}>{s} s</text>
        ))}
      </svg>
      <p data-copy-detail aria-live="polite" className="m-0 min-h-[1.5rem] text-sm text-ink">
        {shown
          ? <>Kaggle file <span className="font-semibold">{shown.clip}</span>: {shown.seconds} s from {shown.offset} s, match score <span className="tabular font-semibold">{shown.ncc.toFixed(4)}</span></>
          : "Point at a clip to see its Kaggle file name and match score."}
      </p>
    </figure>
  );
}
