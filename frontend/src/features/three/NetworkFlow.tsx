import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { LabelAnchors, type LabelSpec } from "./labels";
import { InstancedMesh, MeshStandardMaterial, Object3D, QuadraticBezierCurve3, Vector3 } from "three";
import { SAMPLE } from "../../content/facts";
import { classColor } from "../../components/classColors";
import { useStage } from "./stage";

const LAYERS = [
  { name: "Multi-scale conv", detail: "kernels 3 · 5 · 11", h: 2.0 },
  { name: "BiGRU-128", detail: "forwards + backwards", h: 2.7 },
  { name: "BiGRU-64", detail: "forwards + backwards", h: 2.1 },
  { name: "Dual pooling", detail: "attention ‖ max", h: 1.5 },
  { name: "Dense", detail: "128 → 64 → 5", h: 1.1 },
];
const X = [-4.4, -2.2, 0, 2.2, 4.4];
const PARTICLES = 140;
const OUT_X = 8.6;
const ROW = [-1.95, -2.95] as const;

const outputScores = () => SAMPLE.members?.find((m) => m.name === "respinet")?.probabilities ?? SAMPLE.probabilities;

export const NETWORK_LABELS: LabelSpec[] = [
  // two alternating rows below the slabs, so neighbouring labels never collide
  { id: "net-input", position: [-6.4, ROW[0], 0], title: "Fingerprint", detail: "200 × 120" },
  ...LAYERS.map((l, i): LabelSpec => ({ id: `net-${i}`, position: [X[i]!, ROW[(i + 1) % 2]!, 0], title: l.name, detail: l.detail })),
  { id: "net-skip", position: [-2.2, 2.75, 0], title: "residual skip" },
  ...Object.entries(outputScores()).map(([label, value], i): LabelSpec => ({
    id: `net-out-${label}`, position: [OUT_X - 0.25, 1.2 - i * 0.6, 0], title: `${label} ${value.toFixed(1)}%`, align: "right",
  })),
];

/** Scene 6: the fingerprint flowing through RespiNet's layers (an illustration of the real architecture). */
export function NetworkFlow() {
  const particles = useRef<InstancedMesh>(null);
  const materials = useRef<(MeshStandardMaterial | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: PARTICLES }, (_, i) => ({
    offset: i / PARTICLES, y: Math.sin(i * 12.9898) * 0.9, z: Math.cos(i * 78.233) * 0.55,
  })), []);
  const residual = useMemo(() => new QuadraticBezierCurve3(new Vector3(-4.4, 1.05, 0), new Vector3(-2.2, 3.3, 0.2), new Vector3(-1.05, 1.4, 0)), []);
  const scores = outputScores();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const progress = useStage.getState().progress;
    const front = -6.6 + progress * 14;
    const mesh = particles.current;
    if (mesh) {
      seeds.forEach((s, i) => {
        const x = -6.6 + ((s.offset * 13.5 + t * 1.5) % 13.5);
        const visible = x < front;
        dummy.position.set(x, s.y * (x > 3.5 ? 0.4 : 1), s.z);
        dummy.scale.setScalar(visible ? 1 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    const active = Math.min(LAYERS.length - 1, Math.floor(progress * LAYERS.length));
    materials.current.forEach((m, i) => { if (m) m.emissiveIntensity = i === active ? 0.55 : 0.04; });
  });

  return (
    <group position={[-0.4, 0, 0]}>
      <mesh position={[-6.4, 0, 0]}>
        <boxGeometry args={[0.18, 2.2, 1.4]} />
        <meshStandardMaterial color="#93d52a" roughness={0.6} />
      </mesh>
      {LAYERS.map((layer, i) => (
        <group key={layer.name} position={[X[i]!, 0, 0]}>
          <RoundedBox args={[0.9, layer.h, 1.6]} radius={0.14} smoothness={4}>
            <meshStandardMaterial ref={(m) => { materials.current[i] = m; }} color="#f7faf0" emissive="#2ad5c4"
                                  emissiveIntensity={0.04} roughness={0.35} />
          </RoundedBox>
        </group>
      ))}
      <mesh>
        <tubeGeometry args={[residual, 48, 0.04, 8, false]} />
        <meshStandardMaterial color="#76aa22" />
      </mesh>
      <LabelAnchors specs={NETWORK_LABELS} />
      <instancedMesh ref={particles} args={[undefined, undefined, PARTICLES]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#2ad5c4" emissive="#2ad5c4" emissiveIntensity={0.6} />
      </instancedMesh>
      {Object.entries(scores).map(([label, value], i) => (
        <group key={label} position={[OUT_X, 1.2 - i * 0.6, 0]}>
          <mesh position={[(value / 100) * 0.9, 0, 0]}>
            <boxGeometry args={[(value / 100) * 1.8 + 0.02, 0.32, 0.32]} />
            <meshStandardMaterial color={classColor(label)} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
