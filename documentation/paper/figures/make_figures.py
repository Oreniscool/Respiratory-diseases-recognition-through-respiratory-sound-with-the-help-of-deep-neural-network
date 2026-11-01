"""Regenerate the two figures that can be rebuilt from files in this repository.

  fig_pipeline.png   audit pipeline block diagram (no data)
  fig_ncc_hist.png   distribution of best NCC per Kaggle clip, from backend/data/kaggle_icbhi_overlap.csv

fig1_overlap_by_class.png and fig2_copied_vs_clean.png are copies of research/figures/fig1_* and fig2_*,
which research/tools/figures.py builds from artifacts that are not in every checkout.

Run:  python make_figures.py
"""
from __future__ import annotations

import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = Path(__file__).resolve().parent
CSV = HERE.parents[2] / "backend" / "data" / "kaggle_icbhi_overlap.csv"
INK, BLUE, ORANGE, GREY = "#222222", "#2a79d6", "#ec6a36", "#9a9a9a"
plt.rcParams.update({"font.family": "DejaVu Serif", "font.size": 8})


def pipeline() -> None:
    fig, ax = plt.subplots(figsize=(7.2, 1.8))
    ax.set_xlim(-1.5, 101.5)
    ax.set_ylim(0, 24)
    ax.axis("off")
    labels = [
        "Kaggle V2\n1,211 clips",
        "4 kHz,\nband-pass\n100-1000 Hz",
        "NCC against\n920 ICBHI\nrecordings",
        "Copy if best\nNCC >= 0.75",
        "Label ICBHI:\ncopied, same\npatient, clean",
        "Score with\nKaggle-only\nmodels",
    ]
    w, gap, h, y = 14.0, 3.2, 12.5, 8.5
    for i, text in enumerate(labels):
        x = i * (w + gap)
        last = i == len(labels) - 1
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1.0",
                                    fc="#fdf1ec" if last else "#f3f6fb", ec=ORANGE if last else BLUE, lw=1.0))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=6.4)
        if i:
            ax.annotate("", xy=(x - 0.2, y + h / 2), xytext=(x - gap + 0.2, y + h / 2),
                        arrowprops=dict(arrowstyle="-|>", color=INK, lw=0.9))
    ax.text(50, 3.2, "Validation: synthetic cuts, KAUH negative control, blind listening, second (fingerprint) algorithm",
            ha="center", va="center", fontsize=6.4, color=GREY, style="italic")
    fig.savefig(HERE / "fig_pipeline.png", dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def ncc_hist() -> None:
    with CSV.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    copy = [float(r["best_ncc"]) for r in rows if r["is_overlap"] == "True"]
    other = [float(r["best_ncc"]) for r in rows if r["is_overlap"] != "True"]
    assert len(copy) == 631 and len(rows) == 1211, (len(copy), len(rows))
    lo_copy, hi_other = min(copy), max(other)
    fig, ax = plt.subplots(figsize=(3.45, 2.3))
    bins = [i / 40 for i in range(0, 41)]
    ax.hist(other, bins=bins, color=GREY, label=f"not a copy (n={len(other)})")
    ax.hist(copy, bins=bins, color=BLUE, label=f"copy (n={len(copy)})")
    ax.axvline(0.75, color=ORANGE, lw=1.2, ls="--")
    ax.text(0.745, ax.get_ylim()[1] * 0.93, "threshold\n0.75", ha="right", va="top", color=ORANGE, fontsize=7)
    ax.set_yscale("log")
    ax.set_xlabel("best normalized cross-correlation of a clip")
    ax.set_ylabel("clips (log scale)")
    ax.set_xlim(0, 1.0)
    ax.legend(frameon=False, fontsize=7, loc="upper left")
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.text(0.5, -0.36, f"highest non-copy {hi_other:.3f}; lowest copy {lo_copy:.3f}", transform=ax.transAxes,
            ha="center", fontsize=7, color=INK)
    fig.savefig(HERE / "fig_ncc_hist.png", dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"copies={len(copy)} others={len(other)} min_copy={lo_copy:.4f} max_other={hi_other:.4f}")


if __name__ == "__main__":
    pipeline()
    ncc_hist()
