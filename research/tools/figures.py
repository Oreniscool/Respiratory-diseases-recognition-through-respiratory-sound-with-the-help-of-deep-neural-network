"""Paper figures from the artifact files → research/figures/*.png and *.svg.

Every value is read from an artifact (no hand-typed numbers). Palette: the validated reference
categorical slots 1–4 (blue, orange, aqua, yellow) on the light surface. Two of them sit below 3:1
contrast, so every mark carries a direct value label (the relief rule). Sequential magnitude uses
the single blue ramp.

    python research/tools/figures.py
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "backend/artifacts/experiments"
OUT = ROOT / "research/figures"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
INK, INK2, GRID, SURFACE = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
BLUES = LinearSegmentedColormap.from_list("blue", ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"])

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "text.color": INK, "font.size": 9, "axes.titlesize": 10, "axes.titleweight": "bold",
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": GRID,
    "grid.linewidth": 0.6, "axes.axisbelow": True, "legend.frameon": False,
})


def save(fig, name: str, rect=(0, 0, 1, 1)) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(rect=rect)
    for ext in ("png", "svg"):
        fig.savefig(OUT / f"{name}.{ext}", dpi=200)
    plt.close(fig)
    print("wrote", name)


def bar_labels(ax, bars, fmt="{:.0%}") -> None:
    for bar in bars:
        ax.annotate(fmt.format(bar.get_height()), (bar.get_x() + bar.get_width() / 2, bar.get_height()),
                    xytext=(0, 2), textcoords="offset points", ha="center", va="bottom", fontsize=7, color=INK2)


def fig_provenance() -> None:
    """Kaggle V2 clips by class and origin (ICBHI cut / KAUH cut / unknown)."""
    def matches(name):
        with (ROOT / "backend/data" / name).open(newline="", encoding="utf-8") as handle:
            return {r["clip"]: r["is_overlap"] == "True" for r in csv.DictReader(handle)}
    icbhi, kauh = matches("kaggle_icbhi_overlap.csv"), matches("kaggle_kauh_overlap.csv")
    counts: dict[str, Counter] = {}
    for clip in icbhi:
        cls = Path(clip).parent.name.lower() or clip.split("/")[0].lower()
        origin = "cut from ICBHI" if icbhi[clip] else "cut from KAUH" if kauh.get(clip) else "unknown origin"
        counts.setdefault(cls, Counter())[origin] += 1
    classes = sorted(counts)
    fig, ax = plt.subplots(figsize=(6.4, 2.8))
    left = np.zeros(len(classes))
    for i, origin in enumerate(("cut from ICBHI", "cut from KAUH", "unknown origin")):
        values = np.asarray([counts[c][origin] for c in classes])
        bars = ax.barh(classes, values, left=left, color=SERIES[i], label=origin, edgecolor=SURFACE, linewidth=1.5, height=0.62)
        for bar, v in zip(bars, values):
            if v >= 10:
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_y() + bar.get_height() / 2, str(v),
                        ha="center", va="center", fontsize=7, color="white")
        left += values
    ax.set_xlabel("Kaggle 'Asthma Detection Dataset V2' clips")
    ax.set_title(f"Provenance of the Kaggle corpus ({int(left.sum())} clips)")
    ax.legend(ncol=3, loc="lower center", bbox_to_anchor=(0.5, 1.08), fontsize=8)
    ax.grid(axis="y", visible=False)
    save(fig, "fig1_kaggle_provenance")


def fig_c4() -> None:
    a = json.loads((ART / "contamination/analysis.json").read_text())
    fig, axes = plt.subplots(1, 2, figsize=(8.0, 3.6))
    within = a["within_model_kaggle_all"]
    labels = list(within)
    x = np.arange(len(labels))
    for i, (key, name) in enumerate((("copied", "copied into Kaggle"), ("clean", "patient never copied"))):
        bars = axes[0].bar(x + (i - 0.5) * 0.38, [within[c][key]["accuracy"] for c in labels], 0.36,
                           color=SERIES[i], label=name, edgecolor=SURFACE, linewidth=1.5)
        bar_labels(axes[0], bars)
    for j, c in enumerate(labels):
        lo, hi = within[c]["difference_ci95"].values()
        axes[0].text(j, 1.02, f"Δ {within[c]['difference']:+.0%}\n[{lo:+.0%}, {hi:+.0%}]", ha="center", fontsize=7, color=INK2)
    axes[0].set_xticks(x, [f"{c}\n({within[c]['copied']['patients']} vs {within[c]['clean']['patients']} pts)" for c in labels])
    axes[0].set_title("Same model: copied vs clean ICBHI recordings")
    between = a["between_models_copied_recordings"]
    labels = list(between)
    x = np.arange(len(labels))
    for i, (key, name) in enumerate((("accuracy_with_copies", "trained with copies"), ("accuracy_without_copies", "trained without copies"))):
        bars = axes[1].bar(x + (i - 0.5) * 0.38, [between[c][key] for c in labels], 0.36,
                           color=SERIES[2 + i], label=name, edgecolor=SURFACE, linewidth=1.5)
        bar_labels(axes[1], bars)
    axes[1].set_xticks(x, [f"{c}\n({between[c]['patients']} pts)" for c in labels])
    axes[1].set_title("Copied ICBHI recordings: two models")
    for ax in axes:
        ax.set_ylim(0, 1.18)
        ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0], ["0%", "25%", "50%", "75%", "100%"])
        ax.set_ylabel("recording accuracy")
        ax.legend(loc="upper center", fontsize=7, bbox_to_anchor=(0.5, -0.24), ncol=2)
        ax.grid(axis="x", visible=False)
    save(fig, "fig2_contamination_c4")


def fig_ladder() -> None:
    summary = json.loads((ART / "leakage_ladder/summary.json").read_text())
    baseline = json.loads((ART / "source_baseline.json").read_text())["x1_L3"]["device_rule"]["balanced_accuracy_mean"]
    units = ["sample", "recording", "patient"]
    fig, ax = plt.subplots(figsize=(5.6, 3.3))
    for i, (rungs, name) in enumerate(((("L0", "L2T", "L3T"), "checkpoint chosen on test"),
                                       (("L1", "L2", "L3"), "checkpoint chosen on validation"))):
        means = [summary[r]["balanced_accuracy"]["mean"] for r in rungs]
        sds = [summary[r]["balanced_accuracy"]["sd"] for r in rungs]
        xs = np.arange(3) + (i - 0.5) * 0.12
        ax.errorbar(xs, means, yerr=sds, color=SERIES[i], marker="o", markersize=6, linewidth=2, capsize=3, label=name)
        for xx, m, sd in zip(xs, means, sds):
            ax.annotate(f"{m:.2f}", (xx, m + (sd if i == 0 else -sd)), xytext=(0, 4 if i == 0 else -4),
                        textcoords="offset points", ha="center", va="bottom" if i == 0 else "top", fontsize=7, color=INK2)
    ax.axhline(1 / 6, color=INK2, linestyle="--", linewidth=1)
    ax.text(1.0, 1 / 6 + 0.012, "chance (6 classes)", fontsize=7, color=INK2, ha="center")
    ax.scatter([2], [baseline], marker="D", s=46, color=SERIES[2], zorder=5, label=f"no-audio device rule, patient-level split ({baseline:.2f})")
    ax.set_xticks(range(3), [f"{u}-level split" for u in units])
    ax.set_ylim(0, 1)
    ax.set_ylabel("balanced accuracy (20 seeds, mean ± sd)")
    ax.set_title("The 2020 protocol with its leaks removed")
    ax.legend(loc="upper right", fontsize=7)
    ax.grid(axis="x", visible=False)
    save(fig, "fig3_leak_ladder")


def fig_probes() -> None:
    shortcut = json.loads((ART / "shortcut_probes.json").read_text())
    nonbreath = json.loads((ART / "nonbreath_probes.json").read_text())
    rows = [("MFCC, whole recording", nonbreath["full"]), ("MFCC, quietest 10% of frames", nonbreath["quietest"]),
            ("MFCC, first/last 100 ms", nonbreath["edges"])]
    for name, label in (("yamnet", "YAMNet"), ("opera_ce", "OPERA-CE"), ("hear", "HeAR"), ("ast", "AST (frozen)")):
        if name in shortcut:
            rows.append((label, shortcut[name]))
    columns = [("dataset_of_origin", "dataset"), ("icbhi_device", "ICBHI device"), ("disease", "disease"),
               ("source_within_healthy", "source | healthy"), ("source_within_copd", "source | COPD"),
               ("source_within_pneumonia", "source | pneumonia")]
    def value(r, key):
        return r[key] if key in r else r["within_label"][key]["balanced_accuracy"]
    data = np.asarray([[value(r, k) for k, _ in columns] for _, r in rows])
    fig, ax = plt.subplots(figsize=(7.2, 0.42 * len(rows) + 1.3))
    image = ax.imshow(data, cmap=BLUES, vmin=0.3, vmax=1.0, aspect="auto")
    for (i, j), v in np.ndenumerate(data):
        ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=7, color="white" if v > 0.7 else INK)
    ax.set_xticks(range(len(columns)), [c for _, c in columns], rotation=20, ha="right")
    ax.set_yticks(range(len(rows)), [r for r, _ in rows])
    ax.grid(False)
    ax.set_title("Linear probes: balanced accuracy (patient-grouped 3-fold CV)\n"
                 "chance: dataset 0.33, ICBHI device 0.25, disease 0.20, source | diagnosis 0.33-0.50", fontsize=8)
    fig.colorbar(image, ax=ax, fraction=0.03, pad=0.02)
    save(fig, "fig4_source_probes")


def fig_loso() -> None:
    loso = json.loads((ART / "loso.json").read_text())
    reps = [k for k in ("mfcc_statistics", "yamnet", "opera_ce", "hear", "ast") if k in loso]
    names = {"mfcc_statistics": "MFCC stats", "yamnet": "YAMNet", "opera_ce": "OPERA-CE", "hear": "HeAR", "ast": "AST"}
    sources = ["icbhi", "kaggle_remainder", "kauh_site"]
    fig, axes = plt.subplots(1, 3, figsize=(8.4, 3.0), sharey=True)
    for ax, source in zip(axes, sources):
        for i, (key, label) in enumerate((("within_cohort_by_source", "within cohort (3-fold CV)"),
                                          ("held_out_source", "source held out of training"))):
            values = [loso[r][key][source] for r in reps]
            ys = np.arange(len(reps)) + (i - 0.5) * 0.22
            xs = [v["auroc"] for v in values]
            err = np.asarray([[v["auroc"] - v["ci95"][0], v["ci95"][1] - v["auroc"]] for v in values]).T
            ax.errorbar(xs, ys, xerr=err, fmt="o", color=SERIES[i], markersize=6, capsize=2, linewidth=1.2, label=label)
        ax.axvline(0.5, color=INK2, linestyle="--", linewidth=1)
        ax.set_title(source.replace("_", " "))
        ax.set_xlim(0.0, 1.0)
        ax.set_yticks(range(len(reps)), [names[r] for r in reps])
        ax.set_xlabel("normal vs abnormal AUROC")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", ncol=2, fontsize=8)
    save(fig, "fig5_leave_one_source_out", rect=(0, 0, 1, 0.9))


def fig_no_audio() -> None:
    b = json.loads((ART / "source_baseline.json").read_text())
    groups = [("split v3\n(round-2b model)", b["split_v3_round2b"]), ("split v2\n(round-2 model)", b["split_v2_round2"])]
    fig, ax = plt.subplots(figsize=(5.6, 3.0))
    x = np.arange(len(groups))
    for i, (key, label) in enumerate((("source+device", "no-audio rule: source + stethoscope"), ("model", "trained model"))):
        bars = ax.bar(x + (i - 0.5) * 0.36, [g[key]["patient_balanced_accuracy"] for _, g in groups], 0.34,
                      color=SERIES[i], label=label, edgecolor=SURFACE, linewidth=1.5)
        bar_labels(ax, bars)
    ax.axhline(0.2, color=INK2, linestyle="--", linewidth=1)
    ax.text(1.45, 0.215, "chance (5 classes)", fontsize=7, color=INK2, ha="right")
    ax.set_xticks(x, [name for name, _ in groups])
    ax.set_ylim(0, 1)
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0], ["0%", "25%", "50%", "75%", "100%"])
    ax.set_ylabel("patient balanced accuracy")
    ax.set_title("A rule that never hears the audio")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.22), ncol=1, fontsize=7)
    ax.grid(axis="x", visible=False)
    save(fig, "fig6_no_audio_rule")


def fig_learning_curve() -> None:
    d = json.loads((ART / "learning_curve.json").read_text())["curve"]
    ks = sorted(d, key=int)
    fig, ax = plt.subplots(figsize=(5.6, 3.2))
    for i, (key, label) in enumerate((("healthy_recall", "healthy recall"), ("copd_recall", "COPD recall"),
                                      ("normal_vs_abnormal_auroc", "normal vs abnormal AUROC"))):
        means = [d[k][key]["mean"] for k in ks]
        sds = [d[k][key]["sd"] for k in ks]
        ax.errorbar([int(k) for k in ks], means, yerr=sds, color=SERIES[i], marker="o", markersize=6, linewidth=2,
                    capsize=3, label=label)
        ax.annotate(f"{means[-1]:.2f}", (int(ks[-1]), means[-1]), xytext=(6, 0), textcoords="offset points",
                    va="center", fontsize=7, color=INK2)
    ax.axhline(0.5, color=INK2, linestyle="--", linewidth=1)
    ax.text(0.2, 0.515, "AUROC chance", fontsize=7, color=INK2, ha="left")
    ax.set_xticks([int(k) for k in ks])
    ax.set_xlabel("KAUH patients added to training (k); no error bars at k = 0 or 18 (one draw)")
    ax.set_ylim(-0.03, 1.03)
    ax.set_title("Within-site adaptation on the KAUH holdout (embedding members)")
    ax.legend(loc="center right", fontsize=7)
    save(fig, "fig7_kauh_learning_curve")


def fig_sprsound() -> None:
    """Second external site: both served models and four frozen-representation heads, all near chance."""
    analysis = json.loads((ART / "sprsound_analysis.json").read_text())
    heads = json.loads((ART / "sprsound_heads.json").read_text())["representations"]
    entries = [("Round-2b served model", analysis["round2b"]["P2_healthy_vs_diseased_auroc"], SERIES[0]),
               ("Previous served model", analysis["round2split2"]["P2_healthy_vs_diseased_auroc"], SERIES[0])]
    names = {"yamnet": "YAMNet head", "opera_ce": "OPERA-CE head", "hear": "HeAR head", "ast": "AST head (frozen)"}
    entries += [(names[k], {"value": v["sprsound_auroc"], "ci95": v["ci95"]}, SERIES[2]) for k, v in heads.items()]
    fig, axes = plt.subplots(1, 2, figsize=(8.6, 3.3), gridspec_kw={"width_ratios": [1.5, 1]})
    ax = axes[0]
    for i, (label, e, color) in enumerate(entries):
        y = len(entries) - 1 - i
        ax.errorbar([e["value"]], [y], xerr=[[e["value"] - e["ci95"][0]], [e["ci95"][1] - e["value"]]], fmt="o", color=color,
                    markersize=7, capsize=3, linewidth=1.5)
        ax.annotate(f"{e['value']:.2f}", (e["ci95"][1], y), xytext=(5, 0), textcoords="offset points", va="center", fontsize=7, color=INK2)
    ax.axvline(0.5, color=INK2, linestyle="--", linewidth=1)
    ax.axvline(0.7, color=SERIES[1], linestyle=":", linewidth=1.5)
    ax.set_ylim(-0.95, len(entries) - 0.5)
    ax.text(0.5, -0.8, "chance", fontsize=7, color=INK2, ha="center")
    ax.text(0.7, -0.8, "H7 / H9 bar", fontsize=7, color=INK2, ha="center")
    ax.set_yticks(range(len(entries)), [e[0] for e in reversed(entries)])
    ax.set_xlim(0.3, 1.0)
    ax.set_xlabel("healthy vs diseased AUROC, 718 patients (95% CI)")
    ax.set_title("Second external site (SPRSound, children)")
    ax.grid(axis="y", visible=False)
    ax = axes[1]
    for i, key in enumerate(("round2b", "round2split2")):
        p1 = analysis[key]["P1_patient_balanced_accuracy"]
        ax.bar([i], [p1["value"]], 0.55, color=SERIES[0], edgecolor=SURFACE, linewidth=1.5)
        ax.errorbar([i], [p1["value"]], yerr=[[p1["value"] - p1["ci95"][0]], [p1["ci95"][1] - p1["value"]]], color=INK2, capsize=3, linewidth=1.2)
        ax.annotate(f"{p1['value']:.2f}", (i, p1["value"] / 2), ha="center", va="center", fontsize=8, color="white")
    ax.axhline(0.25, color=INK2, linestyle="--", linewidth=1)
    ax.text(-0.45, 0.265, "chance (4 classes)", fontsize=7, color=INK2, ha="left")
    ax.set_xticks([0, 1], ["Round-2b", "Previous"])
    ax.set_ylim(0, 1)
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0], ["0%", "25%", "50%", "75%", "100%"])
    ax.set_ylabel("patient balanced accuracy")
    ax.set_title("Four-class balanced accuracy")
    ax.grid(axis="x", visible=False)
    save(fig, "fig8_sprsound_second_site")


def fig_dg() -> None:
    """Domain-generalization comparison: held-out SPRSound AUROC by method and representation, next to the development sites."""
    cells = json.loads((ART / "dg_loso.json").read_text())["representations"]
    methods = ["erm", "site_standardized", "group_balanced", "inlp", "group_dro"]
    labels = ["ERM (plain)", "per-site standardization", "site×class balancing", "INLP site removal", "group DRO"]
    reps = list(cells)
    names = {"yamnet": "YAMNet", "opera_ce": "OPERA-CE", "hear": "HeAR", "ast": "AST"}
    fig, axes = plt.subplots(1, 2, figsize=(8.6, 3.2), sharey=True)
    for ax, (title, getter) in zip(axes, (("Held-out SPRSound (children)", lambda r, m: cells[r][m]["sprsound"]["auroc"]),
                                          ("Mean of 3 held-out development sites", lambda r, m: cells[r][m]["mean_dev_auroc"]))):
        data = np.asarray([[getter(r, m) for r in reps] for m in methods])
        ax.imshow(data, cmap=BLUES, vmin=0.3, vmax=0.8, aspect="auto")
        for (i, j), v in np.ndenumerate(data):
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8, color="white" if v > 0.62 else INK)
        ax.set_xticks(range(len(reps)), [names[r] for r in reps])
        ax.set_title(title, fontsize=9)
        ax.grid(False)
    axes[0].set_yticks(range(len(methods)), labels)
    fig.suptitle("Healthy vs diseased AUROC when a whole site is held out (chance 0.50; pre-registered bar 0.70 on SPRSound)", fontsize=9, fontweight="bold")
    save(fig, "fig9_domain_generalization", rect=(0, 0, 1, 0.93))


def main() -> None:
    for make in (fig_provenance, fig_c4, fig_ladder, fig_probes, fig_loso, fig_no_audio, fig_learning_curve, fig_sprsound, fig_dg):
        make()


if __name__ == "__main__":
    main()
