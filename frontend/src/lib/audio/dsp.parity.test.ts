// @vitest-environment node
/** Local parity check against librosa (input written by scripts/dsp-parity.py); skipped when absent. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mfcc } from "./mfcc";
import { stftPower } from "./stft";

const here = fileURLToPath(new URL(".", import.meta.url));
const file = process.env.RESPINET_PARITY_JSON
  ?? resolve(here, "../../../../.superpowers/sdd/2026-10-26-respinet-frontend-rebuild/parity.json");

describe.skipIf(!existsSync(file))("MFCC parity with librosa", () => {
  it("coefficients 1–12 differ by less than 0.5 on average", () => {
    const data = JSON.parse(readFileSync(file, "utf8")) as { sr: number; samples: number[]; mfcc: number[][] };
    const ours = mfcc(stftPower(Float32Array.from(data.samples)), data.sr);
    expect(ours).toHaveLength(data.mfcc.length);
    let total = 0, count = 0, worst = 0;
    for (let t = 0; t < ours.length; t++) {
      for (let k = 1; k <= 12; k++) {
        const d = Math.abs(ours[t]![k]! - data.mfcc[t]![k]!);
        total += d; count += 1; worst = Math.max(worst, d);
      }
    }
    console.info(`MFCC parity: mean |Δ| ${(total / count).toExponential(2)}, max ${worst.toExponential(2)} over ${ours.length} frames`);
    expect(total / count).toBeLessThan(0.5);
  });
});
