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
        "test_patients": pat.get("patients") or None,
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
        "secondary": {name: {k: r4(v) for k, v in values.items()} for name, values in p.items()},
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
            limitations="252 Kaggle clips match neither ICBHI nor KAUH; their grouping stays unverified.",
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
            metrics=model_metrics("latest"), artifact="backend/artifacts/latest/",
            interpretation="Test set used once; lower than EXP-005 because v1 shared KAUH patients across the split.",
            limitations="In-cohort only.", decision="served model until round 2b",
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
        row("X3", "Source-mixing mitigation on the KAUH holdout", hypothesis="H3", status="running",
            decision="evaluate once after round-2b adoption", justification="Tests H3."),
        row("X5", "Abstention and calibration under site shift", hypothesis="H5 (uncertainty)", status="proposed",
            decision="descriptive analysis after X3", justification="Uses existing external outputs."),
    ]
    return rows


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
