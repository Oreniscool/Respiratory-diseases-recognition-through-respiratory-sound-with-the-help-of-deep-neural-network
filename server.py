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
import json
import base64
import tempfile
import traceback
import urllib.request
import urllib.error

import numpy as np
import pandas as pd
import librosa
import tensorflow as tf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from keras.models import load_model
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE_DIR, "best_model.h5")
DATASET_DIR = os.path.join(BASE_DIR, "dataset", "ICBHI_final_dataset")
DIAGNOSIS   = os.path.join(BASE_DIR, "patient_diagnosis.csv")
PORT        = 5000

load_dotenv()

GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_DEBUG   = os.getenv("GROQ_DEBUG", "0").strip().lower() in {"1", "true", "yes"}
GROQ_USER_AGENT = os.getenv("GROQ_USER_AGENT", "RespiNet/1.0 (+https://example.invalid)")

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


def extract_mfcc(audio_bytes: bytes, denoise: bool = False) -> np.ndarray:
    """
        Replicate the exact feature extraction used in featureExtraction.py:
            - librosa.load (kaiser_fast resampler)
            - optional noise cancellation (spectral gating)
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

    if denoise:
        data_x = _apply_noise_reduction(data_x, sampling_rate)

    features = _extract_features(data_x, sampling_rate)

    # Reshape to (samples=1, time_steps=MAX_LEN, features=120)
    return features.reshape(1, features.shape[0], features.shape[1]), data_x, sampling_rate


def _normalize_array(arr: np.ndarray) -> np.ndarray:
    arr = np.nan_to_num(arr)
    min_v = float(np.min(arr))
    max_v = float(np.max(arr))
    if max_v - min_v < 1e-8:
        return np.zeros_like(arr)
    return (arr - min_v) / (max_v - min_v)


def _parse_bool(value) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _apply_noise_reduction(
    data_x: np.ndarray,
    sampling_rate: int,
    noise_window_s: float = 0.5,
    n_fft: int = 2048,
    hop_length: int = 512,
    reduction: float = 1.2,
) -> np.ndarray:
    if data_x.size == 0:
        return data_x

    noise_samples = int(max(noise_window_s, 0.1) * sampling_rate)
    noise_clip = data_x[:noise_samples] if data_x.size > noise_samples else data_x

    stft = librosa.stft(data_x, n_fft=n_fft, hop_length=hop_length)
    mag = np.abs(stft)
    phase = np.angle(stft)

    noise_stft = librosa.stft(noise_clip, n_fft=n_fft, hop_length=hop_length)
    noise_mag = np.abs(noise_stft)
    noise_profile = np.median(noise_mag, axis=1, keepdims=True)

    mag_denoised = np.maximum(mag - (noise_profile * reduction), 0.0)
    stft_denoised = mag_denoised * np.exp(1j * phase)
    return librosa.istft(stft_denoised, hop_length=hop_length, length=data_x.shape[0])


def _render_image(array2d: np.ndarray, cmap: str = "magma") -> str:
    fig = plt.figure(figsize=(6, 3), dpi=140)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off")
    ax.imshow(array2d, aspect="auto", origin="lower", cmap=cmap)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _render_overlay(base2d: np.ndarray, overlay2d: np.ndarray) -> str:
    fig = plt.figure(figsize=(6, 3), dpi=140)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off")
    ax.imshow(base2d, aspect="auto", origin="lower", cmap="magma")
    ax.imshow(overlay2d, aspect="auto", origin="lower", cmap="cool", alpha=0.45)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


class GroqError(RuntimeError):
    def __init__(self, message: str, diagnostics: dict | None = None):
        super().__init__(message)
        self.diagnostics = diagnostics or {}


def _extract_error_diagnostics(e: urllib.error.HTTPError, details: str) -> dict:
    headers = {k.lower(): v for k, v in (e.headers or {}).items()} if hasattr(e, "headers") else {}
    diagnostics = {
        "status": e.code,
        "reason": getattr(e, "reason", None),
        "url": GROQ_API_URL,
        "model": GROQ_MODEL,
        "cf_ray": headers.get("cf-ray"),
        "server": headers.get("server"),
        "request_id": headers.get("x-request-id") or headers.get("x-groq-id"),
        "content_type": headers.get("content-type"),
    }
    if details:
        diagnostics["body_snippet"] = details[:1200]
        if "1010" in details:
            diagnostics["hint"] = "Cloudflare Access Denied (error 1010). IP/region/network may be blocked."
    return {k: v for k, v in diagnostics.items() if v is not None}


def call_groq(messages, temperature=0.2, max_tokens=500) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        GROQ_API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "User-Agent": GROQ_USER_AGENT,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        details = e.read().decode("utf-8", errors="ignore")
        diagnostics = _extract_error_diagnostics(e, details)
        print(f"[RespiNet] Groq HTTP error: {diagnostics}")
        raise GroqError("Groq API error", diagnostics)
    except urllib.error.URLError as e:
        diagnostics = {"url": GROQ_API_URL, "reason": str(e)}
        print(f"[RespiNet] Groq connection error: {diagnostics}")
        raise GroqError("Groq API connection error", diagnostics)


def _compute_saliency(m, X: np.ndarray) -> tuple[np.ndarray, int]:
    x_tensor = tf.convert_to_tensor(X, dtype=tf.float32)
    with tf.GradientTape() as tape:
        tape.watch(x_tensor)
        preds = m(x_tensor, training=False)
        if len(preds.shape) == 3:
            preds = preds[:, 0, :]
        class_idx = int(tf.argmax(preds[0]).numpy())
        target = preds[:, class_idx]
    grads = tape.gradient(target, x_tensor)
    if grads is None:
        raise RuntimeError("Failed to compute saliency gradients")
    saliency = tf.reduce_mean(tf.abs(grads), axis=-1)[0].numpy()
    return _normalize_array(saliency), class_idx


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
    Optional query param: denoise=1 to enable noise cancellation.
    """
    denoise = _parse_bool(request.args.get("denoise"))

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
        X, data_x, sr = extract_mfcc(audio_bytes, denoise=denoise)
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
            "noise_cancellation": denoise,
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
    Optional form field: denoise=1 to enable noise cancellation.

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

    denoise = _parse_bool(request.form.get("denoise"))

    try:
        m = load_model_once()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503

    try:
        X, data_x, sr = extract_mfcc(audio_bytes, denoise=denoise)
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
            "noise_cancellation": denoise,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Inference failed: {e}"}), 500


