"""Write research/RELEASE_MANIFEST.csv: every file of the planned data/code release with its SHA-256.

The release contains derived metadata and code only, **no audio**: users obtain ICBHI 2017, KAUH
(Mendeley, CC BY 4.0) and the Kaggle corpus from their original sources and re-derive everything
with the listed tools. ``--check`` fails if any listed file changed since the manifest was written.

    python research/tools/release_manifest.py [--check]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GROUPS = {
    "evidence": ["backend/data/*.csv", "backend/data/*.json"],
    "splits": ["research/splits/*/*"],
    "governance": ["research/*.md", "research/*.csv"],
    "tools": ["research/tools/*.py", "backend/cross_dataset_overlap.py", "backend/kauh.py",
              "backend/experiments/*.py"],
}
OUT = ROOT / "research/RELEASE_MANIFEST.csv"


def rows() -> list[dict[str, str]]:
    out = []
    for group, patterns in GROUPS.items():
        for pattern in patterns:
            for path in sorted(ROOT.glob(pattern)):
                if path.is_file() and path != OUT:
                    out.append({"group": group, "path": path.relative_to(ROOT).as_posix(),
                                "bytes": str(path.stat().st_size),
                                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    current = rows()
    if args.check:
        with OUT.open(newline="", encoding="utf-8") as handle:
            recorded = {r["path"]: r["sha256"] for r in csv.DictReader(handle)}
        changed = [r["path"] for r in current if recorded.get(r["path"]) != r["sha256"]]
        if changed:
            sys.exit(f"release manifest is stale for {len(changed)} files, e.g. {changed[:3]}")
        print("release manifest up to date")
        return
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["group", "path", "bytes", "sha256"])
        writer.writeheader()
        writer.writerows(current)
    print(f"wrote {OUT.relative_to(ROOT)} ({len(current)} files)")


if __name__ == "__main__":
    main()
