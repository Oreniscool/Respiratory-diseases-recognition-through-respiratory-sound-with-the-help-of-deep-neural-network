"""
RespiNet — Flask Inference Server
Loads best_model.h5 and exposes a /predict endpoint that the frontend calls.

Run:
    python server.py

Then open frontend/index.html in your browser (or serve it from the same origin).
"""

import os
import io
import glob
import tempfile
import traceback

import numpy as np
import pandas as pd
import librosa
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from keras.models import load_model

# ── Config ────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE_DIR, "best_model.h5")
DATASET_DIR = os.path.join(BASE_DIR, "dataset", "ICBHI_final_dataset")
DIAGNOSIS   = os.path.join(BASE_DIR, "patient_diagnosis.csv")
PORT        = 5000

DEFAULT_CLASSES = [
    "Asthma",
    "Bronchiectasis",
    "Bronchiolitis",
    "COPD",
    "Healthy",
    "LRTI",
    "Pneumonia",
    "URTI",
]

N_MFCC = 40
MAX_LEN = 200
USE_DELTAS = True

# ── App init ──────────────────────────────────────────────────────
app   = Flask(__name__)
CORS(app)           # allow the HTML file opened from disk to call us
model = None        # loaded lazily on first request (or at startup below)
CLASSES = None


def load_class_labels():
    if not os.path.exists(DIAGNOSIS):
        print(f"[RespiNet] WARNING: {DIAGNOSIS} not found. Using default class list.")
        return DEFAULT_CLASSES

    try:
        df = pd.read_csv(DIAGNOSIS)
        diseases = [d for d in df["disease"].dropna().unique().tolist() if str(d).strip()]
        if not diseases:
            return DEFAULT_CLASSES
        try:
            from sklearn.preprocessing import LabelEncoder

            le = LabelEncoder()
            le.fit(diseases)
            return list(le.classes_)
        except Exception:
            return sorted(diseases)
    except Exception as e:
        print(f"[RespiNet] WARNING: Failed to load classes from CSV: {e}")
        return DEFAULT_CLASSES


CLASSES = load_class_labels()


def load_model_once():
    global model
    if model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. "
                "Run train.py first to generate best_model.h5."
            )
        print(f"[RespiNet] Loading model from {MODEL_PATH} …")
        model = load_model(MODEL_PATH)
        if CLASSES is not None:
            try:
                output_dim = int(model.output_shape[-1])
                if output_dim != len(CLASSES):
                    print(
                        "[RespiNet] WARNING: model output dim "
                        f"({output_dim}) does not match class labels "
                        f"({len(CLASSES)})."
                    )
            except Exception:
                pass
        print("[RespiNet] Model loaded ✓")
    return model


def _pad_truncate(features, max_len):
    if features.shape[1] < max_len:
        pad_width = max_len - features.shape[1]
        features = np.pad(features, ((0, 0), (0, pad_width)), mode='constant')
    else:
        features = features[:, :max_len]
    return features


def _extract_features(data_x, sampling_rate, n_mfcc=N_MFCC, max_len=MAX_LEN, use_deltas=USE_DELTAS):
    mfcc = librosa.feature.mfcc(y=data_x, sr=sampling_rate, n_mfcc=n_mfcc)

    if use_deltas:
        delta = librosa.feature.delta(mfcc)
        delta2 = librosa.feature.delta(mfcc, order=2)
        features = np.vstack([mfcc, delta, delta2])
    else:
        features = mfcc

    features = _pad_truncate(features, max_len)
    return features.T


def extract_mfcc(audio_bytes: bytes) -> np.ndarray:
    """
        Replicate the exact feature extraction used in featureExtraction.py:
            - librosa.load (kaiser_fast resampler)
            - MFCC + delta + delta-delta
            - pad/truncate to MAX_LEN
        Returns shape (1, 200, 120) for the sequence model.
    """
    # Write bytes to a temp file so librosa can open it
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        data_x, sampling_rate = librosa.load(tmp_path, res_type="kaiser_fast")
    finally:
        os.unlink(tmp_path)

    features = _extract_features(data_x, sampling_rate)

    # Reshape to (samples=1, time_steps=MAX_LEN, features=120)
    return features.reshape(1, features.shape[0], features.shape[1]), data_x, sampling_rate


# ── Routes ────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Simple liveness check the frontend polls to decide whether to use real or mock mode."""
    model_output = None
    if os.path.exists(MODEL_PATH):
        try:
            m = load_model_once()
            model_output = int(m.output_shape[-1])
        except Exception:
            model_output = None

    return jsonify({
        "status":  "ok",
        "model":   os.path.exists(MODEL_PATH),
        "dataset": os.path.isdir(DATASET_DIR) and bool(glob.glob(os.path.join(DATASET_DIR, "*.wav"))),
        "classes": CLASSES,
        "num_classes": len(CLASSES) if CLASSES else None,
        "model_output_dim": model_output,
    })


