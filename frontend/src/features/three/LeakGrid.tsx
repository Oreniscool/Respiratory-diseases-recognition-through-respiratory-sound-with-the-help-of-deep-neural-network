import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import { FACTS } from "../../content/facts";
import { leakValue, useLeakSelection } from "../story/scenes/charts/leakStore";
import { LabelAnchors } from "./labels";
import { BARS, BAR, H, leakLabels } from "./leakLayout";
import { useStage } from "./stage";

const ACCENT = new Color("#198076");
const IDLE = new Color("#dfe9cc");
const CHANCE_PLANE = new PlaneGeometry(7.4, 3.2);

const smooth = (a: number, b: number, v: number) => {
  const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Scene "leaks": the six rungs as a 3D bar grid; the bars rise when the scene opens and the chosen one lights up. */
export function LeakGrid() {
  const { unit, testPick } = useLeakSelection();
  const group = useRef<Group>(null);
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }, delta) => {
    const p = useStage.getState().progress;
    const sel = useLeakSelection.getState();
    if (group.current) group.current.rotation.y = -0.38 + Math.sin(clock.elapsedTime * 0.35) * 0.06;
    BARS.forEach((b, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const grow = smooth(0.05 + i * 0.07, 0.45 + i * 0.07, p);
      const target = Math.max(0.001, leakValue(b.unit, b.test) * H * grow);
      mesh.scale.y += (target - mesh.scale.y) * Math.min(1, delta * 6);
      mesh.position.y = mesh.scale.y / 2;
      const on = b.unit === sel.unit && b.test === sel.testPick;
      (mesh.material as MeshStandardMaterial).color.lerp(on ? ACCENT : IDLE, Math.min(1, delta * 5));
    });
  });
  return (
    <group ref={group} rotation={[0.24, -0.38, 0]} position={[0.2, -2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[7.4, 3.2]} />
        <meshStandardMaterial color="#f4f8ec" roughness={0.95} />
      </mesh>
      {BARS.map((b, i) => (
        <mesh key={`${b.unit}-${b.test}`} position={[b.x, 0, b.z]} scale={[1, 0.001, 1]} ref={(m) => { meshes.current[i] = m; }}>
          <boxGeometry args={[BAR, 1, BAR]} />
          <meshStandardMaterial color="#dfe9cc" roughness={0.45} metalness={0.05} />
        </mesh>
      ))}
      {/* the chance level: a faint plane with an outline across the whole grid */}
      <group position={[0, FACTS.leakChance.value * H, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[7.4, 3.2]} />
          <meshBasicMaterial color="#9a4a1d" transparent opacity={0.07} side={DoubleSide} depthWrite={false} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[CHANCE_PLANE]} />
          <lineBasicMaterial color="#9a4a1d" />
        </lineSegments>
      </group>
      <LabelAnchors specs={leakLabels(unit, testPick)} />
    </group>
  );
}
