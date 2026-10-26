/** A filled waveform from min/max peak pairs. */
export function Waveform({ peaks, height = 120, color = "var(--color-accent)", className = "" }: {
  peaks: Float32Array; height?: number; color?: string; className?: string;
}) {
  const n = peaks.length / 2;
  const width = 1000;
  const mid = height / 2;
  const y = (v: number) => mid - v * mid * 0.95;
  let top = "", bottom = "";
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    top += `${i ? "L" : "M"}${x.toFixed(1)},${y(peaks[2 * i + 1]!).toFixed(1)}`;
    bottom = `L${x.toFixed(1)},${y(peaks[2 * i]!).toFixed(1)}` + bottom;
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`block w-full ${className}`} style={{ height }} aria-hidden="true">
      <path d={`${top}${bottom}Z`} fill={color} />
    </svg>
  );
}
