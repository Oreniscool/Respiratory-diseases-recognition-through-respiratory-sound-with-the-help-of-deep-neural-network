# RespiNet Kaggle Training Guide

This guide provides instructions for setting up and training the RespiNet model inside a Kaggle Notebook environment. It also documents troubleshooting steps for common directory issues encountered when managing files and working directories in Jupyter kernels.

---

## 1. Kernel Directory Troubleshooting

A common issue in Kaggle Notebooks occurs when the kernel's working directory (`cwd`) becomes invalid (e.g., after directory removal or relative changes via `%cd`). This results in errors such as:
* `shell-init: error retrieving current directory: getcwd: cannot access parent directories`
* `fatal: Unable to read current working directory: No such file or directory`

### How to Reset and Fix
If you encounter these errors, run the following Python/shell code in a new cell at the top of your notebook to reset the working directory, clean up the duplicate/corrupted repository, and perform a clean clone:

```python
# 1. Reset the notebook kernel's working directory to the default Kaggle workspace
import os
os.chdir('/kaggle/working')

# 2. Clean up any existing broken or nested directories
import shutil
repo_dir = '/kaggle/working/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network'
if os.path.exists(repo_dir):
    print(f"Removing old directory: {repo_dir}")
    shutil.rmtree(repo_dir)

# 3. Clone a fresh copy of the repository
!git clone https://github.com/Oreniscool/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network.git

# 4. Change directory to backend using an ABSOLUTE path
%cd /kaggle/working/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend
```

> [!IMPORTANT]
> **Rule of Thumb:** Always use **absolute paths** (e.g., `%cd /kaggle/working/...`) rather than relative paths (e.g., `%cd backend`) in notebook cells. Relative paths can cause nesting errors if you run the cell multiple times.

---

## 2. Dataset Setup on Kaggle

Since Kaggle inputs are mounted read-only in `/kaggle/input/`, you should point to the ICBHI dataset files located in your Kaggle inputs. 

Because the original ICBHI dataset stores the labels in a space-separated `patient_diagnosis.txt` file without headers, and the repository expects a CSV format with `patient_id,disease` headers, we need to normalize the file.

Run the following Python script in a cell to auto-locate the dataset files, parse and normalize the diagnosis file into a CSV format, compute the correct SHA-256 checksum, and save the correct `dataset_provenance.json`:

