# RespiNet model card

## Status

Research prototype; not clinically validated and not intended for diagnosis,
screening, triage, treatment, or reassurance. The checked-in H5 artifact is a
legacy artifact without a verified class/preprocessing contract.

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

The current source expects mono audio resampled to 22.05 kHz and converts the
first 200 MFCC frames into 40 MFCC, 40 delta, and 40 delta-delta features. The
model outputs a softmax distribution over the ordered classes stored in
`model_metadata.json`.

Softmax values are uncalibrated model probabilities. Unsupported sounds,
silence, noise, unseen devices, and out-of-distribution populations may still
receive a high probability because abstention is not implemented.

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
- The fixed feature window discards audio after the configured frame limit.
- Padding is not explicitly masked by the current convolutional architecture.
- Inference-time denoising was not part of the historical training pipeline.
- No external clinical validation, prospective study, OOD detector, or
  calibrated abstention threshold.
- Current explanation overlays provide time-region sensitivity, not causal or
  frequency-specific clinical evidence.

## Artifact requirements

Do not deploy a model unless its hash, ordered classes, preprocessing settings,
split-manifest hash, training seed, evaluation file, limitations, and source
revision are recorded together and verified at server startup.
