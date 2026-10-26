import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, Vector3 } from "three";

/** A DOM label pinned to a point in a 3D scene. */
export type LabelSpec = {
  id: string;
  position: [number, number, number];
  title: string;
  detail?: string;
  tone?: "ink" | "accent";
  /** where the text sits relative to the anchor */
  align?: "center" | "right";
};

const nodes = new Map<string, HTMLDivElement>();

/** Inside the Canvas: project each anchor to the screen every frame and move its DOM label there. */
export function LabelAnchors({ specs }: { specs: LabelSpec[] }) {
  const anchors = useRef<(Object3D | null)[]>([]);
  const v = useRef(new Vector3());
  useFrame(({ camera, size }) => {
    specs.forEach((spec, i) => {
      const anchor = anchors.current[i];
      const node = nodes.get(spec.id);
      if (!anchor || !node) return;
      anchor.getWorldPosition(v.current).project(camera);
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      const shift = spec.align === "right" ? "-100%" : "-50%";
      node.style.transform = `translate(${x}px, ${y}px) translate(${shift}, -50%)`;
      node.style.opacity = "1";
    });
  });
  return (
    <>
      {specs.map((spec, i) => (
        <object3D key={spec.id} position={spec.position} ref={(o) => { anchors.current[i] = o; }} />
      ))}
    </>
  );
}

/** Outside the Canvas, in the same React tree: the label elements themselves. */
export function LabelLayer({ specs }: { specs: LabelSpec[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {specs.map((spec) => (
        <div
          key={spec.id}
          ref={(n) => { if (n) nodes.set(spec.id, n); else nodes.delete(spec.id); }}
          className={`absolute left-0 top-0 whitespace-nowrap opacity-0 ${spec.align === "right" ? "text-right" : "text-center"}`}
        >
          <div className={`text-[13px] font-semibold ${spec.tone === "accent" ? "text-accent" : "text-ink"}`}>{spec.title}</div>
          {spec.detail && <div className="tabular text-[12px] text-ink-muted">{spec.detail}</div>}
        </div>
      ))}
    </div>
  );
}
