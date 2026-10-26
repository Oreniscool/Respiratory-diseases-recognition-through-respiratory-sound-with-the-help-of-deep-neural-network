import { FACTS } from "./facts";

/** Scene 11: problems that came up and were solved (spec §4). Numbers come from FACTS. */
export const CHALLENGES: { id: string; title: string; problem: string; fix: string; source: string }[] = [
  {
    id: "labels",
    title: "Wrong labels",
    problem: `A scrambled diagnosis file had mislabelled the ICBHI patients, and validation accuracy collapsed to ${FACTS.labelCollapse.display}.`,
    fix: "Labels are now checked against the published ICBHI distribution before any training starts.",
    source: FACTS.labelCollapse.source,
  },
  {
    id: "copies",
    title: "The same audio twice",
    problem: `${FACTS.copiedClips.display} of ${FACTS.kaggleClips.display} Kaggle clips, including all ${FACTS.copiedCopd.display} COPD clips, were cut from ICBHI recordings already in the data. They had inflated an earlier score to ${FACTS.inflatedScore.display}.`,
    fix: "The copies were found by cross-correlation, removed, and confirmed by an independent fingerprint method; the model was retrained on clean data.",
    source: `${FACTS.copiedClips.source}; research/DECISION_LOG.md D-02, D-30`,
  },
  {
    id: "ids",
    title: "Made-up patient IDs",
    problem: `Kaggle file numbers are not patients, and ${FACTS.kauhCutClips.display} clips were cut from KAUH recordings.`,
    fix: "Those clips carry their real KAUH patient IDs, so one patient never lands on both sides of the split.",
    source: `${FACTS.kauhCutClips.source}; research/DECISION_LOG.md D-08`,
  },
  {
    id: "duplicates",
    title: "Exact duplicates",
    problem: `${FACTS.byteDuplicates.display} files were byte-for-byte identical.`,
    fix: "Duplicates are removed by their SHA-256 hash before the split.",
    source: FACTS.byteDuplicates.source,
  },
  {
    id: "early-stop",
    title: "Training stopped too early",
    problem: `Early stopping watched a loss that wobbled while validation accuracy climbed ${FACTS.earlyStopFrom.display} → ${FACTS.earlyStopTo.display}.`,
    fix: `It now watches validation accuracy, with patience raised from ${FACTS.patienceFrom.display} to ${FACTS.patienceTo.display} epochs.`,
    source: FACTS.earlyStopFrom.source,
  },
  {
    id: "parity",
    title: "Served model ≠ evaluated model",
    problem: `GPU rounding (TF32) shifted the logistic heads by up to ${FACTS.tf32Drift.display}, and the saved file could be a later epoch than the one evaluated.`,
    fix: `The heads always run on the CPU with a ${FACTS.headCheckTol.display} check, and the restored best model is the one saved.`,
    source: "research/DECISION_LOG.md D-23, D-24",
  },
];
