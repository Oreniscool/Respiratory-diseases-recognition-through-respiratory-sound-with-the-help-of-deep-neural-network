import { CanvasTexture, SRGBColorSpace } from "three";
import { GLYPHS, type GlyphName } from "../../components/glyphs";

const cache = new Map<string, CanvasTexture>();

/** A glyph drawn on a round badge, as a texture for a plane in the 3D scenes (cached per glyph and colour). */
export function glyphTexture(name: GlyphName, color: string, background = "#ffffff"): CanvasTexture {
  const key = `${name}|${color}|${background}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();
  // the 24-unit icon in the middle 60% of the badge
  const scale = (size * 0.6) / 24;
  ctx.translate(size * 0.2, size * 0.2);
  ctx.scale(scale, scale);
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(GLYPHS[name]));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}