@app.route("/explain", methods=["POST"])
def explain():
    """Explainability endpoint. Optional form field: denoise=1 to match inference noise cancellation."""
    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    audio_file = request.files["file"]
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    audio_bytes = audio_file.read()
    if not audio_bytes:
        return jsonify({"error": "Empty file"}), 400

    denoise = _parse_bool(request.form.get("denoise"))

    payload_raw = request.form.get("payload") or "{}"
    try:
        payload = json.loads(payload_raw)
    except Exception:
        payload = {}

    include_reason = bool(payload.get("include_reason"))
    model_result = payload.get("model_result") or {}
    patient_info = payload.get("patient_info") or {}

    try:
        m = load_model_once()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503

    try:
        X, data_x, sr = extract_mfcc(audio_bytes, denoise=denoise)
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

        pred_idx = int(np.argmax(probs))
        pred_label = CLASSES[pred_idx]
        confidence = float(probs[pred_idx]) * 100
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Inference failed: {e}"}), 500

    try:
        saliency, saliency_idx = _compute_saliency(m, X)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Saliency failed: {e}"}), 500

    try:
        spec = librosa.feature.melspectrogram(y=data_x, sr=sr, n_mels=128)
        spec_db = librosa.power_to_db(spec, ref=np.max)
        spec_db = _normalize_array(spec_db)

        time_bins = spec_db.shape[1]
        if time_bins != saliency.size:
            saliency_resampled = np.interp(
                np.linspace(0, 1, time_bins),
                np.linspace(0, 1, saliency.size),
                saliency,
            )
        else:
            saliency_resampled = saliency

        saliency_2d = np.tile(saliency_resampled, (spec_db.shape[0], 1))

        spectrogram_img = _render_image(spec_db, cmap="magma")
        saliency_img = _render_image(saliency_2d, cmap="cool")
        overlay_img = _render_overlay(spec_db, saliency_2d)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Explainability render failed: {e}"}), 500

    top_indices = np.argsort(probs)[::-1][:3].tolist()
    top_classes = [
        {"label": CLASSES[i], "pct": round(float(probs[i]) * 100, 2)}
        for i in top_indices
    ]

    response = {
        "prediction": pred_label,
        "confidence": round(confidence, 2),
        "top_classes": top_classes,
        "spectrogram": spectrogram_img,
        "saliency": saliency_img,
        "overlay": overlay_img,
        "saliency_class": CLASSES[saliency_idx] if saliency_idx < len(CLASSES) else pred_label,
    }

    if include_reason:
        if not GROQ_API_KEY:
            response["reasoning_error"] = "GROQ_API_KEY not set on server"
        else:
            system_msg = (
                "You are a clinical explainability assistant. Using model results, patient context, "
                "and the fact that the saliency overlay highlights time regions of interest, write a short "
                "non-diagnostic explanation of why the model may have predicted the top class. "
                "Use 3-5 bullet points under the headings: Evidence, Context, Next Steps. "
                "Avoid definitive diagnoses and include a brief disclaimer."
            )
            user_msg = "Input data (JSON):\n" + json.dumps(
                {
                    "model_result": model_result or {
                        "prediction": pred_label,
                        "confidence": round(confidence, 2),
                        "top_classes": top_classes,
                    },
                    "patient_info": patient_info,
                    "saliency_class": response["saliency_class"],
                },
                ensure_ascii=True,
            )
            try:
                response["reasoning"] = call_groq(
                    [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    temperature=0.2,
                    max_tokens=300,
                )
            except GroqError as e:
                response["reasoning_error"] = str(e)
                if GROQ_DEBUG:
                    response["reasoning_diagnostics"] = e.diagnostics

    return jsonify(response)


@app.route("/summarize", methods=["POST"])
def summarize():
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400

    payload = request.get_json(silent=True) or {}
    model_result = payload.get("model_result")
    patient_info = payload.get("patient_info")

    if not model_result:
        return jsonify({"error": "Missing model_result"}), 400
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set on server"}), 503

    input_blob = {
        "model_result": model_result,
        "patient_info": patient_info or {},
    }

    system_msg = (
        "You are a clinical documentation assistant. Summarize the ML model output and "
        "patient intake into a concise, readable, non-diagnostic report. Avoid definitive "
        "diagnoses. Use neutral language and acknowledge uncertainty. If data suggests "
        "urgent red flags (very low SpO2, very high fever, severe shortness of breath), "
        "advise immediate medical care. End with a clear statement that this is not a medical "
        "diagnosis. Keep it under 200 words. Use simple bullet points under headings: "
        "Overview, Key Findings, What This May Suggest, Next Steps, Data Gaps."
    )
    user_msg = "Input data (JSON):\n" + json.dumps(input_blob, ensure_ascii=True)

    try:
        summary = call_groq(
            [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        return jsonify({"summary": summary, "model": GROQ_MODEL})
    except GroqError as e:
        payload = {"error": str(e)}
        if GROQ_DEBUG:
            payload["diagnostics"] = e.diagnostics
        return jsonify(payload), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 502


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
