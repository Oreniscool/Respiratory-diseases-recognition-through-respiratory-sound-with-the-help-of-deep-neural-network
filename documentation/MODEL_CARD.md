# RespiNet model card

## Status

Research prototype; not clinically validated and not intended for diagnosis,
screening, triage, treatment, or reassurance. The checked-in H5 artifact is a
legacy artifact without a verified class/preprocessing contract and is blocked
from serving.

## Intended use

- Educational exploration of respiratory-audio classification.
- Reproducible ML-method development on the ICBHI 2017 dataset.
- Local demonstrations using non-sensitive data.

## Out-of-scope use

- Real-patient clinical decisions.
- Ruling disease in or out.
- Emergency or remote triage.
- Autonomous treatment recommendations.
- Performance comparisons using the archived validation values.

## Inputs and outputs

The current source expects mono audio resampled to 22.05 kHz and converts audio
into 40 MFCC, 40 delta, and 40 delta-delta features. It evaluates overlapping
200-frame windows across the complete recording, then averages calibrated window
probabilities. The model outputs a distribution over the ordered classes stored
in a verified `model_metadata.json` contract.

Raw softmax values are calibrated using validation-set temperature scaling before
they are returned. The service can abstain when confidence is low or entropy is
high, but this remains a research-only heuristic. Unsupported sounds, silence,
noise, unseen devices, and out-of-distribution populations may still receive a
high probability.

## Evaluation requirement

A publishable model must be trained and evaluated using patient-disjoint
partitions created before augmentation. Report at least:

- Locked-test accuracy and balanced accuracy.
- Recording-level and patient-aggregated results.
- Macro and per-class precision, recall/sensitivity, specificity, and F1.
- Confusion matrix and one-vs-rest AUROC.
- Log loss, Brier score, reliability plot, and calibration error.
- Patient-bootstrap confidence intervals.
- Results by device, recording location, relevant demographics, and audio
  quality when metadata permits.

## Known limitations

- Small, geographically and technically constrained benchmark dataset.
- Patient-level labels may not fully describe every recorded respiratory cycle.
- Windowing, calibration, and abstention need a newly trained verified artifact
  before they have any evidence of usefulness.
- Inference-time denoising is disabled unless it is explicitly verified in the
  training contract.
- No external clinical validation, prospective study, or OOD detector.
- Current explanation overlays provide time-region sensitivity, not causal or
  frequency-specific clinical evidence.

## Artifact requirements

Do not deploy a model unless its hash, ordered classes, preprocessing settings,
split-manifest hash, training seed, evaluation and calibration files, provenance
hashes, limitations, and source revision are recorded together and verified at
server startup.
