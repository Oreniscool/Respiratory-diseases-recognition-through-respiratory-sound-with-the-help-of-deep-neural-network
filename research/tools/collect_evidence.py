"""Build research/EXPERIMENT_LEDGER.csv from artifact files, so no metric is typed by hand.

Each experiment is described once in REGISTRY (question, hypothesis, interpretation, decision —
prose only); every number comes from the artifact files it points to. Run from the repository
root:

    python research/tools/collect_evidence.py            # rewrite the ledger
    python research/tools/collect_evidence.py --check    # fail if the ledger is out of date

Artifacts live under backend/artifacts/ (gitignored, local). The ledger records their paths and
the split-manifest SHA-256 (frozen copies in research/splits/), so a reader with the artifacts can
re-derive every value.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "backend" / "artifacts"
LEDGER = ROOT / "research" / "EXPERIMENT_LEDGER.csv"

FIELDS = [
    "experiment_id", "title", "research_question", "hypothesis", "kind", "status",
    "code_version", "split_version", "split_manifest_sha256", "seed", "primary_metric",
    "primary_value", "secondary_metrics", "artifact_location", "evidence_type",
    "interpretation", "limitations", "decision", "justification",
]

SPLITS = {name: json.loads((ROOT / "research" / "splits" / name / "split_summary.json").read_text())
          for name in ("v0", "v1", "v2", "v3")}


def r4(value):
    return None if value is None else round(float(value), 4)


def model_metrics(directory: str) -> dict[str, object]:
    """Test-split metrics of a trained artifact (backend/artifacts/<directory>)."""
    path = ART / directory
    m = json.loads((path / "test_metrics.json").read_text())
    meta = json.loads((path / "model_metadata.json").read_text())
    rec, pat = m["recording_level"], m["patient_level"]
    ci = m.get("patient_bootstrap_confidence_intervals", {}).get("metrics", {}).get("accuracy", {})
    secondary = {
        "test_patient_accuracy": r4(pat["accuracy"]),
        "test_patient_accuracy_ci95": [r4(ci.get("lower")), r4(ci.get("upper"))] if ci else None,
        "test_recording_accuracy": r4(rec["accuracy"]),
        "test_recording_balanced_accuracy": r4(rec["balanced_accuracy"]),
        "test_patient_macro_f1": r4(pat["macro_f1"]),
        "test_patient_auroc": r4(pat.get("macro_ovr_roc_auc")),
        "test_recording_ece": r4(rec["expected_calibration_error"]),
        "test_patients": pat.get("num_patients") or pat.get("patients") or None,
    }
    if "by_source" in m:
        secondary["by_source_patient_accuracy"] = {
            source: r4(values["patient_level"]["accuracy"]) for source, values in m["by_source"].items()
        }
    return {
        "primary_metric": "test patient balanced accuracy",
        "primary_value": r4(pat["balanced_accuracy"]),
        "secondary": secondary,
        "code_version": meta.get("source_revision", "unknown")[:12],
        "seed": meta["training"]["seed"],
    }


def cv_metrics(round_dir: str, variant: str, reference: str | None) -> dict[str, object]:
    """Out-of-fold metrics of one CV variant (backend/artifacts/<round_dir>/results.json)."""
    results = json.loads((ART / round_dir / "results.json").read_text())
    r = results[variant]
    pat, rec = r["patient_level"], r["recording_level"]
    secondary = {
        "oof_patient_macro_f1": r4(pat["macro_f1"]),
        "oof_patient_accuracy": r4(pat["accuracy"]),
        "oof_recording_accuracy": r4(rec["accuracy"]),
        "oof_patient_auroc": r4(pat.get("macro_ovr_roc_auc")),
        "oof_recording_ece": r4(rec["expected_calibration_error"]),
    }
    shortcut = r.get("shortcut", {})
    for key in ("off_device_copd_sensitivity", "meditron_accuracy", "kauh_accuracy"):
        if shortcut.get(key) is not None:
            secondary[key] = r4(shortcut[key])
    if reference and f"vs_{reference}" in r:
        delta = r[f"vs_{reference}"]["balanced_accuracy"]
        secondary[f"delta_balanced_accuracy_vs_{reference}"] = {
            "point": r4(pat["balanced_accuracy"] - results[reference]["patient_level"]["balanced_accuracy"]),
            "ci95": [r4(delta["lower"]), r4(delta["upper"])], "p_improvement": r4(delta["p_improvement"]),
        }
    return {"primary_metric": "OOF patient balanced accuracy", "primary_value": r4(pat["balanced_accuracy"]),
            "secondary": secondary}


def external_metrics(path: str) -> dict[str, object]:
    e = json.loads((ART / path).read_text())
    return {
        "primary_metric": "external KAUH patient accuracy (in-label)",
        "primary_value": r4(e["patient_accuracy"]),
        "secondary": {
            "in_label_patients": e["in_label_patients"],
            "patient_sensitivity": {k: r4(v) for k, v in e["patient_sensitivity"].items()},
            "patient_predictions": e["patient_predictions"],
            "recording_abstention_in_label": r4(e["recording_abstention_in_label"]),
            "out_of_label_abstention": r4(e["out_of_label_abstention"]),
            "out_of_label_predictions": e["out_of_label_predictions"],
        },
        "code_version": (e.get("source_revision") or "unknown")[:12],
    }


def probe_metrics(path: str) -> dict[str, object]:
    p = json.loads((ART / path).read_text())
    return {
        "primary_metric": "probe balanced accuracy: dataset of origin (YAMNet)",
        "primary_value": r4(p["yamnet"]["dataset_of_origin"]),
        "secondary": {
            name: {
                k: ({probe: r4(result["balanced_accuracy"]) for probe, result in v.items()} if isinstance(v, dict) else r4(v))
                for k, v in values.items()
            }
            for name, values in p.items()
        },
    }


# --------------------------------------------------------------------------- registry
RQ = "RQ1: leakage/shortcut share of reported accuracy; cross-site generalization"


def row(eid, title, *, hypothesis="", kind="scientific", status="completed", split=None, seed="",
        code="", metrics=None, artifact="", evidence="artifact", interpretation="", limitations="",
        decision="", justification="", rq=RQ):
    metrics = metrics or {}
    return {
        "experiment_id": eid, "title": title, "research_question": rq, "hypothesis": hypothesis,
        "kind": kind, "status": status, "code_version": metrics.get("code_version", code),
        "split_version": split or "", "split_manifest_sha256": SPLITS[split]["split_manifest_sha256"] if split else "",
        "seed": metrics.get("seed", seed), "primary_metric": metrics.get("primary_metric", ""),
        "primary_value": metrics.get("primary_value", ""),
        "secondary_metrics": json.dumps(metrics.get("secondary", {}), sort_keys=True) if metrics.get("secondary") else "",
        "artifact_location": artifact, "evidence_type": evidence, "interpretation": interpretation,
        "limitations": limitations, "decision": decision, "justification": justification,
    }


def registry() -> list[dict[str, object]]:
    rows = [
        row("EXP-000", "Original paper claim (Basu & Rana, IEEE 2020)", kind="literature",
            evidence="paper", code="git 3ec7dc6 (original code)", seed="20 random splits",
            metrics={"primary_metric": "reported accuracy (random recording split, 6 classes)",
                     "primary_value": 0.9567, "secondary": {"reported_sd": 0.0077}},
            artifact="git show 3ec7dc6:Respiratory_Disease_Recognition_new.pdf",
            interpretation="Protocol contains three leaks: augmentation before split, recording-level random split, checkpoint selected on the test split.",
            limitations="Not reproduced yet (see X1).", decision="target of X1 leakage ladder",
            justification="Baseline claim the study re-examines."),
        row("EXP-001", "Legacy 2021 training run (8 classes, README curves)", kind="engineering",
            evidence="documentation", code="git 3ec7dc6", artifact="backend/best_model.h5; README history",
            interpretation="Documented best validation accuracy only; sample-level split; no test set or contract.",
            limitations="No artifact metrics; numbers come from README text only.",
            decision="not citable as performance", justification="Leakage-prone protocol, no verifiable artifact."),
        row("EXP-002", "Merged Kaggle V2 + ICBHI model (2026-08-14)", split="v0", kind="engineering",
            metrics=model_metrics("v3-2026-08-14"), artifact="backend/artifacts/v3-2026-08-14/",
            interpretation="Contaminated: 631 Kaggle clips are cuts of ICBHI recordings present under other patient IDs.",
            limitations="Leakage across split; inflated.", decision="superseded; must not be cited",
            justification="Dataset audit (EXP-003)."),
        row("EXP-003", "Kaggle V2 vs ICBHI overlap audit (normalized cross-correlation)", kind="scientific",
            evidence="artifact", artifact="backend/data/kaggle_icbhi_overlap.csv (+ .summary.json)",
            metrics={"primary_metric": "Kaggle clips that are verbatim cuts of ICBHI", "primary_value": 631,
                     "secondary": json.loads((ROOT / "backend/data/kaggle_icbhi_overlap.summary.json").read_text())},
            hypothesis="H2: public lung-sound datasets overlap; pseudo-IDs leak patients across splits",
            interpretation="52% of Kaggle V2 duplicates ICBHI audio, including all COPD clips.",
            limitations="NCC threshold 0.75 chosen from a clean bimodal gap; only ICBHI checked as reference here.",
            decision="drop the copies (fail-closed evidence file)", justification="Copies sat on both sides of the split."),
        row("EXP-004", "Leak-free retrain, RespiNet D0 (final phase)", split="v1",
            metrics=model_metrics("v3-2026-10-22-leakfree"), artifact="backend/artifacts/v3-2026-10-22-leakfree/",
            interpretation="Removing ICBHI copies lowered test accuracy relative to EXP-002.",
            limitations="Split v1 still had Kaggle pseudo-IDs mixing KAUH patients (found in EXP-010).",
            decision="superseded by later splits", justification="See EXP-010."),
    ]
    for variant, label in (("D0", "RespiNet D0"), ("D2", "RespiNet log-mel"), ("C1_mfccstats_lr", "MFCC stats + LR"),
                           ("C1_mfccstats_gbt", "MFCC stats + GBT"), ("C2_yamnet_lr", "YAMNet + LR"),
                           ("F1_D0+yamnet", "D0 + YAMNet fusion")):
        rows.append(row(f"EXP-R1-{variant}", f"Round-1 CV: {label}", split="v1", code="1860ca6", seed=42,
                        metrics=cv_metrics("experiments-round1", variant, None if variant == "D0" else "D0"),
                        artifact=f"backend/artifacts/experiments-round1/oof_{variant}.csv", kind="scientific",
                        hypothesis="secondary (H4): model/representation comparison",
                        interpretation="3-fold patient-grouped CV on the v1 development patients.",
                        limitations="Split v1 pseudo-IDs (see EXP-010); 3 folds; one seed.",
                        decision="F1 adopted by pre-registered rule" if variant == "F1_D0+yamnet" else "not adopted",
                        justification="Rule: >= +2 pts balanced acc and macro F1, P >= 0.90."))
    rows += [
        row("EXP-005", "Production RespiNet + YAMNet fusion (round 1)", split="v1",
            metrics=model_metrics("fusion-2026-10-22-oldsplit"), artifact="backend/artifacts/fusion-2026-10-22-oldsplit/",
            interpretation="Test set used once for the adopted round-1 configuration.",
            limitations="Split v1 leaked real KAUH patients across train/test.", decision="superseded",
            justification="EXP-010 changed patient identities."),
        row("EXP-006", "Failed production run (head-export check, TF32)", kind="engineering", status="failed", split="v1",
            artifact="backend/artifacts/failed-fusion-run-2026-10-22/",
            interpretation="Stopped at the exported-head equivalence check (GPU TF32 differs by up to 3.3e-4).",
            decision="check relaxed to 1e-3 + identical argmax (042a1bd); run repeated",
            justification="Kept for the record; no metrics."),
        row("EXP-010", "Kaggle V2 vs KAUH overlap audit + real patient IDs", hypothesis="H2",
            artifact="backend/data/kaggle_kauh_overlap.csv (+ .summary.json); backend/data/kauh_icbhi_overlap.csv",
            metrics={"primary_metric": "Kaggle clips cut from KAUH recordings", "primary_value": 316,
                     "secondary": json.loads((ROOT / "backend/data/kaggle_kauh_overlap.summary.json").read_text())},
            interpretation="57 of 64 matching Kaggle filename groups mixed several KAUH patients; clips now carry real KAUH IDs.",
            limitations=("264 of the 1,211 raw Kaggle clips (252 after removing the 12 byte duplicates) match neither "
                         "ICBHI nor KAUH; their grouping stays unverified."),
            decision="adopt real IDs (split v2)", justification="Filename pseudo-IDs split real patients across partitions."),
    ]
    for variant in ("D0", "D3", "E_yamnet", "E_yamnet_bandpass", "E_opera_ce", "E_opera_ct", "D0+E_yamnet",
                    "D3+E_yamnet", "D0+E_yamnet+E_opera_ce", "D3+E_yamnet+E_opera_ce", "D0+E_opera_ce",
                    "D0+E_yamnet_bandpass", "stack:D3+E_yamnet"):
        rows.append(row(f"EXP-R2A-{variant}", f"Round-2a CV: {variant}", split="v2",
                        code="c419919" if "D3" in variant else "3d7e5cf", seed=42,
                        metrics=cv_metrics("experiments-round2a", variant, None if variant == "D0+E_yamnet" else "D0+E_yamnet"),
                        artifact="backend/artifacts/experiments-round2a/results.json",
                        hypothesis="H4 (secondary) / H2 shortcut metrics",
                        interpretation="Reference R = D0+E_yamnet; fusions are equal-weight averages of calibrated OOF members.",
                        limitations="3 folds, one seed; dev set v2 (178 patients).",
                        decision="none met the pre-registered rule", justification="See ROUND2_EXPERIMENTS_REPORT.md section 5."))
    rows += [
        row("EXP-R2A-probes", "Shortcut probes (dataset / device / disease), split v2 dev", hypothesis="H2", split="v2",
            metrics=probe_metrics("experiments-round2a/shortcut_probes.json"), code="3d7e5cf",
            artifact="backend/artifacts/experiments-round2a/shortcut_probes.json",
            interpretation="Every representation identifies dataset and device more easily than disease.",
            limitations="Linear probes on recording-level features; ICBHI device only.",
            decision="supports H2", justification="Shortcut is available to all representations."),
        row("EXP-011", "External KAUH evaluation of the round-1 served model", hypothesis="H2",
            metrics=external_metrics("experiments-round2a/external/previous_served_model.json"),
            artifact="backend/artifacts/experiments-round2a/external/previous_served_model.json",
            interpretation="Healthy and COPD patients from KAUH were predicted asthma.",
            limitations="45 in-label patients (35 healthy, 9 COPD, 1 bronchial); one external site.",
            decision="supports H2", justification="Failure mode matches the training-data confound."),
        row("EXP-012", "Served R retrained on split v2 (round 2)", split="v2",
            metrics=model_metrics("fusion-round2-split2"), artifact="backend/artifacts/fusion-round2-split2/ (archived; was latest/)",
            interpretation="Test set used once; lower than EXP-005 because v1 shared KAUH patients across the split.",
            limitations=("In-cohort only. Checkpoint mismatch (D-24): these metrics describe the EarlyStopping-restored "
                         "weights (epoch 64); the served file is epoch 67, which EXP-013 evaluated."),
            decision="served model until round 2b",
            justification="No CV candidate met the rule."),
        row("EXP-013", "External KAUH evaluation of the round-2 served model", hypothesis="H2",
            metrics=external_metrics("experiments-round2a/external/served_round2.json"),
            artifact="backend/artifacts/experiments-round2a/external/served_round2.json",
            interpretation="Retraining on corrected IDs did not change the external failure.",
            limitations="Same external set as EXP-011.", decision="motivates H3 (source mixing)",
            justification="Confound is in the training data, not the split."),
    ]
    results_2b = json.loads((ART / "experiments" / "results.json").read_text()) if (ART / "experiments" / "results.json").is_file() else {}
    for variant in sorted(results_2b):
        rows.append(row(f"EXP-R2B-{variant}", f"Round-2b CV: {variant}", split="v3", code="a79037f", seed=42,
                        metrics=cv_metrics("experiments", variant, None if variant == "D0+E_yamnet" else ("D0+E_yamnet" if "D0+E_yamnet" in results_2b else None)),
                        artifact="backend/artifacts/experiments/results.json", hypothesis="H3 / H4",
                        interpretation="Dev set v3 includes 21 KAUH patients (source mixing).",
                        limitations="3 folds; one seed unless noted.", status="completed",
                        decision="pending pre-registered rule (ROUND2 report section 9)", justification=""))
    if (ART / "experiments" / "shortcut_probes.json").is_file():
        rows.append(row("EXP-R2B-probes", "Shortcut probes, split v3 dev (KAUH as a third source)", hypothesis="H2",
                        split="v3", code="a79037f", metrics=probe_metrics("experiments/shortcut_probes.json"),
                        artifact="backend/artifacts/experiments/shortcut_probes.json",
                        interpretation="Dataset of origin now has three sources (ICBHI, Kaggle, KAUH).",
                        limitations="Not comparable one-to-one with the two-source probes of split v2.",
                        decision="descriptive", justification=""))
    for variant in ("D3", "D3_devaug", "D3_mtl", "D3_ce", "D3_mixup", "D3_x3"):
        if variant not in results_2b:
            rows.append(row(f"EXP-R2B-{variant}", f"Round-2b CV: {variant}", split="v3", status="running",
                            code="a79037f", seed=42, hypothesis="H4 (secondary)",
                            artifact=f"backend/artifacts/experiments/oof_{variant}.csv",
                            decision="pending", justification="GPU queue"))
    rows += [
        ladder_row(),
        x2_row(),
        row("EXP-014", "Failed round-2b production run (OPERA-CE head-export check, TF32)", kind="engineering",
            status="failed", split="v3", artifact="backend/artifacts/failed-prod2b-tf32-2026-10-23/",
            interpretation="All three RespiNets and the YAMNet head trained; stopped at the OPERA-CE head check. "
                           "With C = 0.1 the GPU (TF32) head differed from scikit-learn by up to 2.2e-3 "
                           "(32 of 325 validation rows > 1e-3; no class changes); on the CPU the same head matched to 3.5e-6.",
            decision="root-cause fix (D-23): heads always run on the CPU (pretrained.predict_head), tolerance 1e-4; "
                     "run repeated from a clean tree",
            justification="Kept for the record; no metrics. Same failure class as EXP-006, which was relaxed instead of fixed."),
        row("EXP-015", "Superseded round-2b production artifact (served weights ≠ evaluated weights)", kind="engineering",
            status="superseded", split="v3", metrics=model_metrics("superseded-prod2b-ckpt-mismatch-2026-10-23"),
            artifact="backend/artifacts/superseded-prod2b-ckpt-mismatch-2026-10-23/ (+ external/served_round2b*.json)",
            interpretation="Test metrics, calibration and fusion temperatures were computed on EarlyStopping-restored "
                           "weights (members seed43/44: epochs 50/42); the saved files the server loaded were the later "
                           "ModelCheckpoint epochs 56/44. Its KAUH-holdout run (served file): 17/24 in-label patients, "
                           "healthy 17/18, COPD 0/5. Deployment checks passed (parity 5e-5) but compared served files "
                           "with themselves, so they could not detect this. Re-scoring all 389 test recordings "
                           "through the served files on the GPU (the evaluation device): 1 recording differs "
                           "(a healthy one; balanced accuracy 0.7427 vs reported 0.7507, accuracy 0.8226 vs "
                           "0.8252); patient-level metrics identical. On the CPU 2 recordings differ (one more "
                           "from TF32). So the mismatch was real but changed one test recording "
                           "(reported_metrics_reproduction*.json).",
            limitations="Not a valid estimate of any single model: metrics and served weights differ.",
            decision="superseded by the retrained artifact (D-24)",
            justification="Kept for the record; its test and holdout numbers are not reported as results."),
        c4_row(),
        row("EXP-016", "Served round-2b model: D3_x3 + YAMNet + OPERA-CE + HeAR (production run #3)", split="v3",
            metrics=model_metrics("latest"), artifact="backend/artifacts/latest/",
            interpretation=("Test split used for this configuration a second time (first: EXP-015, same configuration, "
                            "superseded artifact); the configuration was fixed before (D-21), so nothing was chosen. "
                            "Served files reproduce test_metrics.json exactly on the GPU; on the CPU 1 of 389 test "
                            "recordings flips (TF32 near-tie), patient metrics identical."),
            limitations=("In-cohort only. Split v3 differs from v2, so not comparable with EXP-012. 49 test patients "
                         "(CI about ±12 points). KAUH in the test split: 3 patients."),
            decision="served model (round 2b)", justification="D-21 adoption; D-23/D-24 fixes."),
        row("X3", "Source-mixing mitigation on the KAUH holdout (round-2b served model)", hypothesis="H3",
            split="v3", metrics=external_metrics("experiments/external/served_round2b_final.json"),
            artifact="backend/artifacts/experiments/external/served_round2b_final*.json",
            interpretation=("17/24 in-label holdout patients correct vs 0/24 for the model served before 2b "
                            "(EXP-017): healthy 17/18 (exact CI 72.7–99.9%), COPD 0/5 (CI 0–52.2%), bronchial 0/1; "
                            "balanced accuracy 31.5%. Out-of-label KAUH recordings moved from mostly 'asthma' to "
                            "mostly 'healthy' (52/81): the model follows the site's dominant training label."),
            limitations=("Within-site evaluation (KAUH patients in training), not cross-site. 24 in-label patients, "
                         "5 COPD. Holdout used twice for this configuration (once for EXP-015). 3 holdout healthy "
                         "recordings are byte-identical to asthma recordings of training/validation patients (C-21); "
                         "without them 18/24 (healthy 18/18, COPD 0/5) - backend/data/kauh_internal_duplicates.summary.json."),
            decision="H3 partly supported: criterion met on accuracy (+70.8 points), not on COPD or balanced accuracy",
            justification="Pre-registered in RESEARCH_PLAN H3 / ROUND2 report §9."),
        row("EXP-017", "Model served before round 2b, on the same KAUH holdout", hypothesis="H3", split="v2",
            metrics=external_metrics("experiments/external/previous_round2_on_holdout.json"),
            artifact="backend/artifacts/experiments/external/previous_round2_on_holdout*.json",
            interpretation="0/24 in-label holdout patients (exact CI 0–14.2%); nearly everything predicted asthma.",
            limitations="Served file is epoch 67 while its reported metrics used epoch 64 (D-24).",
            decision="comparison arm for X3", justification="Pre-registered in ROUND2 report §9."),
        x5_row(),
        json_row("X1-F", "Fidelity grid: the 2020 protocol (L0) under its undocumented batch size and GRU gate",
                 "experiments/leakage_ladder/fidelity_summary.json", hypothesis="H1",
                 primary=("best cell mean accuracy", lambda d: max(v["accuracy_mean"] for k, v in d.items() if k != "paper_reported")),
                 interpretation=("The published code cannot run (undefined variables, no split/evaluation code). Under every "
                                 "plausible reading (batch 32 or full, sigmoid or Keras-2 hard sigmoid; 20 seeds each) the "
                                 "mean is 0.79–0.88 and none of 80 runs reaches the lowest of the paper's ten reported runs "
                                 "(0.949); keeping the best 10 of 20 adds about 2 points."),
                 limitations="Re-implementation with minimal patches; librosa and Keras versions differ from 2020.",
                 decision="0.957 is not reproducible from the published materials", code="experiments/leakage_ladder.py fidelity"),
        json_row("MULT", "Multiplicity control for the round-2b adoption (Holm)", "experiments/multiplicity.json",
                 hypothesis="engineering",
                 primary=("Holm-adjusted p of the adopted fusion (balanced accuracy, 4 pre-registered candidates)",
                          lambda d: d["balanced_accuracy/preregistered"]["adopted_holm_p"]),
                 interpretation=("Raw one-sided bootstrap p 0.048 → 0.164 after Holm over the 4 pre-registered fusions "
                                 "(1.0 over all 35 reported); no candidate is significant after correction."),
                 limitations="Bootstrap P(Δ>0) read as a one-sided p-value; 1,000 draws.",
                 decision="adoption stands procedurally (rule fixed in advance); superiority over R′ is not claimed",
                 code="research/tools/multiplicity.py"),
        json_row("BIN", "Normal vs abnormal AUROC: in cohort vs external KAUH", "experiments/binary_external.json",
                 hypothesis="H2", primary=("external AUROC, round-2 model (72 KAUH patients, no KAUH training data)",
                                           lambda d: d["EXP-013 round-2 model, 72 external patients"]["auroc"]),
                 interpretation=("Models without KAUH training data: AUROC 0.47-0.48 on 72 external KAUH patients "
                                 "(chance); in cohort the served model reaches 0.94 [0.87, 0.99] "
                                 "(test_prediction_analyses.json). After round 2b the KAUH holdout gives 0.83 (within site)."),
                 limitations="Patient-level; out-of-label KAUH diagnoses counted as abnormal; 18-35 normal patients.",
                 decision="supports H2; comparable to Ong Ly et al. 2024 (0.97 -> 0.60)", code="research/tools/binary_external.py"),
        json_row("LOSO", "Leave-one-source-out, normal vs abnormal (dev patients)", "experiments/loso.json", hypothesis="H2",
                 primary=("held-out-source AUROC, HeAR on the KAUH site", lambda d: d["hear"]["held_out_source"]["kauh_site"]["auroc"]),
                 interpretation=("Held out of training, each source drops to AUROC 0.38-0.59 in 10 of 12 representation x source "
                                 "cells (within-cohort 0.51-0.97). Leave-one-device-out is impossible: every healthy ICBHI "
                                 "recording is Meditron and the AKG C417L recorded only COPD."),
                 limitations="Linear heads on frozen embeddings; development patients only; three sources.",
                 decision="supports H2", code="backend/experiments/loso.py"),
        json_row("NONBREATH", "Source probes on non-breath audio", "experiments/nonbreath_probes.json", hypothesis="H2",
                 primary=("dataset-of-origin probe from the quietest 10% of frames", lambda d: d["quietest"]["dataset_of_origin"]),
                 interpretation=("The source stays decodable from the quietest frames (dataset 0.79, device 0.81, within-diagnosis "
                                 "0.77-0.98) and the first/last 100 ms (0.76 / 0.83 / 0.72-0.96), close to the whole recording "
                                 "(0.86 / 0.83 / 0.88-1.00): an acquisition signature exists outside the breath sounds."),
                 limitations="Quietest frames are not guaranteed breath-free; linear probes; shows the signature exists, not that models use it.",
                 decision="'acquisition signature that models can exploit' may be stated", code="backend/experiments/nonbreath.py"),
        json_row("TESTPRED", "Served model test outputs: no-audio rule (paired), without Kaggle remainder",
                 "experiments/test_prediction_analyses.json", hypothesis="H2",
                 primary=("model − no-audio rule, patient balanced accuracy", lambda d: d["model_minus_no_audio_rule"]["difference"]),
                 interpretation=("Model vs source+stethoscope rule: +4.1 points [-6.9, +16.1], P(model better) 0.77. Without the 6 "
                                 "Kaggle-remainder test patients: patient balanced accuracy 68.0% (74.9% with them)."),
                 limitations="CPU export (1 of 389 recordings differs from the GPU evaluation; patient metrics identical).",
                 decision="in-cohort score not distinguishable from the no-audio rule", code="research/tools/test_prediction_analyses.py"),
        json_row("LC", "KAUH adaptation learning curve (embedding members, v2 holdout)", "experiments/learning_curve.json",
                 hypothesis="H3", primary=("healthy recall at k = 18", lambda d: d["curve"]["18"]["healthy_recall"]["mean"]),
                 interpretation=("Healthy recall 0 → 0.16 → 0.67 → 0.94 and normal-vs-abnormal AUROC 0.66 → 0.88 as k = 0, 4, 9, 18 "
                                 "KAUH patients are added; COPD recall stays 0 at every k (3 KAUH COPD patients available)."),
                 limitations=("Embedding members only (YAMNet + OPERA-CE + HeAR heads), not the full fusion; diagnostic reuse of the "
                              "holdout (chooses nothing); within-site only; 10 draws per k."),
                 decision="H3 partly supported: dose-response for healthy, none for COPD", code="backend/experiments/learning_curve.py"),
        json_row("SRC", "Source-only baselines (no audio)", "experiments/source_baseline.json", hypothesis="H2",
                 primary=("split v3: recording accuracy of the source+device rule",
                          lambda d: d["split_v3_round2b"]["source+device"]["recording_accuracy"]),
                 interpretation=("Predicting the majority training label of each source and stethoscope reaches 84.1% "
                                 "recording accuracy on split v3 (served model 82.0%) and 70.8% patient balanced accuracy "
                                 "(model 74.9%). On X1 L3 the device rule (0.440 balanced) beats the 2020 network (0.384); "
                                 "the network is better in 7 of 20 paired seeds."),
                 limitations="Rule fitted on train + validation; no confidence intervals for the merged-cohort comparison.",
                 decision="supports H2: in-cohort scores largely reflect the source", code="research/tools/source_baseline.py"),
    ]
    return rows


def json_row(eid, title, path, *, primary, code, hypothesis="", interpretation="", limitations="",
             decision="", justification="") -> dict[str, object]:
    """A ledger row whose primary value is read from one JSON artifact (backend/artifacts/<path>)."""
    file = ART / path
    metrics = {}
    if file.is_file():
        data = json.loads(file.read_text())
        metrics = {"primary_metric": primary[0], "primary_value": r4(primary[1](data)), "code_version": code}
    return row(eid, title, hypothesis=hypothesis, status="completed" if metrics else "proposed", metrics=metrics,
               artifact=f"backend/artifacts/{path}", interpretation=interpretation, limitations=limitations,
               decision=decision, justification=justification or "Tier-1 item of the readiness report.")


def x5_row() -> dict[str, object]:
    path = ART / "experiments" / "x5_abstention.json"
    metrics = {}
    if path.is_file():
        a = json.loads(path.read_text())
        x3 = a["X3 round-2b model, 24-patient holdout"]
        metrics = {
            "primary_metric": "abstention rate out-of-label − in-label (round-2b model, KAUH holdout)",
            "primary_value": r4(x3["difference"]),
            "secondary": {name: {"out_of_label": r4(v["out_of_label"]["abstention"]),
                                 "in_label": r4(v["in_label"]["abstention"]),
                                 "difference_ci95": [r4(c) for c in v["difference_ci95"]],
                                 "in_label_accuracy_all": r4(v["in_label_accuracy_all"]),
                                 "in_label_accuracy_accepted": r4(v["in_label_accuracy_accepted"])}
                          for name, v in a.items() if name != "method"} | {"method": a["method"]},
            "code_version": "research/tools/x5_abstention.py",
        }
    return row("X5", "Abstention under site shift (all KAUH evaluations)", hypothesis="H5 (uncertainty)",
               status="completed" if metrics else "proposed", metrics=metrics,
               artifact="backend/artifacts/experiments/x5_abstention.json",
               interpretation=("Models without KAUH exposure abstain about as often on out-of-label as on in-label KAUH "
                               "audio (CIs include 0) and pass most of their wrong external calls; after round 2b the "
                               "difference is +18.4 points [2.8, 33.6]."),
               limitations=("Out-of-label = KAUH diagnoses outside the five classes, not other audio domains. Recording "
                            "level with patient-cluster bootstrap; 24–45 in-label patients."),
               decision="H5 unsupported without site exposure; weakly supported after it",
               justification="Descriptive analysis planned in RESEARCH_PLAN (H5).")


def c4_row() -> dict[str, object]:
    path = ART / "experiments" / "contamination" / "analysis.json"
    metrics = {}
    if path.is_file():
        a = json.loads(path.read_text())
        within, between = a["within_model_kaggle_all"], a["between_models_copied_recordings"]
        metrics = {
            "primary_metric": "within-model accuracy difference, copied − clean ICBHI COPD recordings (Kaggle-trained model)",
            "primary_value": r4(within["copd"]["difference"]),
            "secondary": {
                "within_model": {k: {"copied": r4(v["copied"]["accuracy"]), "clean": r4(v["clean"]["accuracy"]),
                                     "patients": [v["copied"]["patients"], v["clean"]["patients"]],
                                     "difference_ci95": [r4(v["difference_ci95"]["low"]), r4(v["difference_ci95"]["high"])]}
                                 for k, v in within.items()},
                "between_models": {k: {"with_copies": r4(v["accuracy_with_copies"]),
                                       "without_copies": r4(v["accuracy_without_copies"]), "patients": v["patients"],
                                       "difference_ci95": [r4(v["difference_ci95"]["low"]), r4(v["difference_ci95"]["high"])]}
                                   for k, v in between.items()},
                "method": a["method"],
                **({"seed43_within_model": {k: {"difference": r4(v["difference"]),
                                                "difference_ci95": [r4(v["difference_ci95"]["low"]), r4(v["difference_ci95"]["high"])]}
                                            for k, v in a["seed43"]["within_model_kaggle_all"].items()},
                    "seed43_between_models": {k: {"with_copies": r4(v["accuracy_with_copies"]),
                                                  "without_copies": r4(v["accuracy_without_copies"])}
                                              for k, v in a["seed43"]["between_models_copied_recordings"].items()}}
                   if "seed43" in a else {}),
            },
            "code_version": "experiments/contamination.py + research/tools/c4_analysis.py",
            "seed": 42,
        }
    return row("C4", "Contamination re-evaluation: Kaggle-V2-trained models scored on all ICBHI recordings",
               hypothesis="H6", status="completed" if metrics else "running", metrics=metrics,
               artifact="backend/artifacts/experiments/contamination/ (model_kaggle_all/, model_kaggle_clean/, *.json)",
               interpretation=("A model trained on Kaggle V2 scores ICBHI recordings that were copied into Kaggle far "
                               "higher than clean ICBHI recordings of the same class; a model trained without the "
                               "copies loses most of that advantage. A 'train on Kaggle V2, test on ICBHI' evaluation "
                               "largely re-tests training audio."),
               limitations=("Recording-level accuracy with patient-cluster bootstrap. Copied and clean recordings come "
                            "from different patients and may differ systematically (selection by the uploader). The "
                            "between-model comparison also changes the class set (5 → 4; no COPD without the copies) "
                            "and the training size (715 → 338 recordings). Two training seeds (42, 43). Pneumonia: 6 patients."),
               decision="supports H6", justification="Mandatory control C4 (novelty review §7; D-22).")


def x2_row() -> dict[str, object]:
    path = ART / "experiments" / "site_vs_band" / "served_round2.json"
    metrics = {}
    if path.is_file():
        summary = json.loads(path.read_text())["summary"]
        metrics = {
            "primary_metric": "share of ICBHI COPD recordings predicted asthma at 4 kHz",
            "primary_value": r4(summary["as_4khz/copd"]["predicted_asthma"]),
            "secondary": {key: {"recordings": v["recordings"], "accuracy": r4(v["accuracy"]),
                                "predicted_asthma": r4(v["predicted_asthma"]), "predictions": v["predictions"]}
                          for key, v in summary.items()},
            "code_version": "experiments/site_vs_band.py",
        }
    return row("X2", "Site vs sample-rate/bandwidth diagnostic (round-2 served model)", split="v2",
               hypothesis="H2 (competing explanation)", status="completed" if metrics else "approved",
               metrics=metrics, artifact="backend/artifacts/experiments/site_vs_band/served_round2*.json",
               interpretation=("Re-encoding ICBHI audio in KAUH's 4 kHz format lowers accuracy somewhat but rarely yields "
                               "'asthma', unlike the external KAUH patients; bandwidth does not explain the failure."),
               limitations=("Test + validation recordings of split v2 (validation was used for early stopping only; "
                            "comparison is paired). Only 12 healthy ICBHI recordings. One 4 kHz recording was "
                            "refused by the lung-sound gate (counted as gate_rejected)."),
               decision="supports H2 over the bandwidth explanation", justification="Pre-registered in RESEARCH_PLAN H2.")


def ladder_row() -> dict[str, object]:
    """X1: filled from backend/artifacts/experiments/leakage_ladder/summary.json once it exists."""
    summary_path = ART / "experiments" / "leakage_ladder" / "summary.json"
    metrics = {}
    status = "running"
    if summary_path.is_file():
        summary = json.loads(summary_path.read_text())
        complete = all(summary.get(r, {}).get("repeats") == 20 for r in ("L0", "L1", "L2", "L3"))
        status = "completed" if complete else "running"
        if "L3" in summary:
            baselines_path = ART / "experiments" / "leakage_ladder" / "baselines.json"
            baselines = json.loads(baselines_path.read_text()) if baselines_path.is_file() else {}
            metrics = {
                # Balanced accuracy is the protocol's primary metric. Accuracy is not comparable across
                # rungs: augmented copies change the test-set class mix (COPD 22.5% in L0/L1, 59% in L2/L3).
                "primary_metric": "balanced accuracy drop L0 → L3 (means over 20 seeds)",
                "primary_value": r4(summary["L0"]["balanced_accuracy"]["mean"] - summary["L3"]["balanced_accuracy"]["mean"]),
                "secondary": {**{k: v for k, v in summary.items()}, "constant_baselines": baselines},
            }
    return row("X1", "Leakage ladder: original 2021 protocol → leak-free", hypothesis="H1", status=status,
               code="experiments/leakage_ladder.py", seed="0-19 per rung", metrics=metrics,
               artifact="backend/artifacts/experiments/leakage_ladder/{features_summary,summary}.json, results.csv",
               interpretation=("Each removed leak lowers balanced accuracy; at the patient-disjoint rung accuracy equals "
                               "the always-COPD baseline while balanced accuracy stays above chance. The original "
                               "protocol did not reach the paper's reported figure in this re-implementation.")
                               if status == "completed" else "",
               limitations=("Re-implementation of git 3ec7dc6 with authentic labels; batch size 32 assumed (not stated); "
                            "released-code class sizes match the paper for Healthy/COPD/Pneumonia but are half for "
                            "Bronchiectasis/Bronchiolitis (paper Fig. 1); model matches every layer of the paper's "
                            "Fig. 3 (328,726 parameters; the figure's printed total 320,726 does not match its rows); "
                            "COPD cap applied in sorted file order (original used os.listdir order)."),
               decision="supports H1 (drop criterion met); reproduction criterion for L0 not met" if status == "completed" else "pending",
               justification="Pre-registered: drop L0→L3 ≥ 0.15 supports H1; |L0 − 0.9567| ≤ 0.03 for reproduction.")


def render(rows: list[dict[str, object]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text = render(registry())
    if args.check:
        current = LEDGER.read_text(encoding="utf-8") if LEDGER.is_file() else ""
        sys.exit(0 if current == text else "EXPERIMENT_LEDGER.csv is out of date; rerun collect_evidence.py")
    LEDGER.write_text(text, encoding="utf-8")
    print(f"wrote {LEDGER.relative_to(ROOT)} ({text.count(chr(10)) - 1} rows)")


if __name__ == "__main__":
    main()
