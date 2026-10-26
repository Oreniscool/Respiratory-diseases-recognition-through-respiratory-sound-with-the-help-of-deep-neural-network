import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { Stage } from "../features/three/Stage";
import { useStage, type StageGroup } from "../features/three/stage";

/** Dev-only: /__stage?group=lungs|fusion&progress=0.6 renders one 3D scene for visual checks. */
export function StagePreview() {
  const [params] = useSearchParams();
  const group = (params.get("group") ?? "lungs") as StageGroup;
  const progress = Number(params.get("progress") ?? "0.6");
  useEffect(() => {
    useStage.setState({ group, progress });
  }, [group, progress]);
  return (
    <main className="min-h-screen bg-paper">
      <Stage />
    </main>
  );
}
