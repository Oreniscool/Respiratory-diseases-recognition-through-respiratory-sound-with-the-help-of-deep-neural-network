import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry,
  TorusGeometry, TubeGeometry, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LUNGS, bronchialTree, onFrontSurface, radialProfile, thickness, type LungShape } from "./lungAnatomy";
import { useStage } from "./stage";

/** A lung body: a sphere stretched along rays from the lung's centre to its anatomical outline. */
function lungGeometry(shape: LungShape): BufferGeometry {
  const profile = radialProfile(shape);
  const g = new SphereGeometry(1, 120, 56);
  g.rotateX(Math.PI / 2); // poles front and back, the equator becomes the outline
  const pos = g.attributes.position!;
  const [cx, cy] = shape.centre;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rho = Math.min(1, Math.hypot(x, y));
    const angle = Math.atan2(y, x);
    const r = profile(angle) * rho;
    pos.setXYZ(i, cx + r * Math.cos(angle), cy + r * Math.sin(angle), Math.sign(z) * thickness(shape, rho));
  }
  g.computeVertexNormals();
  return g;
}

const UP = new Vector3(0, 1, 0);

/** The airways as tapered cylinders with rounded joints, and the alveolar tips as small beads. */
function airwayGeometry() {
  const branches = bronchialTree();
  const parts: BufferGeometry[] = [];
  const tips: BufferGeometry[] = [];
  for (const b of branches) {
    const start = new Vector3(...b.start), end = new Vector3(...b.end);
    const dir = end.clone().sub(start);
    const length = dir.length();
    const segments = b.r0 > 0.05 ? 16 : b.r0 > 0.015 ? 8 : 5;
    const cylinder = new CylinderGeometry(b.r1, b.r0, length, segments, 1, true);
    cylinder.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()));
    cylinder.translate(...start.clone().lerp(end, 0.5).toArray());
    parts.push(cylinder);
    if (b.r1 > 0.02) { // a rounded joint where it shows; the fine airways meet without one
      const joint = new SphereGeometry(b.r1, segments, Math.max(4, segments / 2));
      joint.translate(...end.toArray());
      parts.push(joint);
    }
    if (b.leaf) {
      const bead = new SphereGeometry(0.03, 6, 4);
      bead.translate(...end.toArray());
      tips.push(bead);
    }
  }
  // cartilage rings around the trachea
  for (let y = 2.3; y > 0.95; y -= 0.16) {
    const ring = new TorusGeometry(0.133, 0.018, 6, 28);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, y, -0.05);
    parts.push(ring);
  }
  return { airways: mergeGeometries(parts), tips: mergeGeometries(tips) };
}

/** The lobe boundaries traced on the front of each lung. */
function fissureGeometry(): BufferGeometry {
  const tubes = Object.values(LUNGS).flatMap((shape) => {
    const profile = radialProfile(shape);
    return shape.fissures.map((line) => {
      const points = onFrontSurface(shape, profile, line, 0.012).map((p) => new Vector3(...p));
      return new TubeGeometry(new CatmullRomCurve3(points), 64, 0.014, 6, false);
    });
  });
  return mergeGeometries(tubes);
}

/** Scene 0: anatomical lungs (three right lobes, two left with the cardiac notch) with the airway tree inside. */
export function Lungs() {
  const body = useRef<Group>(null);
  const root = useRef<Group>(null);
  const rings = useRef<(Mesh | null)[]>([]);
  const geometry = useMemo(() => ({
    right: lungGeometry(LUNGS.right), left: lungGeometry(LUNGS.left), fissures: fissureGeometry(), ...airwayGeometry(),
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const breath = Math.sin(2 * Math.PI * 0.22 * t);
    body.current?.scale.set(1 + 0.035 * breath, 1 + 0.025 * breath, 1 + 0.05 * breath);
    if (root.current) root.current.rotation.y = -0.4 + useStage.getState().progress * 0.8 + 0.06 * Math.sin(t * 0.3);
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (t * 0.22 + i / 3) % 1;
      ring.scale.setScalar(2.2 + phase * 2);
      (ring.material as MeshBasicMaterial).opacity = 0.32 * (1 - phase);
    });
  });

  const tissue = (
    <meshPhysicalMaterial color="#e3ecd0" transmission={0.55} roughness={0.22} thickness={0.6} ior={1.25}
                          clearcoat={0.5} clearcoatRoughness={0.3} sheen={0.6} sheenColor="#d4eeaa"
                          attenuationColor="#c9e6a0" attenuationDistance={4} />
  );
  return (
    <group ref={root} position={[0, -0.35, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { rings.current[i] = m; }} position={[0, -0.2, -1.2]}>
          <ringGeometry args={[0.99, 1, 128]} />
          <meshBasicMaterial color="#93d52a" transparent depthWrite={false} />
        </mesh>
      ))}
      <group ref={body}>
        <mesh geometry={geometry.airways}>
          <meshStandardMaterial color="#198076" roughness={0.38} metalness={0.05} />
        </mesh>
        <mesh geometry={geometry.tips}>
          <meshStandardMaterial color="#2ad5c4" roughness={0.5} emissive="#2ad5c4" emissiveIntensity={0.25} />
        </mesh>
        <mesh geometry={geometry.right}>{tissue}</mesh>
        <mesh geometry={geometry.left}>{tissue}</mesh>
        <mesh geometry={geometry.fissures}>
          <meshStandardMaterial color="#76aa22" roughness={0.6} transparent opacity={0.85} />
        </mesh>
      </group>
    </group>
  );
}
