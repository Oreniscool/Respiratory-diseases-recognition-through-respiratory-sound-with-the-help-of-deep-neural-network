import { useEffect, useRef, useState } from "react";
import AudioLines from "lucide-react/dist/esm/icons/audio-lines.js";

interface AudioVisualsProps {
  audioUrl: string | null;
  fileName?: string;
}

function drawWaveform(canvas: HTMLCanvasElement, samples: Float32Array) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d8d5ca";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  const step = Math.max(1, Math.floor(samples.length / width));
  ctx.strokeStyle = "#2f477d";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x < width; x += 1) {
    let min = 1;
    let max = -1;
    const offset = x * step;
    for (let i = 0; i < step && offset + i < samples.length; i += 1) {
      const value = samples[offset + i];
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    const y1 = (1 + min) * 0.5 * height;
    const y2 = (1 + max) * 0.5 * height;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
}

function drawSpectrogram(canvas: HTMLCanvasElement, samples: Float32Array, sampleRate: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  ctx.scale(ratio, ratio);
  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(0, 0, width, height);
  const fftSize = 64;
  const columns = Math.max(48, Math.min(80, Math.floor(width / 8)));
  const maxFrequency = Math.min(8_000, sampleRate / 2);
  const bins = 32;
  const columnWidth = width / columns + 0.4;
  const rowHeight = height / bins + 0.4;
  const hop = Math.max(1, Math.floor((samples.length - fftSize) / Math.max(1, columns - 1)));

  for (let column = 0; column < columns; column += 1) {
    const offset = Math.min(Math.max(0, samples.length - fftSize), column * hop);
    for (let bin = 0; bin < bins; bin += 1) {
      const frequency = ((bin + 1) / bins) * maxFrequency;
      const angular = (2 * Math.PI * frequency) / sampleRate;
      let real = 0;
      let imaginary = 0;
      for (let index = 0; index < fftSize; index += 1) {
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (fftSize - 1));
        const value = (samples[offset + index] ?? 0) * window;
        real += value * Math.cos(angular * index);
        imaginary -= value * Math.sin(angular * index);
      }
      const magnitude = Math.sqrt(real * real + imaginary * imaginary) / fftSize;
      const intensity = Math.max(0, Math.min(1, (20 * Math.log10(magnitude + 1e-5) + 70) / 70));
      const hue = 218 - intensity * 58;
      ctx.fillStyle = `hsl(${hue} ${30 + intensity * 45}% ${96 - intensity * 55}%)`;
      ctx.fillRect(
        column * (width / columns),
        height - (bin + 1) * (height / bins),
        columnWidth,
        rowHeight,
      );
    }
  }
}

export default function AudioVisuals({ audioUrl, fileName }: AudioVisualsProps) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"empty" | "loading" | "ready" | "error">(
    audioUrl ? "loading" : "empty",
  );

  useEffect(() => {
    if (!audioUrl) {
      setStatus("empty");
      return;
    }

    let cancelled = false;
    let audioContext: AudioContext | null = null;
    setStatus("loading");

    const render = async () => {
      try {
        const response = await fetch(audioUrl);
        const bytes = await response.arrayBuffer();
        audioContext = new AudioContext();
        const buffer = await audioContext.decodeAudioData(bytes.slice(0));
        if (cancelled || !waveRef.current || !specRef.current) return;
        drawWaveform(waveRef.current, buffer.getChannelData(0));

        drawSpectrogram(specRef.current, buffer.getChannelData(0), buffer.sampleRate);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void render();
    return () => {
      cancelled = true;
      void audioContext?.close();
    };
  }, [audioUrl]);

  if (!audioUrl || status === "error") {
    return (
      <div className="visual-empty" role="status">
        <AudioLines aria-hidden="true" />
        <div>
          <strong>{status === "error" ? "Preview unavailable" : "No recording selected"}</strong>
          <p>
            {status === "error"
              ? "The recording can still be sent for analysis."
              : "Choose a WAV file or record a sample to inspect its audio."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-visuals" aria-busy={status === "loading"}>
      <figure className="signal-figure">
        <figcaption>
          <span>Waveform</span>
          <small>Amplitude over time</small>
        </figcaption>
        <canvas ref={waveRef} className="waveform-canvas" aria-label={`Waveform for ${fileName ?? "recording"}`} />
      </figure>
      <figure className="signal-figure spectrogram-figure">
        <figcaption>
          <span>Spectrogram</span>
          <small>Frequency energy over time</small>
        </figcaption>
        <canvas ref={specRef} className="spectrogram-canvas" aria-label={`Spectrogram for ${fileName ?? "recording"}`} />
      </figure>
      {status === "loading" && <span className="visual-loading">Reading audio…</span>}
    </div>
  );
}
