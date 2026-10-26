import type { SVGProps } from "react";

/**
 * One icon per network layer and per fusion member, as 24×24 stroke paths. The same path data is drawn in the
 * DOM (scene text, charts, 2D fallbacks) and onto canvas textures in the 3D vote scene, so each icon means one
 * thing everywhere.
 */
export const GLYPHS = {
  /** the 200 × 120 MFCC fingerprint: a grid of values */
  fingerprint: "M4 4h16v16H4z M4 9.3h16 M4 14.6h16 M9.3 4v16 M14.6 4v16",
  /** multi-scale convolution: kernels of three sizes */
  conv: "M3 3h18v18H3z M7 7h10v10H7z M10.5 10.5h3v3h-3z",
  /** bidirectional GRU: reads forwards and backwards */
  gru128: "M3 8h15 M14 4l4 4-4 4 M21 16H6 M10 12l-4 4 4 4",
  /** the second GRU: recurrent memory carried around the loop */
  gru64: "M19.5 10A8 8 0 0 0 5.6 7.2 M5 3v4.5h4.5 M4.5 14a8 8 0 0 0 13.9 2.8 M19 21v-4.5h-4.5",
  /** dual pooling: the whole window funnelled into one description */
  pooling: "M3 4h18l-7 8.5v6l-4 2v-8z",
  /** dense layers: every input connected to every output */
  dense: "M5 5L19 8.5 M5 5L19 15.5 M5 12L19 8.5 M5 12L19 15.5 M5 19L19 8.5 M5 19L19 15.5 M3.3 5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M3.3 12a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M3.3 19a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M17.3 8.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M17.3 15.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0",
  /** RespiNet: our own stack of layers */
  respinet: "M12 3l9 4.5-9 4.5-9-4.5z M3 12l9 4.5 9-4.5 M3 16.5l9 4.5 9-4.5",
  /** YAMNet: trained on everyday sounds */
  yamnet: "M3 9.5h4l5-4.5v14l-5-4.5H3z M15.5 9a4.5 4.5 0 0 1 0 6 M18.5 6a8.5 8.5 0 0 1 0 12",
  /** OPERA-CE: pretrained on breathing sounds */
  opera_ce: "M12 3v7.5 M12 10.5l-2.5 2 M12 10.5l2.5 2 M9.5 7C6.5 5 3.5 8.5 3.5 14.5c0 4 1.8 5.8 4.2 5.3S10 17.5 10 15V9.5 M14.5 7c3-2 6 1.5 6 7.5c0 4-1.8 5.8-4.2 5.3S14 17.5 14 15V9.5",
  /** HeAR: health acoustics */
  hear: "M12 20.5S3.5 15.8 3.5 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 2.3C20.5 15.8 12 20.5 12 20.5z M3.8 12.5h4.4l1.5-3 2.6 6 1.6-3h6.3",
  /** cleaning: heartbeat thuds below the pass band */
  heartbeat: "M12 20.5S3.5 15.8 3.5 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 2.3C20.5 15.8 12 20.5 12 20.5z",
  /** cleaning: the breath sounds the pass band keeps */
  breath: "M2 12c2-5 4.5-5 6.5 0s4.5 5 6.5 0 4.5-5 6.5 0",
  /** cleaning: high-frequency sensor noise above the pass band */
  noise: "M2 12h2.5l1.2-4 1.6 9 1.6-12 1.6 14 1.6-12 1.6 10 1.6-7 1.2 2H22",
  /** the fused vote */
  fused: "M4 4h16v16H4z M8 12.5l3 3 5.5-6.5",
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, size = 20, ...rest }: SVGProps<SVGSVGElement> & { name: GlyphName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={GLYPHS[name]} />
    </svg>
  );
}