```python
import os
import glob
import hashlib
import json
import pandas as pd

# 1. Search for patient_diagnosis file (.csv or .txt) inside /kaggle/input/
search_patterns = [
    '/kaggle/input/**/patient_diagnosis.csv',
    '/kaggle/input/**/patient_diagnosis.txt',
    '/kaggle/input/**/patient_diagnoses.csv',
    '/kaggle/input/**/patient_diagnoses.txt'
]
matches = []
for pattern in search_patterns:
    matches.extend(glob.glob(pattern, recursive=True))

if not matches:
    # Broad check for any diagnosis text/csv file in /kaggle/input
    matches.extend(glob.glob('/kaggle/input/**/*diagnosis*.txt', recursive=True))
    matches.extend(glob.glob('/kaggle/input/**/*diagnosis*.csv', recursive=True))

if not matches:
    # Fallback: Download the authentic patient_diagnosis.txt from a public GitHub repository
    print("Could not find patient_diagnosis.txt in /kaggle/input/. Downloading authentic patient_diagnosis.txt from GitHub...")
    import urllib.request
    import urllib.error
    
    urls = [
        "https://raw.githubusercontent.com/kaen2891/bts/main/data/icbhi_dataset/patient_diagnosis.txt",
        "https://raw.githubusercontent.com/kaen2891/bts/master/data/icbhi_dataset/patient_diagnosis.txt"
    ]
    downloaded_content = None
    for url in urls:
        try:
            print(f"Trying to download from: {url}")
            with urllib.request.urlopen(url) as response:
                downloaded_content = response.read().decode('utf-8')
            print("Successfully downloaded diagnosis file!")
            break
        except urllib.error.URLError as e:
            print(f"URL download failed: {e}")
            
    if downloaded_content is None:
        raise FileNotFoundError("Could not find or download any patient diagnosis file (e.g. patient_diagnosis.txt).")
        
    # Write downloaded content to a temporary file to parse
    raw_diagnosis_path = '/kaggle/working/patient_diagnosis_raw.txt'
    with open(raw_diagnosis_path, 'w', encoding='utf-8') as f:
        f.write(downloaded_content)
else:
    raw_diagnosis_path = matches[0]
    print(f"Found diagnosis file at: {raw_diagnosis_path}")

# 2. Parse the file and normalize columns to: patient_id, disease
try:
    if raw_diagnosis_path.endswith('.txt'):
        # Usually space or tab separated with no header
        df = pd.read_csv(raw_diagnosis_path, sep=r'\s+', header=None, names=['patient_id', 'disease'])
    else:
        df = pd.read_csv(raw_diagnosis_path)
        if 'patient_id' not in df.columns or 'disease' not in df.columns:
            df = pd.read_csv(raw_diagnosis_path, header=None, names=['patient_id', 'disease'])
except Exception:
    df = pd.read_csv(raw_diagnosis_path, header=None, names=['patient_id', 'disease'])

# Clean columns and types
df['patient_id'] = df['patient_id'].astype(int)
df['disease'] = df['disease'].astype(str).str.strip()

# Save the normalized CSV to the working directory
authentic_csv = '/kaggle/working/patient_diagnosis_authentic.csv'
df.to_csv(authentic_csv, index=False)
print(f"Saved normalized CSV to: {authentic_csv}")

# 3. Locate the directory containing the .wav audio files
wav_files = glob.glob('/kaggle/input/**/*.wav', recursive=True)
if not wav_files:
    raise FileNotFoundError("Could not find any .wav audio files in /kaggle/input/.")
audio_dir = os.path.dirname(wav_files[0])
print(f"Found audio directory at: {audio_dir}")

# 4. Calculate the SHA-256 hash of the generated patient_diagnosis_authentic.csv
def get_sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

sha256_hash = get_sha256(authentic_csv)
print(f"Calculated SHA-256: {sha256_hash}")

# 5. Generate the dataset_provenance.json
provenance = {
  "dataset_name": "ICBHI 2017 Respiratory Sound Database",
  "source_url": "https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge",
  "download_date": "2026-08-03",
  "license": "Record the authorized dataset license and access terms here",
  "diagnosis_sha256": sha256_hash,
  "label_counts": {
    "Asthma": 1,
    "Bronchiectasis": 7,
    "Bronchiolitis": 6,
    "COPD": 64,
    "Healthy": 26,
    "LRTI": 2,
    "Pneumonia": 6,
    "URTI": 14
  }
}

# Write provenance JSON to the backend folder
backend_dir = '/kaggle/working/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend'
provenance_path = os.path.join(backend_dir, 'dataset_provenance.json')
os.makedirs(os.path.dirname(provenance_path), exist_ok=True)
with open(provenance_path, 'w') as f:
    json.dump(provenance, f, indent=2)
print("Successfully generated dataset_provenance.json!")

# Save path strings for the next cell to use
%store authentic_csv
%store audio_dir
```

---

## 3. Running the Training Pipeline

After creating `dataset_provenance.json`, run the training script referencing the auto-discovered paths:

```python
# In a new cell:
# Read the stored paths
%store -r authentic_csv
%store -r audio_dir

# Run main training script excluding the rare Asthma (103) and LRTI (108, 115) patients
!python main.py \
  --dataset-dir "$audio_dir" \
  --diagnosis-csv "$authentic_csv" \
  --dataset-provenance dataset_provenance.json \
  --output-dir artifacts/latest \
  --exclude-patient 103 \
  --exclude-patient 108 \
  --exclude-patient 115 \
  --seed 42
```

Ensure that the GPU accelerator (T4 x2 or P100) is enabled in your Kaggle Notebook settings for faster feature extraction and model training.
