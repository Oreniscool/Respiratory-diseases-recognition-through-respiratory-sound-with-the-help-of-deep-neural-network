import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Lungs } from "./Lungs";
import { NETWORK_LABELS, NetworkFlow } from "./NetworkFlow";
import { FUSION_LABELS, FusionVote } from "./FusionVote";
import { LabelLayer } from "./labels";
import { Frame } from "./Frame";
import type { StageGroup } from "./stage";

/** One WebGL context for all 3D scenes; it renders only while a 3D scene is active. */
export default function StageCanvas({ group }: { group: StageGroup | null }) {
  const labels = group === "network" ? NETWORK_LABELS : group === "fusion" ? FUSION_LABELS : [];
  return (
    <>
    <Canvas frameloop={group ? "always" : "never"} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0, 10], fov: 40 }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <directionalLight position={[-4, -2, 2]} intensity={0.45} color="#d4eeaa" />
      {/* studio lighting built in code: no HDR download */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.2} position={[0, 5, 5]} scale={[10, 3, 1]} />
        <Lightformer intensity={1.2} color="#d4f7f3" position={[-5, 0, 3]} scale={[3, 8, 1]} />
        <Lightformer intensity={0.8} color="#eaf7d4" position={[5, -1, 2]} scale={[3, 6, 1]} />
      </Environment>
      {group === "lungs" && <Frame width={5.2} height={5.6}><Lungs /></Frame>}
      {group === "network" && <Frame width={18} height={7}><NetworkFlow /></Frame>}
      {group === "fusion" && <Frame width={11} height={6.5}><FusionVote /></Frame>}
    </Canvas>
    <LabelLayer specs={labels} />
    </>
  );
}
