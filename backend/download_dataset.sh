#!/bin/bash
#SBATCH --job-name=respinet_download_dataset
#SBATCH --partition=general
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=01:00:00
#SBATCH --output=%x_%j.out
#SBATCH --error=%x_%j.err

# ---------------------------------------------------------------------------
# RespiNet Dataset Download Job — SPIT GPU Cluster / Local Execution
# Downloads and extracts respiratory sound datasets into backend/dataset/
# Usage:
#   sbatch download_dataset.sh [asthma|icbhi|all]
#   ./download_dataset.sh [asthma|icbhi|all]
# ---------------------------------------------------------------------------

CHOICE="${1:-all}"
JOB_ID="${SLURM_JOB_ID:-local}"
LOGFILE="respinet_download_${JOB_ID}.log"

exec > >(tee -a "$LOGFILE") 2>&1

echo "===================================="
echo "JOB START: Dataset Download ($CHOICE)"
date
echo "Job ID:    $JOB_ID"
echo "Node:      ${SLURMD_NODENAME:-$(hostname)}"
echo "===================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

DATASET_ROOT="dataset"
if ! mkdir -p "$DATASET_ROOT" 2>/dev/null; then
    DATASET_ROOT="$HOME/dataset"
    echo "[INFO] Current directory not writable. Using fallback: '$DATASET_ROOT'."
fi
mkdir -p "$DATASET_ROOT"

download_archive() {
    local url="$1"
    local target_zip="$2"
    local extract_dir="$3"
    local name="$4"

    echo "------------------------------------"
    echo "[1/3] Downloading $name..."
    echo "URL: $url"
    mkdir -p "$extract_dir"

    if command -v kaggle >/dev/null 2>&1 && [[ "$url" == kaggle:* ]]; then
        local slug="${url#kaggle:}"
        echo "Using Kaggle CLI to download $slug..."
        kaggle datasets download -d "$slug" -p "$DATASET_ROOT" --unzip 2>/dev/null || true
    fi

    if [ "$(find "$extract_dir" -type f \( -name "*.wav" -o -name "*.mp3" -o -name "*.flac" \) | wc -l)" -eq 0 ]; then
        curl -L -o "$target_zip" "$url" 2>/dev/null || wget -O "$target_zip" "$url" 2>/dev/null
        if [ -f "$target_zip" ] && [ -s "$target_zip" ]; then
            echo "[2/3] Extracting $name into $extract_dir..."
            if command -v unzip >/dev/null 2>&1; then
                unzip -q -o "$target_zip" -d "$extract_dir"
            else
                python3 -c "import zipfile; zipfile.ZipFile('$target_zip').extractall('$extract_dir')"
            fi
            rm -f "$target_zip"
        fi
    fi

    # Flatten single nested folder if present
    local subdirs
    subdirs=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d)
    if [ "$(echo "$subdirs" | wc -l)" -eq 1 ] && [ -n "$subdirs" ]; then
        local inner=$(echo "$subdirs" | head -n 1)
        if [ "$(basename "$inner")" != "Asthma" ] && [ "$(basename "$inner")" != "COPD" ] && [ "$(basename "$inner")" != "Healthy" ]; then
            echo "Flattening inner folder: $(basename "$inner")..."
            mv "$inner"/* "$extract_dir"/ 2>/dev/null || true
            rmdir "$inner" 2>/dev/null || true
        fi
    fi

    echo "[3/3] Verification for $name:"
    local audio_count
    audio_count=$(find "$extract_dir" -type f \( -name "*.wav" -o -name "*.mp3" -o -name "*.flac" \) | wc -l)
    echo "Found $audio_count audio files in '$extract_dir'."
}

if [[ "$CHOICE" == "asthma" || "$CHOICE" == "all" ]]; then
    download_archive \
        "https://www.kaggle.com/api/v1/datasets/download/mohammedtawfikmusaed/asthma-detection-dataset-version-2" \
        "${DATASET_ROOT}/asthma_v2.zip" \
        "${DATASET_ROOT}/Asthma_Detection_V2" \
        "Kaggle Asthma Detection Dataset V2"
fi

if [[ "$CHOICE" == "icbhi" || "$CHOICE" == "all" ]]; then
    download_archive \
        "https://www.kaggle.com/api/v1/datasets/download/husninm/icbhi-2017-challenge" \
        "${DATASET_ROOT}/icbhi_2017.zip" \
        "${DATASET_ROOT}/ICBHI_final_dataset" \
        "ICBHI 2017 Challenge Dataset"
fi

echo "===================================="
echo "DOWNLOAD JOB COMPLETE"
date
echo "===================================="