@app.route("/predict-sample/<disease>", methods=["GET"])
def predict_sample(disease):
    """
    Picks a real .wav file from the ICBHI dataset for the requested disease,
    runs the model on it, and returns the same JSON shape as /predict.

    disease must be one of: Bronchiectasis, Bronchiolitis, COPD, Healthy, Pneumonia, URTI
    """
    # Validate disease name
    valid = [c.lower() for c in CLASSES]
    if disease.lower() not in valid:
        return jsonify({"error": f"Unknown disease '{disease}'. Choose from: {', '.join(CLASSES)}"}), 400

    canonical = CLASSES[valid.index(disease.lower())]

    # Check dataset is present
    if not os.path.isdir(DATASET_DIR):
        return jsonify({"error": "Dataset directory not found. Please download the ICBHI 2017 dataset into dataset/ICBHI_final_dataset/"}), 503

    # Load diagnosis CSV
    try:
        df = pd.read_csv(DIAGNOSIS)
    except Exception as e:
        return jsonify({"error": f"Could not read patient_diagnosis.csv: {e}"}), 500

    # Get patient IDs for this disease (exclude patients 103, 108, 115 as in featureExtraction.py)
    excluded = {'103', '108', '115'}
    patient_ids = [
        str(pid) for pid in df[df['disease'] == canonical]['patient_id'].tolist()
        if str(pid) not in excluded
    ]

    if not patient_ids:
        return jsonify({"error": f"No patients found for disease '{canonical}'"}), 404

    # Find a wav file for one of these patients
    chosen_file = None
    chosen_patient = None
    for pid in patient_ids:
        pattern = os.path.join(DATASET_DIR, f"{pid}_*.wav")
        matches = sorted(glob.glob(pattern))
        if matches:
            chosen_file = matches[0]
            chosen_patient = pid
            break

    if chosen_file is None:
        return jsonify({
            "error": f"No .wav files found for disease '{canonical}' in {DATASET_DIR}. "
                     "Is the ICBHI 2017 dataset downloaded?"
        }), 404

    # Extract features and predict
    try:
        m = load_model_once()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503

    try:
        with open(chosen_file, "rb") as f:
            audio_bytes = f.read()
        X, data_x, sr = extract_mfcc(audio_bytes)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Feature extraction failed: {e}"}), 422

    try:
        raw = m.predict(X, verbose=0)

        if raw.ndim == 3:
            probs = raw[0, 0, :]
        elif raw.ndim == 2:
            probs = raw[0, :]
        else:
            probs = raw.flatten()

        pred_idx   = int(np.argmax(probs))
        pred_label = CLASSES[pred_idx]
        confidence = float(probs[pred_idx]) * 100

        prob_dict = {
            cls: round(float(p) * 100, 2)
            for cls, p in zip(CLASSES, probs)
        }

        duration_s   = float(len(data_x)) / sr
        mfcc_preview = X.flatten()[:10].tolist()
        filename     = os.path.basename(chosen_file)

        return jsonify({
            "prediction":    pred_label,
            "confidence":    round(confidence, 2),
            "probabilities": prob_dict,
            "mfcc_preview":  [round(v, 2) for v in mfcc_preview],
            "duration_s":    round(duration_s, 2),
            "sample_rate":   int(sr),
            "filename":      filename,
            "patient_id":    chosen_patient,
            "requested_disease": canonical,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Inference failed: {e}"}), 500


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts a multipart/form-data POST with a single field 'file'
    containing an audio file (.wav recommended).

    Returns JSON:
    {
        "prediction":   "COPD",
        "confidence":   91.3,
        "probabilities": {
            "Bronchiectasis": 1.0,
            "Bronchiolitis":  0.3,
            "COPD":           91.3,
            "Healthy":        4.1,
            "Pneumonia":      0.5,
            "URTI":           2.8
        },
        "mfcc_preview": [-168.7, 95.2, ...],   // first 10 coefficients
        "duration_s":   18.3,
        "sample_rate":  22050
    }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    audio_file = request.files["file"]
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    audio_bytes = audio_file.read()
    if not audio_bytes:
        return jsonify({"error": "Empty file"}), 400

    try:
        m = load_model_once()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503

    try:
        X, data_x, sr = extract_mfcc(audio_bytes)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Feature extraction failed: {e}"}), 422

    try:
        # Model output shape: (1, 1, num_classes) because GRU return_sequences=True
        raw = m.predict(X, verbose=0)

        # Flatten to (num_classes,)
        if raw.ndim == 3:
            probs = raw[0, 0, :]        # (1, 1, 6) → (6,)
        elif raw.ndim == 2:
            probs = raw[0, :]           # (1, 6)    → (6,)
        else:
            probs = raw.flatten()

        pred_idx   = int(np.argmax(probs))
        pred_label = CLASSES[pred_idx]
        confidence = float(probs[pred_idx]) * 100

        prob_dict = {
            cls: round(float(p) * 100, 2)
            for cls, p in zip(CLASSES, probs)
        }

        duration_s  = float(len(data_x)) / sr
        mfcc_preview = X.flatten()[:10].tolist()

        return jsonify({
            "prediction":    pred_label,
            "confidence":    round(confidence, 2),
            "probabilities": prob_dict,
            "mfcc_preview":  [round(v, 2) for v in mfcc_preview],
            "duration_s":    round(duration_s, 2),
            "sample_rate":   int(sr),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Inference failed: {e}"}), 500


# ── Entry point ───────────────────────────────────────────────────
if __name__ == "__main__":
    CLASSES = load_class_labels()
    print(f"[RespiNet] Class labels: {', '.join(CLASSES)}")
    # Pre-load model at startup so the first request isn't slow
    try:
        load_model_once()
    except FileNotFoundError as e:
        print(f"[RespiNet] WARNING: {e}")
        print("[RespiNet] Server will still start — model loads on first valid request.")

    print(f"[RespiNet] Server running at http://localhost:{PORT}")
    print(f"[RespiNet] Health check: http://localhost:{PORT}/health")
    app.run(host="0.0.0.0", port=PORT, debug=False)
