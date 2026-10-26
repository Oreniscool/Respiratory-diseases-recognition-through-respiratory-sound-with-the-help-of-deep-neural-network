import { Suspense, lazy } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useWebGL } from "../../hooks/useWebGL";
import { Fallback2D } from "./Fallback2D";
import { useStage } from "./stage";

const StageCanvas = lazy(() => import("./StageCanvas"));

/** The shared full-screen 3D layer behind the story; three.js loads only when it is first needed. */
export function Stage() {
  const group = useStage((s) => s.group);
  const webgl = useWebGL();
  const reduced = useReducedMotion();
  const use3d = webgl && !reduced;
  return (
    <div data-testid="stage" hidden={group === null} aria-hidden="true"
         className="pointer-events-none fixed inset-0 z-0">
      {use3d ? (
        <Suspense fallback={<Fallback2D group={group} />}>
          <StageCanvas group={group} />
        </Suspense>
      ) : (
        <Fallback2D group={group} />
      )}
    </div>
  );
}
