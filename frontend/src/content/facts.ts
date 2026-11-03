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
const LEDGER = "research/EXPERIMENT_LEDGER.csv";
const CLAIMS = "research/CLAIM_EVIDENCE_MATRIX.csv";
const OVERLAP_CSV = "backend/data/kaggle_icbhi_overlap.csv";
const HYPER = "backend/artifacts/latest/model_metadata.json → training.hyperparameters";

export type ReliabilityBin = { lower: number; upper: number; count: number; meanConfidence: number; accuracy: number };
export type ClassRecall = { recall: number; patients: number };
/** Balanced accuracy (mean of 20 seeds) for one split unit, with the checkpoint chosen on the test or validation split. */
export type LeakRung = { test: number; validation: number };
export type ClipOrigin = { clips: number; icbhi: number; kauh: number };
export type Contrast = { a: number; b: number; ci: [number, number]; patients: string };
export type Variant = { id: string; label: string; value: number; adopted?: boolean; reference?: boolean };

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
  restoredEpochs: { value: "45/46/78", display: "45, 46 and 78", source: "backend/artifacts/latest/training_history.json; CLAUDE.md §6 (restored epochs per seed)" },
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

  // ---- Chapter 1: where it began (the 2020/21 project and its leaks) ----
  reportedAccuracy: ratio(0.9567, `${LEDGER} → EXP-000`, 2),
  reportedSd: n(0.0077, `${LEDGER} → EXP-000 secondary_metrics.reported_sd`, "0.77"),
  originalClasses: n(6, "backend/experiments/leakage_ladder.py (docstring: six ICBHI classes, as in the original code)"),
  originalParameters: n(328726, "backend/experiments/leakage_ladder.py (docstring: the original GRU network)"),
  leakLadder: {
    value: {
      sample: { test: 0.8716, validation: 0.7985 },
      recording: { test: 0.5866, validation: 0.5112 },
      patient: { test: 0.4916, validation: 0.3845 },
    } as Record<"sample" | "recording" | "patient", LeakRung>,
    display: "balanced accuracy, mean of 20 seeds per rung",
    source: `${LEDGER} → X1 secondary_metrics (L0, L1, L2T, L2, L3T, L3)`,
  },
  leakChance: ratio(0.1667, `${LEDGER} → X1 secondary_metrics.constant_baselines.L0.constant_balanced_accuracy`),
  leakRepeats: n(20, `${LEDGER} → X1 secondary_metrics.L0.repeats`),
  originalCopies: n(4, "backend/experiments/leakage_ladder.py (docstring: four augmented copies per non-COPD recording)"),
  originalSplit: { value: "75/25", display: "75 / 25", source: "backend/experiments/leakage_ladder.py (docstring: random sample-level 75/25 split)" },

  // ---- Chapter 2: the discovery (the Kaggle–ICBHI audit) ----
  icbhiDiagnoses: {
    value: { COPD: 64, Healthy: 26, URTI: 14, Bronchiectasis: 7, Bronchiolitis: 6, Pneumonia: 6, LRTI: 2, Asthma: 1 } as Record<string, number>,
    display: "126 ICBHI patients by diagnosis",
    source: "backend/dataset_provenance.py → ICBHI_2017_PATIENT_COUNTS",
  },
  icbhiRecordingsByClass: {
    value: { asthma: 1, bronchial: 54, copd: 793, healthy: 35, pneumonia: 37 } as Record<string, number>,
    display: "920 ICBHI recordings by class",
    source: `${AUDIT} → per_source.icbhi.recording_label_counts`,
  },
  clipOrigins: {
    value: {
      asthma: { clips: 288, icbhi: 0, kauh: 262 },
      bronchial: { clips: 104, icbhi: 51, kauh: 15 },
      copd: { clips: 401, icbhi: 401, kauh: 0 },
      healthy: { clips: 133, icbhi: 74, kauh: 0 },
      pneumonia: { clips: 285, icbhi: 105, kauh: 39 },
    } as Record<string, ClipOrigin>,
    display: "1,211 Kaggle clips by class and origin",
    source: `${OVERLAP} and ${KAUH_OVERLAP} → by_class`,
  },
  untracedClips: n(264, `${OVERLAP} and ${KAUH_OVERLAP}: clips − ICBHI copies − KAUH copies`),
  copiedRecordings: n(187, `${OVERLAP_CSV}: distinct references of the copies`),
  copiedPatients: n(60, `${OVERLAP_CSV}: distinct ICBHI patients behind the copies`),
  cleanIcbhiPatients: n(66, `126 ICBHI patients − the 60 in ${OVERLAP_CSV}`),
  kauhSourceRecordings: n(115, "backend/data/kaggle_kauh_overlap.csv: distinct references of the copies"),
  nccThreshold: n(0.75, `${OVERLAP}.threshold`, "0.75"),
  matchRate: { value: "4000", display: "4 kHz", source: "backend/cross_dataset_overlap.py → MATCH_SAMPLE_RATE" },
  matchBand: { value: "100-1000", display: "100–1,000 Hz", source: "backend/cross_dataset_overlap.py → MATCH_BAND_HZ" },
  syntheticCuts: n(100, `${CLAIMS} → C-16 (100 synthetic degraded cuts)`),
  listeningCases: n(20, `${CLAIMS} → C-16 notes (20 hardest real cases)`),
  minCopyNcc: n(0.7951, `${OVERLAP}.min_overlap_ncc`, "0.795"),
  maxNonCopyNcc: n(0.6973, `${OVERLAP}.max_non_overlap_ncc`, "0.697"),
  syntheticRecall: { value: "99/100", display: "99 of 100", source: `${CLAIMS} → C-16` },
  kauhIcbhiMatches: { value: "0/336", display: "0 of 336", source: "backend/data/kauh_icbhi_overlap.summary.json" },
  listeningAgreement: { value: "19/19", display: "19 of 19", source: `${CLAIMS} → C-16 notes (20 hardest cases, 19 decided)` },
  fingerprintIcbhi: { value: "631/631", display: "631 of 631", source: `${CLAIMS} → C-31; ${LEDGER} → FP` },
  fingerprintKauh: { value: "313/316", display: "313 of 316", source: `${CLAIMS} → C-31` },
  contaminationWithin: {
    value: {
      copd: { a: 0.8108, b: 0.4153, ci: [0.2688, 0.5087], patients: "26 vs 38" },
      bronchial: { a: 0.625, b: 0.1316, ci: [0.2338, 0.8205], patients: "7 vs 22" },
    } as Record<string, Contrast>,
    display: "one Kaggle-trained model: copied vs clean ICBHI recordings (a = copied, b = clean)",
    source: `${LEDGER} → C4 secondary_metrics.within_model`,
  },
  contaminationBetween: {
    value: {
      healthy: { a: 0.9615, b: 0.1538, ci: [0.6538, 0.9359], patients: "21" },
      pneumonia: { a: 0.8529, b: 0.3235, ci: [0.2727, 0.7143], patients: "6" },
      bronchial: { a: 0.625, b: 0.4375, ci: [-0.25, 0.6154], patients: "7" },
    } as Record<string, Contrast>,
    display: "the same copied recordings: model trained with (a) vs without (b) the copies",
    source: `${LEDGER} → C4 secondary_metrics.between_models`,
  },
  c4TrainingRecordings: { value: "715/338", display: "715 vs 338", source: "backend/artifacts/experiments/contamination/model_kaggle_*/split_summary.json; paper §III-E" },

  // ---- Chapter 4: training and model selection ----
  focalGamma: n(2, `${HYPER}.focal_gamma`),
  focalAlpha: n(0.25, `${HYPER}.focal_alpha`, "0.25"),
  labelSmoothing: n(0.1, `${HYPER}.label_smoothing`, "0.1"),
  learningRate: n(0.0003, `${HYPER}.learning_rate`, "3 × 10⁻⁴"),
  batchSize: n(64, `${HYPER}.batch_size`),
  maxEpochs: n(80, `${HYPER}.max_epochs`),
  patience: n(18, `${HYPER}.early_stopping.patience`),
  noiseSnrDb: n(20, "backend/featureExtraction.py → add_noise(snr_db=20.0)"),
  shiftSamples: n(1600, "backend/featureExtraction.py → shift(data, 1_600)"),
  stretchRates: { value: "0.8/1.2", display: "×0.8 and ×1.2", source: "backend/featureExtraction.py → stretch(data, 0.8), stretch(data, 1.2)" },
  specFreqMasks: { value: "2×15", display: "2 frequency masks of up to 15 bins", source: `${HYPER}.spec_augment` },
  specTimeMasks: { value: "2×25", display: "2 time masks of up to 25 frames", source: `${HYPER}.spec_augment` },
  specFreqMaxBins: n(15, `${HYPER}.spec_augment.max_freq_mask`),
  specTimeMaxFrames: n(25, `${HYPER}.spec_augment.max_time_mask`),
  devPatients: n(195, `${SPLIT}: training + validation patients (146 + 49)`),
  cvFolds: n(3, "backend/experiments/cv.py (3-fold patient-grouped CV); research/DECISION_LOG.md D-04"),
  variants: {
    value: [
      { id: "E_yamnet", label: "YAMNet head", value: 0.6581 },
      { id: "E_opera_ce", label: "OPERA-CE head", value: 0.6769 },
      { id: "D3_x3", label: "RespiNet ×3", value: 0.6847 },
      { id: "D3_x3+E_yamnet", label: "RespiNet ×3 + YAMNet", value: 0.6994 },
      { id: "D0+E_yamnet", label: "RespiNet + YAMNet (reference)", value: 0.7013, reference: true },
      { id: "E_hear", label: "HeAR head", value: 0.7159 },
      { id: "D3_x3+E_yamnet+E_hear", label: "RespiNet ×3 + YAMNet + HeAR", value: 0.7312 },
      { id: "D3_x3+E_yamnet+E_opera_ce+E_hear", label: "All four (adopted)", value: 0.7492, adopted: true },
    ] as Variant[],
    display: "cross-validated patient balanced accuracy, development patients only",
    source: `${LEDGER} → EXP-R2B-* primary_value`,
  },

  // ---- Chapter 5: the server ----
  maxUploadMb: n(25, "backend/server.py → RESPINET_MAX_UPLOAD_MB default"),
  maxAudioSeconds: n(120, "backend/server.py → RESPINET_MAX_AUDIO_SECONDS default"),
  rateLimit: n(30, "backend/server.py → RESPINET_RATE_LIMIT_PER_MINUTE default"),
  embeddingRate: n(16000, "backend/pretrained.py → YAMNET_SAMPLE_RATE, OPERA_SAMPLE_RATE (16_000)"),
} as const;

export type FactKey = keyof typeof FACTS;
