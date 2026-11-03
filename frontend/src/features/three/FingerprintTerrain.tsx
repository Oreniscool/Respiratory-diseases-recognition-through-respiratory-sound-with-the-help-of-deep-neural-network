import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { FACTS } from "../../content/facts";
import { useSceneAudio } from "../story/useSceneAudio";
import { ramp } from "../story/scenes/charts/FeatureHeatmap";
import { fingerprintStages, ROWS, TIME } from "./fingerprintGrid";
import { LabelAnchors, type LabelSpec } from "./labels";
import { useStage } from "./stage";

const WIDTH = 6.4, DEPTH = 4, HEIGHT = 1.1;
/** Feature rows where the MFCC, Δ and Δ² blocks meet (40 rows each). */
const DIVIDER_ROWS = [FACTS.nMfcc.value, 2 * FACTS.nMfcc.value];

const smooth = (a: number, b: number, v: number) => {
  const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** One window in seconds, from the preprocessing facts (200 frames × 512 samples ÷ 22,050 Hz). */
const WINDOW_SECONDS = ((FACTS.windowFrames.value * FACTS.hopSamples.value) / FACTS.sampleRate.value).toFixed(1);

/** When each stage takes over, as a fraction of the scene's timeline (the scene's step list uses the same points). */
export const STAGE_AT = [0, 1 / 3, 2 / 3] as const;

export const FINGERPRINT_LABELS: LabelSpec[] = [
  { id: "fp-time", position: [0, -0.15, DEPTH / 2 + 0.55], title: `time · ${FACTS.windowFrames.display} frames ≈ ${WINDOW_SECONDS} s` },
  { id: "fp-rows", position: [WIDTH / 2 + 0.95, -0.15, 0], title: "features", detail: "low → high", align: "center" },
];

/** Scene 5: one window of the scene clip as a landscape (height and colour = value), morphing mel → MFCC → full features. */
export function FingerprintTerrain() {
  const { analysis } = useSceneAudio("normal");
  const stages = useMemo(() => (analysis ? fingerprintStages(analysis) : null), [analysis]);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(WIDTH, DEPTH, TIME - 1, ROWS - 1);
    g.rotateX(-Math.PI / 2);
    g.setAttribute("color", new BufferAttribute(new Float32Array(TIME * ROWS * 3), 3));
    return g;
  }, []);
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const dividers = useRef<(MeshBasicMaterial | null)[]>([]);
  const last = useRef(-1);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = -0.45 + Math.sin(clock.elapsedTime * 0.3) * 0.12;
    const geo = mesh.current?.geometry;
    if (!stages || !geo) return;
    const p = useStage.getState().progress;
    if (Math.abs(p - last.current) < 1e-4) return;
    last.current = p;
    const rise = smooth(0, 0.12, p);
    const toMfcc = smooth(STAGE_AT[1] - 0.06, STAGE_AT[1] + 0.06, p);
    const toFull = smooth(STAGE_AT[2] - 0.06, STAGE_AT[2] + 0.06, p);
    for (const m of dividers.current) if (m) m.opacity = 0.75 * toFull;
    const pos = geo.attributes.position!;
    const col = geo.attributes.color!;
    for (let r = 0; r < ROWS; r++) {
      for (let t = 0; t < TIME; t++) {
        const k = r * TIME + t;
        const a = stages[0][k]!, b = stages[1][k]!, c = stages[2][k]!;
        const v = (a * (1 - toMfcc) + b * toMfcc) * (1 - toFull) + c * toFull;
        // PlaneGeometry rows run from the far edge to the near edge: feature row 0 sits at the front
        const vertex = (ROWS - 1 - r) * TIME + t;
        pos.setY(vertex, v * HEIGHT * rise);
        const [cr, cg, cb] = ramp(v);
        col.setXYZ(vertex, cr / 255, cg / 255, cb / 255);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <group ref={group} rotation={[0.55, -0.45, 0]} position={[0, -0.6, 0]}>
      <mesh ref={mesh} geometry={geometry}>
        <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.55} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[WIDTH + 0.3, DEPTH + 0.3]} />
        <meshStandardMaterial color="#e7eed9" roughness={0.9} side={DoubleSide} />
      </mesh>
      {/* in the last stage, the 120 rows are three blocks of 40: MFCC, Δ and Δ² */}
      {DIVIDER_ROWS.map((r, i) => (
        <mesh key={r} position={[0, HEIGHT * 0.5, DEPTH / 2 - (r / (ROWS - 1)) * DEPTH]}>
          <boxGeometry args={[WIDTH, HEIGHT, 0.012]} />
          <meshBasicMaterial ref={(m) => { dividers.current[i] = m; }} color="#11554e" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <LabelAnchors specs={FINGERPRINT_LABELS} />
    </group>
  );
}
