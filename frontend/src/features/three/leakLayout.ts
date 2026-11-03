import { FACTS } from "../../content/facts";
import { SPLIT_UNITS, leakValue } from "../story/scenes/charts/leakStore";
import { pct1 } from "../story/scenes/charts/chartText";
import type { LabelSpec } from "./labels";

/** World units for 100% balanced accuracy, and the grid layout. */
export const H = 4;
const XS = [-2.3, 0, 2.3];
const Z = { test: 0.62, validation: -0.62 };
export const BAR = 0.78;

export const BARS = SPLIT_UNITS.flatMap((u, i) => ([true, false] as const).map((test) => ({ unit: u.id, test, x: XS[i]!, z: test ? Z.test : Z.validation })));

/** The labels follow the selection: unit names under the columns, the chosen bar's value above it, the chance plane. */
export function leakLabels(unit: string, testPick: boolean): LabelSpec[] {
  const chosen = BARS.find((b) => b.unit === unit && b.test === testPick)!;
  const value = leakValue(chosen.unit, chosen.test);
  return [
    ...SPLIT_UNITS.map((u, i): LabelSpec => ({ id: `leak-unit-${u.id}`, position: [XS[i]!, -0.45, 1.4], title: u.label })),
    { id: "leak-axis-test", position: [XS[2]! + 0.65, 0.15, Z.test + 0.35], title: "front row: checkpoint on test", align: "center" },
    { id: "leak-axis-val", position: [XS[2]! + 0.65, 0.15, Z.validation - 0.55], title: "back row: on validation", align: "center" },
    { id: "leak-chance", position: [XS[0]! - 0.9, FACTS.leakChance.value * H + 0.25, 0], title: `chance ${FACTS.leakChance.display}`, align: "center" },
    { id: "leak-value", position: [chosen.x, value * H + 0.55, chosen.z], title: pct1(value), detail: "balanced accuracy", tone: "accent" },
  ];
}

