// @vitest-environment node
/**
 * Re-checks the story's research, training and server facts (src/content/facts.ts) and the generated arrays
 * (src/content/story-data.json) against the files they cite. Tracked evidence always runs; checks that need the
 * gitignored backend/artifacts skip when those files are absent (CI, a fresh clone).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../test/csv";
import { FACTS } from "./facts";
import { STORY_DATA } from "./storyData";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const text = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const json = (rel: string) => JSON.parse(text(rel));
const csv = (rel: string) => parseCsv(text(rel));
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const ledger = Object.fromEntries(csv("research/EXPERIMENT_LEDGER.csv").map((r) => [r.experiment_id, r]));
const secondary = (id: string) => JSON.parse(ledger[id]!.secondary_metrics!);
const claims = Object.fromEntries(csv("research/CLAIM_EVIDENCE_MATRIX.csv").map((r) => [r.claim_id, r]));
const has = (rel: string) => existsSync(resolve(root, rel));

describe("chapter 1: the original protocol and its leaks", () => {
  it("reported accuracy and protocol details", () => {
    expect(FACTS.reportedAccuracy.value).toBe(Number(ledger["EXP-000"]!.primary_value));
    expect(FACTS.reportedSd.value).toBe(secondary("EXP-000").reported_sd);
    const doc = text("backend/experiments/leakage_ladder.py");
    expect(doc).toContain("six classes");
    expect(doc).toContain(FACTS.originalParameters.display);
    expect(doc).toContain("four augmented");
    expect(doc).toContain("75/25");
    expect([FACTS.originalCopies.value, FACTS.originalClasses.value]).toEqual([4, 6]);
  });

  it("leak ladder rungs", () => {
    const x = secondary("X1");
    const mean = (rung: string) => r4(x[rung].balanced_accuracy.mean);
    expect(FACTS.leakLadder.value).toEqual({
      sample: { test: mean("L0"), validation: mean("L1") },
      recording: { test: mean("L2T"), validation: mean("L2") },
      patient: { test: mean("L3T"), validation: mean("L3") },
    });
    expect(FACTS.leakChance.value).toBe(x.constant_baselines.L0.constant_balanced_accuracy);
    expect(FACTS.leakRepeats.value).toBe(x.L0.repeats);
  });
});

describe("chapter 2: the audit", () => {
  const icbhi = json("backend/data/kaggle_icbhi_overlap.summary.json");
  const kauh = json("backend/data/kaggle_kauh_overlap.summary.json");
  const copies = csv("backend/data/kaggle_icbhi_overlap.csv").filter((r) => r.is_overlap === "True");

  it("ICBHI diagnoses and the class mapping counts", () => {
    const block = text("backend/dataset_provenance.py").match(/ICBHI_2017_PATIENT_COUNTS = \{([^}]*)\}/)![1]!;
    const counts = Object.fromEntries([...block.matchAll(/"(\w+)": (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(FACTS.icbhiDiagnoses.value).toEqual(counts);
  });

  it("clip origins by class, untraced clips and score gap", () => {
    for (const [c, o] of Object.entries(FACTS.clipOrigins.value)) {
      expect(o, c).toEqual({ clips: icbhi.by_class[c].clips, icbhi: icbhi.by_class[c].overlaps, kauh: kauh.by_class[c].overlaps });
    }
    expect(FACTS.untracedClips.value).toBe(icbhi.clips - icbhi.overlaps - kauh.overlaps);
    expect([FACTS.nccThreshold.value, FACTS.minCopyNcc.value, FACTS.maxNonCopyNcc.value])
      .toEqual([icbhi.threshold, icbhi.min_overlap_ncc, icbhi.max_non_overlap_ncc]);
  });

  it("recordings and patients behind the copies", () => {
    const recordings = new Set(copies.map((r) => r.reference));
    const patients = new Set(copies.map((r) => r.reference!.split("_")[0]));
    expect(FACTS.copiedRecordings.value).toBe(recordings.size);
    expect(FACTS.copiedPatients.value).toBe(patients.size);
    const icbhiPatients = Object.values(FACTS.icbhiDiagnoses.value).reduce((a, b) => a + b, 0);
    expect(FACTS.cleanIcbhiPatients.value).toBe(icbhiPatients - patients.size);
    const kauhCopies = csv("backend/data/kaggle_kauh_overlap.csv").filter((r) => r.is_overlap === "True");
    expect(FACTS.kauhSourceRecordings.value).toBe(new Set(kauhCopies.map((r) => r.reference)).size);
  });

  it("matcher settings and its validation", () => {
    const matcher = text("backend/cross_dataset_overlap.py");
    expect(matcher).toContain("MATCH_SAMPLE_RATE = 4_000");
    expect(matcher).toContain("MATCH_BAND_HZ = (100.0, 1_000.0)");
    const negative = json("backend/data/kauh_icbhi_overlap.summary.json");
    expect(FACTS.kauhIcbhiMatches.value).toBe(`${negative.overlaps}/${negative.clips}`);
    expect(claims["C-16"]!.claim).toContain("99 of 100");
    expect(claims["C-16"]!.notes).toContain("20 hardest");
    expect(claims["C-16"]!.notes).toContain("19 decided, all agree");
    expect(claims["C-31"]!.notes).toContain("631/631");
    expect(claims["C-31"]!.notes).toContain("313/316");
    expect(Number(ledger.FP!.primary_value)).toBe(1);
  });

  it("the copies experiment (C4)", () => {
    const c4 = secondary("C4");
    for (const [c, r] of Object.entries(FACTS.contaminationWithin.value)) {
      const s = c4.within_model[c];
      expect(r, c).toEqual({ a: s.copied, b: s.clean, ci: s.difference_ci95, patients: `${s.patients[0]} vs ${s.patients[1]}` });
    }
    for (const [c, r] of Object.entries(FACTS.contaminationBetween.value)) {
      const s = c4.between_models[c];
      expect(r, c).toEqual({ a: s.with_copies, b: s.without_copies, ci: s.difference_ci95, patients: String(s.patients) });
    }
  });

  it("generated arrays equal a recomputation from the overlap CSV", () => {
    const all = csv("backend/data/kaggle_icbhi_overlap.csv");
    const { binWidth, counts } = STORY_DATA.nccHistogram;
    const recount = Array.from({ length: counts.length }, () => 0);
    for (const r of all) recount[Math.min(counts.length - 1, Math.floor(Number(r.best_ncc) / binWidth))]! += 1;
    expect(counts).toEqual(recount);
    const tally = new Map<string, number>();
    for (const r of copies) tally.set(r.reference!, (tally.get(r.reference!) ?? 0) + 1);
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    const one = STORY_DATA.oneRecording;
    expect(one.reference).toBe(top[0]);
    expect(one.clips.map((c) => c.offset)).toEqual(
      copies.filter((r) => r.reference === top[0]).map((r) => Number(r.offset_seconds)).sort((a, b) => a - b));
  });
});

describe("chapter 4 and 5: training, selection and the server", () => {
  it("model-selection variants", () => {
    for (const v of FACTS.variants.value) expect(v.value, v.id).toBe(Number(ledger[`EXP-R2B-${v.id}`]!.primary_value));
    expect(text("backend/experiments/cv.py")).toContain(`FOLDS = ${FACTS.cvFolds.value}`);
  });

  it("augmentation and server defaults in the source", () => {
    const fx = text("backend/featureExtraction.py");
    expect(fx).toContain(`snr_db=${FACTS.noiseSnrDb.value}.0`);
    expect(fx).toContain("shift(data, 1_600)");
    expect(fx).toContain("stretch(data, 1.2)");
    expect(fx).toContain("stretch(data, 0.8)");
    const server = text("backend/server.py");
    expect(server).toContain(`"RESPINET_MAX_UPLOAD_MB", "${FACTS.maxUploadMb.value}"`);
    expect(server).toContain(`"RESPINET_MAX_AUDIO_SECONDS", "${FACTS.maxAudioSeconds.value}"`);
    expect(server).toContain(`"RESPINET_RATE_LIMIT_PER_MINUTE", "${FACTS.rateLimit.value}"`);
    expect(text("backend/pretrained.py")).toContain("YAMNET_SAMPLE_RATE = 16_000");
  });

  describe.skipIf(!has("backend/artifacts/latest/model_metadata.json"))("served-model artifacts", () => {
    it("training hyperparameters", () => {
      const hp = json("backend/artifacts/latest/model_metadata.json").training.hyperparameters;
      expect([FACTS.focalGamma.value, FACTS.focalAlpha.value, FACTS.labelSmoothing.value, FACTS.learningRate.value,
        FACTS.batchSize.value, FACTS.maxEpochs.value, FACTS.patience.value])
        .toEqual([hp.focal_gamma, hp.focal_alpha, hp.label_smoothing, hp.learning_rate, hp.batch_size, hp.max_epochs, hp.early_stopping.patience]);
      expect([FACTS.specFreqMaxBins.value, FACTS.specTimeMaxFrames.value]).toEqual([hp.spec_augment.max_freq_mask, hp.spec_augment.max_time_mask]);
    });

    it("ICBHI class counts and development patients", () => {
      const audit = json("backend/artifacts/latest/dataset_audit.json");
      expect(FACTS.icbhiRecordingsByClass.value).toEqual(audit.per_source.icbhi.recording_label_counts);
      const s = json("backend/artifacts/latest/split_summary.json").splits;
      expect(FACTS.devPatients.value).toBe(s.train.patients + s.validation.patients);
    });

    it("training curve equals the training history", () => {
      const h = json("backend/artifacts/latest/training_history.json");
      const t = STORY_DATA.trainingCurve!;
      expect(t.valAccuracy).toEqual(h.val_accuracy.map(r4));
      expect(t.loss).toEqual(h.loss.map(r4));
      expect(t.epochs).toBe(h.val_accuracy.length);
      expect(t.epochs - t.restoredEpoch).toBe(FACTS.patience.value);
      expect(FACTS.restoredEpochs.value.split("/")[0]).toBe(String(t.restoredEpoch));
    });
  });

  it.skipIf(!has("backend/artifacts/experiments/contamination/model_kaggle_all/split_summary.json"))("C4 training sizes", () => {
    const size = (m: string) => json(`backend/artifacts/experiments/contamination/${m}/split_summary.json`).splits.train.recordings;
    expect(FACTS.c4TrainingRecordings.value).toBe(`${size("model_kaggle_all")}/${size("model_kaggle_clean")}`);
  });
});
