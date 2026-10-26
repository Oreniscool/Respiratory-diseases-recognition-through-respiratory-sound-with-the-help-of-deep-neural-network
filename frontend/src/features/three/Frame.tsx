import type { ReactNode } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Fit a scene of `width` × `height` world units into the right ~58% of the screen on wide viewports
 * (the story text sits on the left), or centred across the width on narrow ones.
 */
export function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const viewport = useThree((s) => s.viewport);
  const size = useThree((s) => s.size);
  const wide = size.width >= 1024;
  const area = wide ? viewport.width * 0.56 : viewport.width * 0.92;
  const scale = Math.min(area / width, (viewport.height * 0.8) / height, 1.4);
  const x = wide ? viewport.width * 0.5 - viewport.width * 0.31 : 0;
  return <group position={[x, 0, 0]} scale={scale}>{children}</group>;
}
