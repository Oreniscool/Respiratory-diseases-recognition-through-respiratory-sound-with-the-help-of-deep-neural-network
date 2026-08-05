# SPIT GPU Cluster User Guide & Documentation
`SPIT_GPU_PROTOCOL_V2.1`

Complete operational manual, best practices, cluster policies, environment setup, job submission templates, and acceptable use policy for the **Sardar Patel Institute of Technology (SPIT) High-Performance GPU Cluster**.

---

## 📌 Quick Reference & Portals

| Resource | Link / Detail |
| :--- | :--- |
| **Documentation Portal** | [gpu.spit.ac.in/docs](https://gpu.spit.ac.in/docs) |
| **Interactive Apps (OpenOnDemand)** | [cluster.gpu.spit.ac.in](http://cluster.gpu.spit.ac.in) |
| **GitHub Repository** | [Rio-0912/SPIT-GPU-Docs](https://github.com/Rio-0912/SPIT-GPU-Docs) |
| **Video Walkthrough Guide** | [YouTube Execution Guide](https://youtu.be/jgjSj-YrQgs?si=sehbIE1ZT_F5-yPy) |
| **Support Email** | `gpu@spit.ac.in` / `rehan.ansari24@spit.ac.in` / `varun.jhaveri23@spit.ac.in` |

---

## ⚡ 1. Cluster Hardware & System Specifications

The SPIT GPU Cluster is a high-performance compute node dedicated to advanced research, deep learning, and computational modeling.

* **CPUs**: Dual AMD EPYC processors (224 Threads, 112 Cores)
* **GPUs**: 2x NVIDIA RTX A6000 (Ada Generation)
* **System RAM**: 250 GB DDR5 RAM
* **Primary Partition**: `general`
* **Hard Time Limit (Batch Jobs)**: 7 Days (168 Hours)
* **Hard Time Limit (Interactive Sessions)**: 1.5 Hours per session

---

## 🏆 2. Golden Rules & Best Practices

1. **Test Locally First**: Always run and debug your code locally on a CPU or lightweight sample dataset before deploying to GPU nodes.
2. **Set Meaningful Job Names**: Match `--job-name` with your task purpose for easy tracking in Slurm queues.
3. **Right-size GPU Requests**: Request `--gres=gpu:1` unless your codebase explicitly implements multi-GPU distributed training (`gpu:2`).
4. **Monitor Memory Limits**: Select appropriate `--mem` values to avoid `Out Of Memory (OOM)` process kills.
5. **Use Log Files**: Avoid printing raw output to terminal; direct stdout and stderr to log files (`--output` / `--error`).
6. **Isolated Environments**: Never rely on system Python. Always build an isolated virtual environment (`uv` or `conda`).
7. **Modular Code Structure**: Avoid giant single-file scripts; maintain modular packages and clear entrypoints.

---

## 🔒 3. Terms of Service, Acceptable Use Policy & Privacy

### Permitted Usage
The cluster is strictly provisioned for academic research and sanctioned student innovation.

### Prohibited Conduct
* ❌ **Cryptomining & Blockchain Execution**: Completely forbidden.
* ❌ **Commercial Hosting/Services**: No commercial workloads or background web services.
* ❌ **Bypassing Scheduler Limits**: Attempting to bypass Slurm resource or memory limits.
* ❌ **Over-Allocation**: Requesting 2 GPUs for single-GPU or CPU-bound scripts.
* ❌ **Direct Hardware Access via SSH**: Direct SSH compute execution is forbidden; workloads must be launched via `sbatch`, `srun`, or OpenOnDemand.
* ❌ **Ignoring Admin Warnings**: Failing to check or respond to cluster administrative notices.

> [!CAUTION]
> ### 🚨 Critical Warning Protocol & Ban Penalty
> Failure to acknowledge or reply to **two (2) consecutive email warnings** from HPC administrators will result in an immediate, non-negotiable **2-year ban** from the cluster.

### Intellectual Property & Required Attribution
All code, models, and research outputs remain the exclusive IP of the user. However, as consideration for using cluster resources, **users are legally bound to acknowledge the SPIT GPU Cluster** in all resulting publications, theses, conference papers, and presentations:

> *"The authors acknowledge the high-performance computing resources provided by the SPIT GPU Cluster (gpu.spit.ac.in) for the execution of deep learning models and numerical simulations."*

---

## 🔄 4. Account Lifecycle, Telemetry & Data Retention

### Access Term & Account Renewal
* **Initial Access**: Granted for a fixed **15-day** duration upon request approval via `gpu.spit.ac.in/login`.
* **Extension**: Users must manually request access extensions prior to expiry with project progress details.

> [!WARNING]
> ### 🧹 Automated Data Purge Protocol
> A daemonized maintenance process runs automatically on the **1st day of every month**.
> * Expired user home directories are archived (`.tar`) and **permanently deleted** (`rm -rf`).
> * Users are solely responsible for offloading their datasets, trained checkpoints, and code before account expiry.

### System Telemetry & Accounting
* Telemetry is tracked via `slurmdbd` utilizing Trackable RESource (TRES) metrics.
* Accumulated metrics: CPU-core-seconds, RAM-byte-seconds, and GPU-device-seconds (`gres/gpu`).
* HPC Administrators (Shrikant Goswami, Sushant Goswami, Dr. Dhananjay Kalbande, Varun Jhaveri) retain root access for queue management, troubleshooting, and policy enforcement.

---

## 🐍 5. Software Environment Management

Software on the cluster is loaded on-demand using **Environment Modules**. Do not attempt manual system Python or CUDA driver installations.

### Viewing Available Modules
```bash
module avail
```

### Option A: Fast Setup with `uv` + `venv` (Recommended)
`uv` is optimized for ultra-fast virtualenv creation and package installation on HPC systems.

```bash
# 1. Load desired Python module
module load python/3.11.14

# 2. Create isolated virtual environment
uv venv my_env

# 3. Activate environment
source my_env/bin/activate

# 4. Install ML dependencies
uv pip install torch torchvision torchaudio matplotlib tqdm scikit-learn
```

### Option B: Conda / Miniconda Setup
```bash
# 1. Load Miniconda module
module load miniconda3

# 2. Create Conda environment
conda create -n my_project python=3.11 -y

# 3. Activate environment
conda activate my_project

# 4. Install dependencies
pip install torch torchvision
```

---

## 🐳 6. Containerized Workloads (Apptainer / Singularity)

For complex dependencies, custom C++ bindings, or NVIDIA NGC images, use **Apptainer** (Docker container executor in unprivileged user space).

### Pulling a Docker Image
```bash
apptainer pull pytorch_ngc.sif docker://nvcr.io/nvidia/pytorch:24.02-py3
```

### Executing Container with GPU Acceleration
The `--nv` flag passes host NVIDIA GPU drivers into the container environment:
```bash
apptainer exec --nv pytorch_ngc.sif python3 train_model.py
```

---

## 📜 7. Job Submission Guide (`sbatch`)

Workloads are submitted to the Slurm queue using `sbatch`.

### standard Submission Script (`submit.sh`)
```bash
#!/bin/bash
#SBATCH --job-name=resp_sound_train
#SBATCH --partition=general
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=32
#SBATCH --gres=gpu:1
#SBATCH --mem=64G
#SBATCH --time=24:00:00
#SBATCH --output=logs/slurm_%j.out
#SBATCH --error=logs/slurm_%j.err

# Create logs directory if missing
mkdir -p logs

# Load environment
module load python/3.11.14
source my_env/bin/activate

# Execute training script
python main.py --epochs 50 --batch-size 64
```

### Job Commands
* **Submit Job**: `sbatch submit.sh`
* **Check Queue Status**: `squeue -u $USER` or `squeue -l`
* **Cancel Job**: `scancel <JOB_ID>`
* **Monitor GPU Usage**: `watch -n 1 nvidia-smi` (Run during interactive debugging or batch execution)

---

## 📁 8. Job Submission Templates (`templates/`)

Pre-configured boilerplate templates are available in the [SPIT-GPU-Docs Repository](https://github.com/Rio-0912/SPIT-GPU-Docs):

| Template Directory | Target Workload | Specs |
| :--- | :--- | :--- |
| `templates/cpu_worker/` | CPU-only data preprocessing, audio features | 16 CPU cores, 32GB RAM, 0 GPUs |
| `templates/gpu_single/` | **Standard AI/ML training** (Default) | 1 GPU (RTX A6000), 32 CPU cores, 64GB RAM |
| `templates/gpu_max/` | Large-scale multi-GPU training | 2 GPUs, 112 CPU cores, 120GB RAM |
| `templates/mpi_distributed/` | Distributed CPU parallel compute | 64 MPI tasks, 0 GPUs |
| `templates/gpu_apptainer/` | Containerized NGC Docker execution | 1 GPU (`--nv`), Apptainer image |

### Example Usage:
```bash
git clone https://github.com/Rio-0912/SPIT-GPU-Docs.git
cp templates/gpu_single/submit.sh my_project/
cd my_project/
sbatch submit.sh
```

---

## 🖥️ 9. Interactive Development Apps

For interactive debugging, data exploration, and visual editing, access [cluster.gpu.spit.ac.in](http://cluster.gpu.spit.ac.in).

* **VS Code Remote / Server**: Launch web VS Code with full terminal access to loaded modules and python venvs.
* **JupyterLab / Jupyter Notebook**: Use `main.ipynb` as a template for interactive model testing.
* **Interactive Desktop Mode**: Full Linux graphical interface for GUI tools.

> [!NOTE]
> Interactive sessions are strictly limited to **1.5 Hours (90 minutes)** max continuous duration. Save your progress regularly.

---

## 📞 10. Support & Escalations

For account extensions, custom module requests, or cluster hardware issues:
* **Primary Cluster Email**: `gpu@spit.ac.in`
* **Administrators & Maintainers**:
  * Rehan Ansari (`rehan.ansari24@spit.ac.in`)
  * Varun Jhaveri (`varun.jhaveri23@spit.ac.in`)
  * Shrikant Goswami
  * Sushant Goswami
  * Dr. Dhananjay Kalbande
