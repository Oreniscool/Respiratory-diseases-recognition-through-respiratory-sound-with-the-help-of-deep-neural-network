#!/bin/bash
#SBATCH --job-name=respinet_download_dataset
#SBATCH --partition=general
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=04:00:00
#SBATCH --output=%x_%j.out
#SBATCH --error=%x_%j.err

# ---------------------------------------------------------------------------
# RespiNet Dataset Download Job — SPIT GPU Cluster / Local Execution
# Downloads and extracts the ICBHI 2017 Challenge dataset into backend/dataset/
# ---------------------------------------------------------------------------

JOB_ID="${SLURM_JOB_ID:-local}"
LOGFILE="respinet_download_${JOB_ID}.log"

# Redirect all output to log file as well as stdout/stderr
exec > >(tee -a "$LOGFILE") 2>&1

echo "===================================="
echo "JOB START: ICBHI Dataset Download"
date
echo "Job ID:    $JOB_ID"
echo "Node:      ${SLURMD_NODENAME:-$(hostname)}"
echo "===================================="

# Ensure script is executed inside the backend directory or resolve paths relative to backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

DATASET_ROOT="dataset"
TARGET_DIR="${DATASET_ROOT}/ICBHI_final_dataset"
ZIP_FILE="${DATASET_ROOT}/icbhi-2017-challenge.zip"
DATASET_URL="https://www.kaggle.com/api/v1/datasets/download/husninm/icbhi-2017-challenge"

echo "[1/4] Preparing dataset directory at '${TARGET_DIR}'..."
mkdir -p "$TARGET_DIR"

echo "[2/4] Downloading dataset from Kaggle..."
echo "URL: $DATASET_URL"

curl -L -o "$ZIP_FILE" "$DATASET_URL"

if [ $? -ne 0 ] || [ ! -f "$ZIP_FILE" ]; then
    echo "ERROR: Failed to download dataset archive from Kaggle." >&2
    exit 1
fi

ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo "Download complete! Archive size: $ZIP_SIZE"

echo "[3/4] Extracting dataset files into '${TARGET_DIR}'..."
if command -v unzip >/dev/null 2>&1; then
    unzip -q -o "$ZIP_FILE" -d "$TARGET_DIR"
elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import zipfile; zipfile.ZipFile('$ZIP_FILE').extractall('$TARGET_DIR')"
else
    echo "ERROR: Neither 'unzip' nor 'python3' is available to extract the zip archive." >&2
    exit 1
fi

# Handle nested folder structure if zip contains an inner directory (e.g. ICBHI_final_database / ICBHI_final_dataset)
NESTED_DIR=$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)
if [ -n "$NESTED_DIR" ] && [ "$(find "$TARGET_DIR" -maxdepth 1 -name "*.wav" | wc -l)" -eq 0 ]; then
    echo "Flattening nested directory '$(basename "$NESTED_DIR")' into '${TARGET_DIR}'..."
    mv "$NESTED_DIR"/* "$TARGET_DIR"/ 2>/dev/null || true
    rmdir "$NESTED_DIR" 2>/dev/null || true
fi

echo "[4/4] Verifying dataset contents..."
WAV_COUNT=$(find "$TARGET_DIR" -name "*.wav" | wc -l)
TXT_COUNT=$(find "$TARGET_DIR" -name "*.txt" | wc -l)

echo "Found $WAV_COUNT .wav files and $TXT_COUNT .txt files in '$TARGET_DIR'."

if [ "$WAV_COUNT" -gt 0 ]; then
    echo "SUCCESS: ICBHI dataset successfully extracted to ${TARGET_DIR}."
    echo "Cleaning up zip archive '$ZIP_FILE'..."
    rm -f "$ZIP_FILE"
else
    echo "WARNING: No .wav files were found in '${TARGET_DIR}'. Please check the archive structure or download URL."
fi

echo "===================================="
echo "JOB END"
date
echo "===================================="
