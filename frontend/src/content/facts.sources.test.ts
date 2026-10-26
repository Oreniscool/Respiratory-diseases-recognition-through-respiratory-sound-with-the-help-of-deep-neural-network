// @vitest-environment node
/**
 * Re-checks src/content/facts.ts against the files it cites. Artifact checks skip when the gitignored
 * backend/artifacts/latest is absent (CI, a fresh clone); the evidence files and the sample are tracked.
 * Run alone with `npm run check:facts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FACTS, SAMPLE } from "./facts";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const read = (rel: string) => JSON.parse(readFileSync(resolve(root, rel), "utf8"));
const latest = resolve(root, "backend/artifacts/latest");
const haveArtifacts = existsSync(resolve(latest, "test_metrics.json"));
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

it("the bundled sample equals documentation/frontend_sample_predict.json", () => {
  expect(SAMPLE).toEqual(read("documentation/frontend_sample_predict.json"));
});

it("copy-audit counts match the tracked evidence files", () => {
  const icbhi = read("backend/data/kaggle_icbhi_overlap.summary.json");
  expect(FACTS.kaggleClips.value).toBe(icbhi.clips);
  expect(FACTS.copiedClips.value).toBe(icbhi.overlaps);
  expect(FACTS.copiedCopd.value).toBe(icbhi.by_class.copd.overlaps);
  expect(FACTS.kauhCutClips.value).toBe(read("backend/data/kaggle_kauh_overlap.summary.json").overlaps);
});

describe.skipIf(!haveArtifacts)("served-model artifacts", () => {
  it("test metrics", () => {
    const t = read("backend/artifacts/latest/test_metrics.json");
    const ci = t.patient_bootstrap_confidence_intervals.metrics.accuracy;
    expect(FACTS.patientAccuracy.value).toBe(r4(t.patient_level.accuracy));
    expect(FACTS.patientBalancedAccuracy.value).toBe(r4(t.patient_level.balanced_accuracy));
    expect(FACTS.ciLow.value).toBe(r4(ci.lower));
    expect(FACTS.ciHigh.value).toBe(r4(ci.upper));
    expect(FACTS.eceTest.value).toBe(r4(t.recording_level.expected_calibration_error));
    expect(FACTS.testPatients.value).toBe(t.patient_level.num_patients);
    expect(FACTS.reliabilityBins.value).toEqual(
      t.recording_level.calibration_curve.map((b: Record<string, number>) => ({
        lower: Math.round(b.lower! * 10) / 10, upper: Math.round(b.upper! * 10) / 10, count: b.count,
        meanConfidence: r4(b.mean_confidence!), accuracy: r4(b.empirical_accuracy!),
      })),
    );
    for (const [name, rec] of Object.entries(FACTS.perClassRecallPatient.value)) {
      const row = t.patient_level.classification_report[name];
      expect(rec, name).toEqual({ recall: r4(row.recall), patients: row.support });
    }
  });

  it("calibration and abstention", () => {
    const c = read("backend/artifacts/latest/calibration.json");
    expect(FACTS.fusedTemperature.value).toBe(r4(c.temperature));
    expect(FACTS.nllBefore.value).toBe(r4(c.validation_nll_before));
    expect(FACTS.nllAfter.value).toBe(r4(c.validation_nll_after));
    expect(FACTS.minConfidence.value).toBe(r4(c.abstention.min_confidence));
    expect(FACTS.maxEntropy.value).toBe(Math.round(c.abstention.max_normalized_entropy * 1e3) / 1e3);
    expect(FACTS.coverage.value).toBe(c.abstention.target_validation_coverage);
  });

  it("preprocessing and fusion", () => {
    const m = read("backend/artifacts/latest/model_metadata.json");
    const p = m.preprocessing;
    expect([FACTS.sampleRate.value, FACTS.windowFrames.value, FACTS.windowHop.value, FACTS.hopSamples.value, FACTS.nFft.value, FACTS.nMfcc.value])
      .toEqual([p.sample_rate, p.max_len, p.window_hop, p.hop_length, p.n_fft, p.n_mfcc]);
    expect([FACTS.bandLowHz.value, FACTS.bandHighHz.value]).toEqual([p.lowcut, p.highcut]);
    expect(p.feature_type).toBe("mfcc"); // n_mels only applies to log-mel; MFCCs use librosa's 128
    const temps = Object.fromEntries(m.fusion.members.map((x: { extractor?: string; temperature: number }) => [x.extractor ?? "respinet", r4(x.temperature)]));
    expect(FACTS.memberTemperatures.value).toEqual(temps);
  });

  it("cohort and split", () => {
    const a = read("backend/artifacts/latest/dataset_audit.json");
    const s = read("backend/artifacts/latest/split_summary.json").splits;
    expect([FACTS.recordings.value, FACTS.patients.value]).toEqual([a.recordings, a.patients]);
    expect(FACTS.icbhi.value).toBe(`${a.per_source.icbhi.recordings}/${a.per_source.icbhi.patients}`);
    expect(FACTS.kaggleRemainder.value).toBe(`${a.per_source.kaggle_asthma_v2.recordings}/${a.per_source.kaggle_asthma_v2.patients}`);
    expect(FACTS.kauh.value).toBe(`${a.per_source.kauh.recordings}/${a.per_source.kauh.patients}`);
    expect(FACTS.splitPatients.value).toBe(`${s.train.patients}/${s.validation.patients}/${s.test.patients}`);
    expect(FACTS.splitRecordings.value).toBe(`${s.train.recordings}/${s.validation.recordings}/${s.test.recordings}`);
    expect(readFileSync(resolve(latest, "model_summary.txt"), "utf8")).toContain("458,701");
  });
});
