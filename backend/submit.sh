#!/bin/bash
#SBATCH --job-name=respinet_train
#SBATCH --partition=general
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=32
#SBATCH --mem=64G
#SBATCH --gres=gpu:1
#SBATCH --time=1-00:00:00
#SBATCH --output=%x_%j.out
#SBATCH --error=%x_%j.err

# ---------------------------------------------------------------------------
# RespiNet Training Job — SPIT GPU Cluster
# Respiratory Disease Recognition via Deep Neural Network
# ---------------------------------------------------------------------------

LOGFILE="respinet_train_${SLURM_JOB_ID}.log"

# Redirect all output to log file as well as stdout/stderr
exec > >(tee -a "$LOGFILE") 2>&1

echo "===================================="
echo "JOB START: RespiNet Training"
date
echo "Job ID:    $SLURM_JOB_ID"
echo "Node:      $SLURMD_NODENAME"
echo "===================================="

# ---------------------------------------------------------------------------
# 1. Load Python module (managed by the cluster — do NOT install manually)
# ---------------------------------------------------------------------------
echo "[1/5] Loading Python and CUDA modules..."
module load python/3.11.14
module load cuda 2>/dev/null || module load cuda/12.2 2>/dev/null || module load cuda/11.8 2>/dev/null || true

# ---------------------------------------------------------------------------
# 2. Set up a fast virtual environment using uv
#    The env is stored in the project directory so it persists between jobs.
# ---------------------------------------------------------------------------
ENV_DIR="respinet_env"

if [ ! -d "$ENV_DIR" ]; then
    echo "[2/5] Creating virtual environment at $ENV_DIR ..."
    uv venv "$ENV_DIR"
else
    echo "[2/5] Virtual environment already exists — skipping creation."
fi

source "$ENV_DIR/bin/activate"

# ---------------------------------------------------------------------------
# 3. Install / sync dependencies from requirements.txt
# ---------------------------------------------------------------------------
echo "[3/5] Installing dependencies..."
uv pip install -r requirements.txt

# Export installed NVIDIA CUDA/cuDNN library paths into LD_LIBRARY_PATH
NVIDIA_LIBS=$(python -c "import site, glob, os; dirs = glob.glob(os.path.join(site.getsitepackages()[0], 'nvidia', '*', 'lib')); print(':'.join(dirs))" 2>/dev/null)
if [ -n "$NVIDIA_LIBS" ]; then
    export LD_LIBRARY_PATH="$NVIDIA_LIBS:/usr/local/cuda/lib64:/usr/lib64:$LD_LIBRARY_PATH"
    echo "[INFO] Exported NVIDIA CUDA library paths into LD_LIBRARY_PATH:"
    echo "       $NVIDIA_LIBS"
fi

# Ensure dataset_provenance.json exists and matches patient_diagnosis.csv checksum
python - <<'PYEOF'
import hashlib, json
from collections import Counter
import pandas as pd
from pathlib import Path

csv_path = Path("patient_diagnosis.csv")
if csv_path.exists():
    digest = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    df = pd.read_csv(csv_path)
    counts = dict(sorted(Counter(df["disease"].dropna().astype(str).str.strip()).items()))
    prov = {
        "dataset_name": "ICBHI 2017 Respiratory Sound Database",
        "source_url": "https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge",
        "download_date": "2026-08-05",
        "license": "ICBHI 2017 Challenge Terms",
        "diagnosis_sha256": digest,
        "label_counts": counts
    }
    Path("dataset_provenance.json").write_text(json.dumps(prov, indent=2), encoding="utf-8")
    print(f"[INFO] Verified dataset_provenance.json (SHA256: {digest[:12]}..., Label Counts: {counts})")
PYEOF

# ---------------------------------------------------------------------------
# 4. Verify GPU is visible
# ---------------------------------------------------------------------------
echo "[4/5] Checking GPU availability..."
nvidia-smi
python - <<'PYEOF'
import ctypes
import tensorflow as tf

print(f"TensorFlow version : {tf.__version__}")
gpus = tf.config.list_physical_devices('GPU')
print(f"GPUs visible       : {gpus}")

if not gpus:
    print("[DIAGNOSTIC] TensorFlow did not register GPU. Auditing CUDA libraries in LD_LIBRARY_PATH...")
    for lib in ["libcudart.so.12", "libcudnn.so.9", "libcublas.so.12", "libcufft.so.11", "libcurand.so.10", "libcusolver.so.11", "libcusparse.so.12", "libnccl.so.2"]:
        try:
            ctypes.CDLL(lib)
            print(f"  ✓ Loaded {lib}")
        except Exception as err:
            print(f"  ✗ Failed {lib}: {err}")
PYEOF

# ---------------------------------------------------------------------------
# 5. Run training
#    Adjust --dataset-dir to wherever you have placed the ICBHI dataset.
#    All other defaults from main.py are used unless overridden here.
# ---------------------------------------------------------------------------
# Resolve dataset directory path
DATASET_PATH="dataset/ICBHI_final_dataset"
if [ ! -d "$DATASET_PATH" ] && [ -d "$HOME/dataset/ICBHI_final_dataset" ]; then
    DATASET_PATH="$HOME/dataset/ICBHI_final_dataset"
    echo "[INFO] Using dataset from home directory: $DATASET_PATH"
fi

echo "[5/5] Starting RespiNet training..."
python main.py \
    --dataset-dir        "$DATASET_PATH" \
    --diagnosis-csv      "patient_diagnosis.csv" \
    --dataset-provenance "dataset_provenance.json" \
    --output-dir         "artifacts/run_${SLURM_JOB_ID}" \
    --epochs             50 \
    --batch-size         32 \
    --seed               42

echo "===================================="
echo "JOB END"
date
echo "===================================="
