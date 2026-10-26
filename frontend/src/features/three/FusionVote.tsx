import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { LabelAnchors, type LabelSpec } from "./labels";
import { CatmullRomCurve3, Group, TubeGeometry, Vector3 } from "three";
import { SAMPLE } from "../../content/facts";
import { memberLabel, memberTop } from "../../content/members";
import { classColor } from "../../components/classColors";
import { useStage } from "./stage";

const X = [-4.2, -2.4, -0.6, 1.2];
const FUSED_X = 4.2;
const BASE = -1.6;
const HEIGHT = 3.2;

const MEMBERS = SAMPLE.members ?? [];

const fusedScore = () => SAMPLE.probabilities[SAMPLE.model_prediction] ?? SAMPLE.confidence;

export const FUSION_LABELS: LabelSpec[] = [
  ...MEMBERS.map((m, i): LabelSpec => {
    const top = memberTop(m);
    return { id: `fus-${m.name}`, position: [X[i]!, BASE - 0.55, 0], title: memberLabel(m.name), detail: `${top.label} ${top.score.toFixed(1)}%` };
  }),
  { id: "fus-fused", position: [FUSED_X, BASE - 0.6, 0], title: "Fused", detail: `${SAMPLE.model_prediction} ${fusedScore().toFixed(1)}%`, tone: "accent" },
];

const smooth = (a: number, b: number, v: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

/** Scene 8: four members' real scores on the sample recording, streaming into the fused score. */
export function FusionVote() {
  const members = MEMBERS;
  const fused = fusedScore();
  const pillars = useRef<(Group | null)[]>([]);
  const fusedPillar = useRef<Group>(null);
  const streams = useMemo(() => members.map((m, i) => {
    const top = memberTop(m).score / 100;
    const from = new Vector3(X[i]!, BASE + HEIGHT * top, 0);
    const to = new Vector3(FUSED_X, BASE + HEIGHT * (fused / 100), 0);
    const mid = from.clone().lerp(to, 0.5).add(new Vector3(0, 1.1, 0.4));
    return new TubeGeometry(new CatmullRomCurve3([from, mid, to]), 64, 0.03, 6, false);
  }), [members, fused]);

  useFrame(() => {
    const p = useStage.getState().progress;
    const rise = smooth(0, 0.3, p);
    pillars.current.forEach((g) => g?.scale.set(1, Math.max(0.001, rise), 1));
    const flow = smooth(0.3, 0.55, p);
    streams.forEach((geo) => geo.setDrawRange(0, Math.floor((geo.index?.count ?? 0) * flow)));
    fusedPillar.current?.scale.set(1, Math.max(0.001, smooth(0.5, 0.75, p)), 1);
  });

  return (
    <group position={[0, 0.2, 0]}>
      {members.map((m, i) => {
        const top = memberTop(m);
        const h = HEIGHT * (top.score / 100);
        return (
          <group key={m.name} position={[X[i]!, BASE, 0]}>
            <group ref={(g) => { pillars.current[i] = g; }}>
              <RoundedBox args={[0.9, h, 0.9]} radius={0.1} position={[0, h / 2, 0]}>
                <meshStandardMaterial color={classColor(top.label)} roughness={0.4} />
              </RoundedBox>
            </group>
          </group>
        );
      })}
      <LabelAnchors specs={FUSION_LABELS} />
      {streams.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color="#2ad5c4" emissive="#2ad5c4" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <group position={[FUSED_X, BASE, 0]}>
        <group ref={fusedPillar}>
          <RoundedBox args={[1.2, HEIGHT * (fused / 100), 1.2]} radius={0.12} position={[0, (HEIGHT * (fused / 100)) / 2, 0]}>
            <meshStandardMaterial color="#198076" roughness={0.3} />
          </RoundedBox>
        </group>
      </group>
    </group>
  );
}
