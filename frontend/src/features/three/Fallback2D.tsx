import { SAMPLE } from "../../content/facts";
import { memberLabel, memberTop } from "../../content/members";
import { classColor } from "../../components/classColors";
import type { StageGroup } from "./stage";

/** 2D versions of the three 3D scenes, for browsers without WebGL and for reduced motion. */
export function Fallback2D({ group }: { group: StageGroup | null }) {
  if (!group) return null;
  return (
    <div data-testid="stage-fallback" className="flex h-full w-full items-center justify-center p-8">
      {group === "lungs" && <LungsSvg />}
      {group === "network" && <NetworkSvg />}
      {group === "fusion" && <FusionSvg />}
    </div>
  );
}

function LungsSvg() {
  return (
    <svg viewBox="0 0 400 420" className="h-[70vh] max-h-[560px] w-auto" aria-hidden="true">
      <path d="M182 150 C120 120 70 190 62 280 C56 350 92 392 150 388 C178 386 186 360 186 330 Z" fill="#e7eed9" stroke="#76aa22" strokeWidth="2" />
      <path d="M218 150 C282 118 336 192 340 286 C344 352 306 394 252 388 C226 385 214 362 214 332 L214 250 C230 246 236 232 226 220 Z" fill="#e7eed9" stroke="#76aa22" strokeWidth="2" />
      <g stroke="#198076" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M200 40 V150" />
        <path d="M200 150 C190 175 165 190 140 215 M200 150 C210 175 235 190 262 215" />
        <path d="M140 215 L112 260 M140 215 L150 270 M262 215 L290 260 M262 215 L250 272" strokeWidth="3" />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="200" cy="250" r={70 + i * 55} fill="none" stroke="#93d52a" strokeOpacity={0.5 - i * 0.14} strokeWidth="2" />
      ))}
    </svg>
  );
}

const LAYERS = ["Multi-scale conv", "BiGRU-128", "BiGRU-64", "Dual pooling", "Dense"];

function NetworkSvg() {
  return (
    <svg viewBox="0 0 760 260" className="w-full max-w-4xl" aria-hidden="true">
      {LAYERS.map((name, i) => (
        <g key={name} transform={`translate(${20 + i * 150} 70)`}>
          <rect width="118" height="120" rx="14" fill="#ffffff" stroke="#198076" strokeWidth="2" />
          <text x="59" y="66" textAnchor="middle" style={{ font: "600 13px var(--font-sans)", fill: "#1e2b08" }}>{name}</text>
          {i < LAYERS.length - 1 && <path d={`M122 60 h24`} stroke="#76aa22" strokeWidth="3" markerEnd="url(#arrow)" />}
        </g>
      ))}
      <path d="M80 66 C 160 0, 300 0, 380 66" fill="none" stroke="#93d52a" strokeWidth="3" strokeDasharray="6 6" />
      <text x="230" y="22" textAnchor="middle" style={{ font: "12px var(--font-sans)", fill: "#3c5610" }}>residual skip</text>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#76aa22" />
        </marker>
      </defs>
    </svg>
  );
}

function FusionSvg() {
  const members = SAMPLE.members ?? [];
  const fused = SAMPLE.probabilities[SAMPLE.model_prediction] ?? SAMPLE.confidence;
  return (
    <div className="flex w-full max-w-3xl items-end justify-center gap-6">
      {members.map((m) => {
        const top = memberTop(m);
        return (
          <div key={m.name} className="flex w-24 flex-col items-center gap-2 text-center">
            <span className="tabular text-sm text-ink">{top.label} {top.score.toFixed(1)}%</span>
            <span className="block w-12 rounded-t-md" style={{ height: `${top.score * 2.4}px`, background: classColor(top.label) }} />
            <span className="text-sm font-semibold text-ink">{memberLabel(m.name)}</span>
          </div>
        );
      })}
      <div className="ml-6 flex w-28 flex-col items-center gap-2 text-center">
        <span className="tabular text-sm font-semibold text-ink">{SAMPLE.model_prediction} {fused.toFixed(1)}%</span>
        <span className="block w-16 rounded-t-md bg-accent" style={{ height: `${fused * 2.4}px` }} />
        <span className="text-sm font-semibold text-accent">Fused</span>
      </div>
    </div>
  );
}
