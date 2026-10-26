import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Group, LineCurve3, Mesh, MeshBasicMaterial, SphereGeometry, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useStage } from "./stage";

/** A stylized lobe: an elongated sphere with a tapered apex, a flat medial face and a concave base. */
function lobeGeometry(side: 1 | -1, notch: boolean): BufferGeometry {
  const g = new SphereGeometry(1, 72, 56);
  const pos = g.attributes.position!;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    const taper = y > 0 ? 1 - 0.42 * y ** 1.4 : 1 - 0.06 * -y;
    y *= 1.4;
    x *= 0.95 * taper;
    z *= 0.62 * taper;
    const medial = side * x < 0;
    if (medial) x *= 0.48;
    if (notch && medial) {
      // cardiac notch: a smooth hollow centred low on the medial face
      const d = Math.exp(-(((y + 0.45) / 0.45) ** 2));
      x *= 1 - 0.55 * d;
    }
    if (y < -1.0) y += (-y - 1.0) * 0.6 * (1 - Math.min(1, Math.abs(x)));
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

type Branch = { start: Vector3; end: Vector3; radius: number };

/** Inside the ellipse fitted to a lobe's silhouette (world units, before breathing). */
const insideLobe = (p: Vector3) => ((Math.abs(p.x) - 1.2) / 0.62) ** 2 + ((p.y + 0.4) / 1.2) ** 2 < 1;

function grow(start: Vector3, dir: Vector3, length: number, radius: number, depth: number, side: number, out: Branch[], main = false) {
  const end = start.clone().addScaledVector(dir, length);
  if (!main && !insideLobe(end)) return; // clip the tree to the lungs
  out.push({ start, end, radius });
  if (depth === 0) return;
  for (const sign of [-1, 1]) {
    const child = dir.clone()
      .applyAxisAngle(new Vector3(0, 0, 1), sign * (0.3 + 0.05 * depth))
      .applyAxisAngle(new Vector3(0, 1, 0), sign * side * 0.12)
      .normalize();
    grow(end, child, length * 0.78, radius * 0.68, depth - 1, side, out);
  }
}

function bronchialTree(): BufferGeometry {
  const branches: Branch[] = [{ start: new Vector3(0, 2.25, 0), end: new Vector3(0, 0.95, 0), radius: 0.11 }];
  for (const side of [-1, 1]) {
    grow(new Vector3(0, 0.95, 0), new Vector3(side * 0.66, -0.75, 0).normalize(), 0.92, 0.085, 4, side, branches, true);
  }
  return mergeGeometries(branches.map((b) => new TubeGeometry(new LineCurve3(b.start, b.end), 1, b.radius, 10, false)));
}

/** Scene 0: breathing translucent lungs with a bronchial tree and sound rings. */
export function Lungs() {
  const lobes = useRef<Group>(null);
  const root = useRef<Group>(null);
  const rings = useRef<(Mesh | null)[]>([]);
  const geometry = useMemo(() => ({ right: lobeGeometry(-1, false), left: lobeGeometry(1, true), tree: bronchialTree() }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const breath = Math.sin(2 * Math.PI * 0.25 * t);
    lobes.current?.scale.set(1 + 0.04 * breath, 1 + 0.03 * breath, 1 + 0.04 * breath);
    if (root.current) root.current.rotation.y = -0.35 + useStage.getState().progress * 0.7 + 0.05 * Math.sin(t * 0.3);
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (t * 0.28 + i / 3) % 1;
      ring.scale.setScalar(1.4 + phase * 2.4);
      (ring.material as MeshBasicMaterial).opacity = 0.42 * (1 - phase);
    });
  });

  const lobeMaterial = (
    <meshPhysicalMaterial color="#e7eed9" transmission={0.6} roughness={0.35} thickness={0.8} ior={1.3}
                          clearcoat={0.4} attenuationColor="#d4eeaa" attenuationDistance={2.2} />
  );
  return (
    <group ref={root} position={[0, -0.2, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { rings.current[i] = m; }} position={[0, -0.2, -0.6]}>
          <ringGeometry args={[0.985, 1, 96]} />
          <meshBasicMaterial color="#93d52a" transparent depthWrite={false} />
        </mesh>
      ))}
      <mesh geometry={geometry.tree}>
        <meshStandardMaterial color="#198076" roughness={0.45} metalness={0.05} />
      </mesh>
      <group ref={lobes}>
        <mesh geometry={geometry.right} position={[-0.98, -0.35, 0]} scale={1.04}>{lobeMaterial}</mesh>
        <mesh geometry={geometry.left} position={[0.98, -0.35, 0]}>{lobeMaterial}</mesh>
      </group>
    </group>
  );
}
