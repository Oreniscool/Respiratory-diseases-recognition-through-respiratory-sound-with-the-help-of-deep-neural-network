import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LabelAnchors, type LabelSpec } from "./labels";
import { CatmullRomCurve3, Curve, Group, InstancedMesh, Object3D, TubeGeometry, Vector3 } from "three";
import { SAMPLE } from "../../content/facts";
import { memberLabel, memberTop } from "../../content/members";
import { classColor } from "../../components/classColors";
import type { GlyphName } from "../../components/glyphs";
import { glyphTexture } from "./glyphTexture";
import { useStage } from "./stage";

const X = [-4.4, -2.6, -0.8, 1.0];
const Y = 0.5;
const FUSED_X = 4.1;
const R = 0.58;
const FUSED_R = 0.9;

const MEMBERS = SAMPLE.members ?? [];

const fusedScore = () => SAMPLE.probabilities[SAMPLE.model_prediction] ?? SAMPLE.confidence;

export const FUSION_LABELS: LabelSpec[] = [
  ...MEMBERS.map((m, i): LabelSpec => {
    const top = memberTop(m);
    return { id: `fus-${m.name}`, position: [X[i]!, Y - R - 0.62, 0], title: memberLabel(m.name), detail: `${top.label} ${top.score.toFixed(1)}%` };
  }),
  { id: "fus-fused", position: [FUSED_X, Y - FUSED_R - 0.66, 0], title: "Fused", detail: `${SAMPLE.model_prediction} ${fusedScore().toFixed(1)}%`, tone: "accent" },
];

/** A clockwise arc from 12 o'clock covering `fraction` of the circle: a score gauge. */
class Arc extends Curve<Vector3> {
  constructor(private radius: number, private fraction: number) { super(); }
  override getPoint(t: number, target = new Vector3()) {
    const a = Math.PI / 2 - t * this.fraction * 2 * Math.PI;
    return target.set(this.radius * Math.cos(a), this.radius * Math.sin(a), 0);
  }
}

const smooth = (a: number, b: number, v: number) => {
  const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** A model as a medallion: its icon on a disc, ringed by a gauge of its top score in that class's colour. */
function Medallion({ glyph, color, score, radius, gauge, disc }: {
  glyph: GlyphName; color: string; score: number; radius: number;
  gauge: (geo: TubeGeometry | null) => void; disc: (g: Group | null) => void;
}) {
  const texture = useMemo(() => glyphTexture(glyph, "#1e2b08", "#ffffff"), [glyph]);
  const ring = useMemo(() => new TubeGeometry(new Arc(radius * 1.28, score / 100), 96, radius * 0.1, 10, false), [radius, score]);
  return (
    <group>
      <group ref={disc}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, 0.16, 64]} />
          <meshStandardMaterial color="#ffffff" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.085]}>
          <circleGeometry args={[radius * 0.92, 64]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
      <mesh>
        <torusGeometry args={[radius * 1.28, radius * 0.045, 8, 96]} />
        <meshStandardMaterial color="#e7eed9" roughness={0.8} />
      </mesh>
      <mesh geometry={ring} ref={(m) => gauge(m ? ring : null)}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

const MEMBER_GLYPH: Record<string, GlyphName> = { respinet: "respinet", yamnet: "yamnet", opera_ce: "opera_ce", hear: "hear" };
const PACKETS = 4;

/** Scene 8: four models, each drawn with its own icon and its real score on the sample, merging into one vote. */
export function FusionVote() {
  const members = MEMBERS;
  const fused = fusedScore();
  const discs = useRef<(Group | null)[]>([]);
  const gauges = useRef<(TubeGeometry | null)[]>([]);
  const packets = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const curves = useMemo(() => members.map((_, i) => {
    // from the top of each gauge, over the row, into the fused medallion
    const from = new Vector3(X[i]!, Y + R * 1.42, 0);
    const to = new Vector3(FUSED_X - FUSED_R * 0.95, Y + FUSED_R * 0.95, 0);
    const lift = 0.7 + (members.length - 1 - i) * 0.28;
    return new CatmullRomCurve3([from, from.clone().add(new Vector3(0.3, lift * 0.8, 0.2)), from.clone().lerp(to, 0.6).add(new Vector3(0, lift, 0.3)), to]);
  }), [members]);
  const streams = useMemo(() => curves.map((c) => new TubeGeometry(c, 64, 0.025, 6, false)), [curves]);

  useFrame(({ clock }) => {
    const p = useStage.getState().progress;
    const t = clock.elapsedTime;
    members.forEach((_, i) => {
      const pop = smooth(0.02 + i * 0.06, 0.16 + i * 0.06, p);
      discs.current[i]?.scale.setScalar(Math.max(0.001, pop));
      const geo = gauges.current[i];
      geo?.setDrawRange(0, Math.floor((geo.index?.count ?? 0) * smooth(0.12 + i * 0.06, 0.4 + i * 0.06, p)));
    });
    const flow = smooth(0.45, 0.62, p);
    streams.forEach((geo) => geo.setDrawRange(0, Math.floor((geo.index?.count ?? 0) * flow)));
    const last = members.length;
    discs.current[last]?.scale.setScalar(Math.max(0.001, smooth(0.58, 0.7, p)));
    const fusedGauge = gauges.current[last];
    fusedGauge?.setDrawRange(0, Math.floor((fusedGauge.index?.count ?? 0) * smooth(0.64, 0.85, p)));
    // once the streams have drawn, small packets keep travelling along them
    const mesh = packets.current;
    if (mesh) {
      curves.forEach((curve, i) => {
        for (let k = 0; k < PACKETS; k++) {
          const u = (t * 0.35 + k / PACKETS + i * 0.13) % 1;
          dummy.position.copy(curve.getPointAt(u));
          dummy.scale.setScalar(flow >= 1 ? 1 : 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i * PACKETS + k, dummy.matrix);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      {members.map((m, i) => {
        const top = memberTop(m);
        return (
          <group key={m.name} position={[X[i]!, Y, 0]}>
            <Medallion glyph={MEMBER_GLYPH[m.name] ?? "respinet"} color={classColor(top.label)} score={top.score} radius={R}
                       gauge={(g) => { gauges.current[i] = g; }} disc={(g) => { discs.current[i] = g; }} />
          </group>
        );
      })}
      {streams.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color="#2ad5c4" emissive="#2ad5c4" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <instancedMesh ref={packets} args={[undefined, undefined, members.length * PACKETS]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#198076" emissive="#2ad5c4" emissiveIntensity={0.5} />
      </instancedMesh>
      <group position={[FUSED_X, Y, 0]}>
        <Medallion glyph="fused" color={classColor(SAMPLE.model_prediction)} score={fused} radius={FUSED_R}
                   gauge={(g) => { gauges.current[members.length] = g; }} disc={(g) => { discs.current[members.length] = g; }} />
      </group>
      <LabelAnchors specs={FUSION_LABELS} />
    </group>
  );
}
