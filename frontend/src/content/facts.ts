import type { PredictResult } from "../lib/api/types";
import sample from "./sample-predict.json";

export { WHY } from "./why";

/** A number shown on screen, with where it comes from. `facts.sources.test.ts` re-checks them. */
export type Fact<T = number | string> = { value: T; display: string; source: string };

export const SAMPLE = sample as PredictResult;

const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const int = (v: number) => v.toLocaleString("en-US");
const n = (value: number, source: string, display = int(value)): Fact<number> => ({ value, display, source });
const ratio = (value: number, source: string, dp = 1): Fact<number> => ({ value, display: pct(value, dp), source });

const AUDIT = "backend/artifacts/latest/dataset_audit.json";
const SPLIT = "backend/artifacts/latest/split_summary.json";
const PRE = "backend/artifacts/latest/model_metadata.json → preprocessing";
const FUSION = "backend/artifacts/latest/model_metadata.json → fusion";
const CAL = "backend/artifacts/latest/calibration.json";
const TEST = "backend/artifacts/latest/test_metrics.json";
const SUMMARY = "backend/artifacts/latest/model_summary.txt";
const OVERLAP = "backend/data/kaggle_icbhi_overlap.summary.json";
const KAUH_OVERLAP = "backend/data/kaggle_kauh_overlap.summary.json";
const CHRON = "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md";

export type ReliabilityBin = { lower: number; upper: number; count: number; meanConfidence: number; accuracy: number };
export type ClassRecall = { recall: number; patients: number };

export const FACTS = {
  recordings: n(1551, AUDIT),
  patients: n(244, AUDIT),
  icbhi: { value: "920/126", display: "920 recordings · 126 patients", source: `${AUDIT} → per_source.icbhi` },
  kaggleRemainder: { value: "568/97", display: "568 recordings · 97 patients", source: `${AUDIT} → per_source` },
  kauh: { value: "63/21", display: "63 recordings · 21 patients", source: `${AUDIT} → per_source.kauh` },
  splitPatients: { value: "146/49/49", display: "146 · 49 · 49", source: SPLIT },
  splitRecordings: { value: "837/325/389", display: "837 · 325 · 389", source: SPLIT },
  bandLowHz: n(100, `${PRE}.lowcut`),
  bandHighHz: n(2000, `${PRE}.highcut`),
  filterOrder: n(4, "backend/preprocessing.py bandpass(order=4)"),
  sampleRate: n(22050, `${PRE}.sample_rate`),
  windowFrames: n(200, `${PRE}.max_len`),
  windowHop: n(100, `${PRE}.window_hop`),
  hopSamples: n(512, `${PRE}.hop_length`),
  nFft: n(2048, `${PRE}.n_fft`),
  nMels: n(128, "librosa.feature.mfcc default (preprocessing.py calls it without n_mels)"),
  nMfcc: n(40, `${PRE}.n_mfcc`),
  featuresPerFrame: n(120, `${PRE} (40 MFCC + Δ + Δ²)`),
  parameters: n(458701, SUMMARY),
  seeds: { value: "42, 43, 44", display: "42, 43, 44", source: FUSION },
  fusedTemperature: n(0.5489, `${CAL}.temperature`, "0.5489"),
  memberTemperatures: {
    value: { respinet: 0.9099, yamnet: 1.057, opera_ce: 1.5085, hear: 1.0973 },
    display: "0.91 · 1.06 · 1.51 · 1.10",
    source: `${FUSION}.members[].temperature`,
  },
  minConfidence: ratio(0.6629, `${CAL} → min_confidence (model_metadata.json uncertainty)`),
  maxEntropy: n(0.506, `${CAL} → max_normalized_entropy`, "0.51"),
  coverage: ratio(0.8, `${CAL} → target coverage`, 0),
  eceTest: n(0.0743, `${TEST} → recording_level.expected_calibration_error`, "0.074"),
  nllBefore: n(0.5675, `${CAL}.validation_nll_before`, "0.568"),
  nllAfter: n(0.4643, `${CAL}.validation_nll_after`, "0.464"),
  patientAccuracy: ratio(0.7551, `${TEST} → patient_level.accuracy`),
  patientBalancedAccuracy: ratio(0.7487, `${TEST} → patient_level.balanced_accuracy`),
  ciLow: ratio(0.6327, `${TEST} → patient_bootstrap_confidence_intervals.metrics.accuracy.lower`),
  ciHigh: ratio(0.8776, `${TEST} → patient_bootstrap_confidence_intervals.metrics.accuracy.upper`),
  testPatients: n(49, `${TEST} → patient_level.num_patients`),
  copiedClips: n(631, `${OVERLAP}.overlaps`),
  kaggleClips: n(1211, `${OVERLAP}.clips`),
  copiedCopd: n(401, `${OVERLAP}.by_class.copd.overlaps`),
  kauhCutClips: n(316, `${KAUH_OVERLAP}.overlaps`),
  byteDuplicates: n(12, "backend/CLAUDE.md → deduplicate_records drops 12 byte-identical Kaggle files"),
  labelCollapse: { value: "27–29%", display: "27–29%", source: `${CHRON} §8.5; CLAUDE.md` },
  earlyStopFrom: ratio(0.41, `${CHRON} (line 136)`, 0),
  earlyStopTo: ratio(0.59, `${CHRON} (line 136)`, 0),
  patienceFrom: n(12, `${CHRON} (line 136)`),
  patienceTo: n(18, `${CHRON} (line 136)`),
  tf32Drift: n(2.2e-3, "research/DECISION_LOG.md D-23", "2.2 × 10⁻³"),
  headCheckTol: n(1e-4, "research/DECISION_LOG.md D-23; backend main.HEAD_EXPORT_ATOL", "10⁻⁴"),
  inflatedScore: { value: "82%", display: "82%", source: "CLAUDE.md §6 (82.09%, contaminated 2026-08-14 model)" },
  reliabilityBins: {
    value: [
      { lower: 0.4, upper: 0.5, count: 13, meanConfidence: 0.4657, accuracy: 0.2308 },
      { lower: 0.5, upper: 0.6, count: 24, meanConfidence: 0.5479, accuracy: 0.5833 },
      { lower: 0.6, upper: 0.7, count: 33, meanConfidence: 0.6565, accuracy: 0.8182 },
      { lower: 0.7, upper: 0.8, count: 54, meanConfidence: 0.7534, accuracy: 0.8148 },
      { lower: 0.8, upper: 0.9, count: 69, meanConfidence: 0.8547, accuracy: 0.7536 },
      { lower: 0.9, upper: 1.0, count: 196, meanConfidence: 0.9611, accuracy: 0.9133 },
    ] as ReliabilityBin[],
    display: "389 test recordings in 6 bins",
    source: `${TEST} → recording_level.calibration_curve`,
  },
  perClassRecallPatient: {
    value: {
      asthma: { recall: 1, patients: 8 },
      bronchial: { recall: 0.625, patients: 8 },
      copd: { recall: 0.8571, patients: 14 },
      healthy: { recall: 0.6364, patients: 11 },
      pneumonia: { recall: 0.625, patients: 8 },
    } as Record<string, ClassRecall>,
    display: "per-class recall, 49 test patients",
    source: `${TEST} → patient_level.classification_report`,
  },
} as const;

export type FactKey = keyof typeof FACTS;
