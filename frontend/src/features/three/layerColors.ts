import type { GlyphName } from "../../components/glyphs";

/** One colour per network layer, shared by scene 6's step list and its data-journey rows. */
export const LAYER_COLORS: Partial<Record<GlyphName, string>> = {
  fingerprint: "#93d52a",
  conv: "#76aa22",
  gru128: "#198076",
  gru64: "#2a9d8f",
  pooling: "#d08a12",
  dense: "#11554e",
};
