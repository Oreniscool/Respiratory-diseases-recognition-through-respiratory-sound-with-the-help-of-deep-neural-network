import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Pause, Play } from "./icons";

const BARS = 14;
/** only one clip plays at a time across the page */
let current: HTMLAudioElement | null = null;
let context: AudioContext | null = null;

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** Min/max peak pairs as a filled waveform path in a 1000 × height box, scaled to the clip's own peak. */
function wavePath(peaks: Float32Array, height: number): string {
  const n = peaks.length / 2, mid = height / 2;
  let max = 1e-6;
  for (const v of peaks) max = Math.max(max, Math.abs(v));
  const y = (v: number) => (mid - (v / max) * mid * 0.95).toFixed(1);
  let top = "", bottom = "";
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 1000).toFixed(1);
    top += `${i ? "L" : "M"}${x},${y(peaks[2 * i + 1]!)}`;
    bottom = `L${x},${y(peaks[2 * i]!)}` + bottom;
  }
  return `${top}${bottom}Z`;
}

/**
 * A clip player that fits the story: a play button, a live frequency visualiser that moves with the sound, and the
 * clip's own waveform as the seek bar (it fills as the clip plays; click, drag or use the arrow keys to move).
 */
export function AudioPlayer({ src, peaks, label, height = 52 }: { src: string; peaks: Float32Array | null; label: string; height?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const fill = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const id = useId();

  // one frame loop while playing: progress, playhead and the visualiser bars, written straight to the DOM
  useEffect(() => {
    if (!playing) {
      bars.current.forEach((b) => { if (b) b.style.transform = "scaleY(0.12)"; });
      return;
    }
    let frame = 0;
    const data = new Uint8Array(256);
    const tick = () => {
      const el = audio.current;
      if (el && el.duration) {
        const p = el.currentTime / el.duration;
        if (fill.current) fill.current.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
        if (head.current) head.current.style.left = `${p * 100}%`;
        setTime({ now: el.currentTime, total: el.duration });
      }
      const a = analyser.current;
      if (a) {
        a.getByteFrequencyData(data);
        // low bins carry the breath band: spread 0 to ~10 kHz over the bars on a curve that favours the low end
        bars.current.forEach((b, i) => {
          const lo = Math.floor((i / BARS) ** 1.6 * 120), hi = Math.max(lo + 1, Math.floor(((i + 1) / BARS) ** 1.6 * 120));
          let peak = 0;
          for (let k = lo; k < hi; k++) peak = Math.max(peak, data[k]!);
          if (b) b.style.transform = `scaleY(${Math.max(0.12, peak / 255)})`;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const connect = () => {
    const el = audio.current;
    if (!el || analyser.current) return;
    try {
      context ??= new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0.7;
      context.createMediaElementSource(el).connect(node);
      node.connect(context.destination);
      analyser.current = node;
    } catch {
      // no Web Audio: the clip still plays, the visualiser stays still
    }
  };

  const toggle = async () => {
    const el = audio.current;
    if (!el) return;
    if (!el.paused) { el.pause(); return; }
    connect();
    if (current && current !== el) current.pause();
    current = el;
    await context?.resume().catch(() => {});
    await el.play().catch(() => {});
  };

  const seekTo = (fraction: number) => {
    const el = audio.current;
    if (!el || !el.duration) return;
    el.currentTime = Math.min(el.duration, Math.max(0, fraction * el.duration));
    const p = el.currentTime / el.duration;
    if (fill.current) fill.current.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
    if (head.current) head.current.style.left = `${p * 100}%`;
    setTime({ now: el.currentTime, total: el.duration });
  };
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el?.duration) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // the presenter's arrow keys stay on the page, not on the clip
    seekTo((el.currentTime + step) / el.duration);
  };

  const path = peaks ? wavePath(peaks, height) : "";
  return (
    <div className="flex items-center gap-3">
      <audio ref={audio} src={src} preload="metadata" crossOrigin="anonymous"
             onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
             onEnded={() => { setPlaying(false); seekTo(0); }}
             onLoadedMetadata={(e) => setTime({ now: 0, total: e.currentTarget.duration })} />
      <button type="button" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"}: ${label}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-paper shadow-sm transition hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
      </button>
      <div aria-hidden="true" className="flex h-9 w-14 shrink-0 items-end gap-[2px]">
        {Array.from({ length: BARS }, (_, i) => (
          <span key={i} ref={(b) => { bars.current[i] = b; }}
                className="block h-full flex-1 origin-bottom rounded-full bg-fill-strong transition-transform duration-75"
                style={{ transform: "scaleY(0.12)" }} />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div role="slider" tabIndex={0} aria-labelledby={id} aria-valuemin={0} aria-valuemax={Math.round(time.total)}
             aria-valuenow={Math.round(time.now)} aria-valuetext={`${clock(time.now)} of ${clock(time.total)}`}
             onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
             onPointerMove={(e) => { if (e.buttons) fromPointer(e); }} onKeyDown={onKey}
             className="relative cursor-pointer touch-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
             style={{ height }}>
          <span id={id} className="sr-only">Position in {label}</span>
          <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <path d={path} fill="#c9d6b3" />
          </svg>
          <div ref={fill} className="absolute inset-0" style={{ clipPath: "inset(0 100% 0 0)" }} aria-hidden="true">
            <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" className="h-full w-full"><path d={path} fill="var(--color-accent)" /></svg>
          </div>
          <div ref={head} className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: 0 }} aria-hidden="true" />
        </div>
        <div className="tabular mt-1 flex justify-between text-[11px] text-ink-muted" aria-hidden="true">
          <span>{clock(time.now)}</span><span>{clock(time.total)}</span>
        </div>
      </div>
    </div>
  );
}
