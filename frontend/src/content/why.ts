/** The reasons behind each design choice, paraphrased from the cited record. */
export const WHY = {
  patientSplit: {
    text: "Recordings from one patient sound alike, so each patient sits on exactly one side: training, validation or test. Otherwise the test would partly reward memory.",
    source: "research/DECISION_LOG.md D-01; backend split_by_patient (CLAUDE.md invariant 1)",
  },
  removeCopies: {
    text: "631 Kaggle clips were cut from ICBHI recordings that were already in the data, under different made-up patient numbers. Keeping both would put the same audio in training and in test.",
    source: "research/DECISION_LOG.md D-02; backend/data/kaggle_icbhi_overlap.summary.json",
  },
  bandpass: {
    text: "Without the filter, the model learned heartbeat thuds below 100 Hz and sensor noise above 2 kHz instead of breath sounds.",
    source: "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md §1 item 5 (line 77)",
  },
  residualSkip: {
    text: "Fine detail found by the convolutions was lost inside the first GRU, so a shortcut connection carries it past.",
    source: "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md (line 142)",
  },
  dualPooling: {
    text: "A single attention average blurred short crackles into the surrounding sound. Adding max-pooling keeps the strongest brief events, while attention keeps sustained wheezes.",
    source: "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md (line 140)",
  },
  fusion: {
    text: "The four-model combination was chosen by a rule fixed before the comparison, using patient-grouped cross-validation on the development patients only.",
    source: "research/DECISION_LOG.md D-05, D-21, D-27",
  },
  calibration: {
    text: "Raw network scores are not probabilities. Temperature scaling, fitted on validation data, makes a score of 80% mean roughly 80% right on similar recordings.",
    source: "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md §5.3",
  },
  abstention: {
    text: "When the top score is low or spread across classes, the model says it is unsure instead of guessing.",
    source: "documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md (line 426); backend/artifacts/latest/calibration.json",
  },
} as const;

export type WhyKey = keyof typeof WHY;
