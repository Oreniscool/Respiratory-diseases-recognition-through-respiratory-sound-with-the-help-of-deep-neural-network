import { FACTS } from "../../../../content/facts";
import { Glyph, type GlyphName } from "../../../../components/glyphs";
import type { AudioAnalysis } from "../../../../lib/audio/analyze";
import { Waveform } from "./Waveform";

const LOW = FACTS.bandLowHz.value, HIGH = FACTS.bandHighHz.value;

type Zone = { glyph: GlyphName; title: string; range: string; kept: boolean; from: number; to: number };

/**
 * Scene 3's infographic: the frequency range split into what the band-pass removes and what it keeps,
 * then the sample recording before and after the filter.
 */
export function FilterBands({ analysis }: { analysis: AudioAnalysis }) {
  const nyquist = analysis.sampleRate / 2;
  // log frequency axis from 20 Hz to the Nyquist frequency, as widths in percent
  const at = (hz: number) => (Math.log(hz / 20) / Math.log(nyquist / 20)) * 100;
  const zones: Zone[] = [
    { glyph: "heartbeat", title: "Heartbeat thuds", range: `below ${FACTS.bandLowHz.display} Hz`, kept: false, from: 20, to: LOW },
    { glyph: "breath", title: "Breath sounds", range: `${FACTS.bandLowHz.display}–${FACTS.bandHighHz.display} Hz`, kept: true, from: LOW, to: HIGH },
    { glyph: "noise", title: "Sensor noise", range: `above ${HIGH / 1000} kHz`, kept: false, from: HIGH, to: nyquist },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow m-0 mb-2 text-ink-muted">Pitch, low to high</p>
        <div className="flex h-36 overflow-hidden rounded-xl border border-line">
          {zones.map((z) => (
            <div key={z.title} data-zone data-kept={z.kept || undefined} style={{ width: `${at(z.to) - at(z.from)}%` }}
                 className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 text-center ${z.kept ? "bg-[#e9f7d4]" : "bg-track"}`}>
              {!z.kept && <span data-cut aria-hidden="true" className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_7px,rgba(85,98,63,0.16)_7px_9px)]" />}
              <span className={`relative flex size-9 items-center justify-center rounded-full border-2 bg-paper-raised ${z.kept ? "border-accent text-accent" : "border-ink-soft text-ink-soft"}`}>
                <Glyph name={z.glyph} size={18} />
              </span>
              <span className="relative text-[13px] font-semibold leading-tight text-ink">{z.title}</span>
              <span className="relative tabular text-[12px] leading-tight text-ink-muted">{z.range}</span>
              <span data-verdict className={`relative rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${z.kept ? "bg-accent text-paper" : "bg-paper-raised text-ink-soft"}`}>
                {z.kept ? "kept" : "removed"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="m-0 flex items-baseline justify-between text-sm"><span className="font-semibold text-ink">Before</span><span className="text-ink-muted">the recording as captured</span></p>
        <div data-before className="rounded-lg bg-paper-raised px-3 py-2"><Waveform peaks={analysis.waveform} height={56} color="#9aa58a" fit /></div>
        <p data-filter-step className="m-0 py-1 text-center text-sm text-ink-muted">↓ band-pass filter keeps only the breath sounds ↓</p>
        <p className="m-0 flex items-baseline justify-between text-sm"><span className="font-semibold text-ink">After</span><span className="text-ink-muted">what the model hears</span></p>
        <div className="overflow-hidden rounded-lg bg-paper-raised px-3 py-2"><div data-after><Waveform peaks={analysis.filtered} height={56} fit /></div></div>
        <p className="m-0 text-[11px] text-ink-muted">Each waveform is scaled to fit its box.</p>
      </div>
    </div>
  );
}
