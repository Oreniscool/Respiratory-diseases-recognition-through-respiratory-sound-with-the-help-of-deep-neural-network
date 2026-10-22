"""YAMNet embeddings and the RespiNet + YAMNet late fusion, shared by training, experiments and serving.

YAMNet (Google, trained on AudioSet) turns 16 kHz mono audio into one 1,024-d embedding per
0.96 s frame. A recording is summarised by the mean and standard deviation of its frame
embeddings (2,048 values), and a standardized, class-balanced logistic regression maps that to
class probabilities. The fitted regression is exported as a one-layer Keras model with the
standardization folded into its weights, so no pickled estimator is ever loaded.

Fusion averages the two temperature-calibrated probability vectors with fixed weights; the
deployed artifact then applies one more validation-fitted temperature to the fused vector.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from calibration import apply_temperature

YAMNET_SAMPLE_RATE = 16_000
EMBEDDING_DIM = 2 * 1024
FUSION_TYPE = "respinet+yamnet_logistic"


def load_yamnet(directory: str | Path):
    import tensorflow as tf

    return tf.saved_model.load(str(directory))


def load_yamnet_audio(path: str | Path) -> np.ndarray:
    """Decode straight to 16 kHz mono, without the RespiNet band-pass (YAMNet expects natural audio)."""
    import librosa

    waveform, _ = librosa.load(str(path), sr=YAMNET_SAMPLE_RATE, mono=True)
    return waveform.astype(np.float32, copy=False)


def yamnet_embedding(model, waveform: np.ndarray) -> np.ndarray:
    import tensorflow as tf

    _, frames, _ = model(tf.constant(waveform, dtype=tf.float32))
    frames = frames.numpy()
    return np.concatenate([frames.mean(axis=0), frames.std(axis=0)]).astype(np.float32)


# --------------------------------------------------------------------------- lung-sound gate

# YAMNet AudioSet classes whose presence means the upload is not a chest recording, with the
# frame-averaged score above which the service refuses it. Thresholds sit well above the highest
# score seen on any of the 1,152 development recordings (speech 0.36, music 0.42, tones 0.098).
# A pure tone is heard as "Dial tone"/"Telephone"/"Alarm" as often as "Sine wave", hence the list.
# Two cues are not taken from YAMNet: quiet auscultation often scores ~1.0 on "Silence", so
# silence is detected by level (quietest development recording: −52 dBFS RMS); and YAMNet scores
# white noise no higher than some real recordings, so broadband noise is detected by spectral
# flatness (development recordings ≤ 0.018, white noise ≈ 0.56).
GATE_CLASSES = {
    "speech": ((0, 1, 2, 3, 4, 5, 65), 0.5),
    "music": ((132, 133), 0.55),
    "a tone or alarm": ((382, 383, 384, 385, 386, 387, 388, 389, 390, 392, 393, 396, 475, 495), 0.3),
}
SILENCE_DBFS = -70.0
MAX_SPECTRAL_FLATNESS = 0.2


def lung_sound_gate(model, waveform: np.ndarray) -> tuple[bool, dict[str, float]]:
    """(passes, scores): False when the recording is silent, broadband noise, or YAMNet hears
    speech, music or tones."""
    import librosa
    import tensorflow as tf

    level = float(20 * np.log10(np.sqrt(np.mean(np.square(waveform, dtype=np.float64))) + 1e-12))
    scores, _, _ = model(tf.constant(waveform, dtype=tf.float32))
    frame_mean = scores.numpy().mean(axis=0)
    found = {name: float(frame_mean[list(indices)].max()) for name, (indices, _) in GATE_CLASSES.items()}
    found["level_dbfs"] = level
    found["spectral_flatness"] = float(
        np.median(librosa.feature.spectral_flatness(y=waveform, n_fft=1024, hop_length=512))
    )
    rejected = (
        level < SILENCE_DBFS
        or found["spectral_flatness"] > MAX_SPECTRAL_FLATNESS
        or any(found[name] > threshold for name, (_, threshold) in GATE_CLASSES.items())
    )
    return not rejected, found


def gate_reason(scores: dict[str, float]) -> str:
    if scores["level_dbfs"] < SILENCE_DBFS:
        return f"the recording is silent ({scores['level_dbfs']:.0f} dBFS)"
    if scores["spectral_flatness"] > MAX_SPECTRAL_FLATNESS:
        return f"it is broadband noise (spectral flatness {scores['spectral_flatness']:.2f})"
    name = max(GATE_CLASSES, key=lambda key: scores[key] - GATE_CLASSES[key][1])
    return f"it sounds like {name} (score {scores[name]:.2f}), not a chest recording"


# --------------------------------------------------------------------------- extractor registry

OPERA_SAMPLE_RATE = 16_000
OPERA_MIN_SECONDS = 8
OPERA_MODELS = {  # name -> (checkpoint file, Cola encoder, embedding size)
    "opera_ct": ("encoder-operaCT.ckpt", "htsat", 768),
    "opera_ce": ("encoder-operaCE.ckpt", "efficientnet", 1280),
}


def load_yamnet_bandpass_audio(path: str | Path) -> np.ndarray:
    """16 kHz audio with RespiNet's 100–2,000 Hz band-pass, removing out-of-band device cues."""
    from preprocessing import apply_bandpass_filter

    return apply_bandpass_filter(load_yamnet_audio(path), YAMNET_SAMPLE_RATE, 100.0, 2000.0)


def opera_input(waveform: np.ndarray) -> np.ndarray:
    """OPERA's whole-recording input: trim silence, repeat-pad to 8 s, 64-band log-mel scaled to [0, 1].

    Mirrors ``get_entire_signal_librosa(..., spectrogram=True, pad=True)`` and
    ``pre_process_audio_mel_t(f_max=8000)`` from the OPERA repository.
    """
    import random

    import librosa

    frame = OPERA_SAMPLE_RATE // 10
    trimmed, _ = librosa.effects.trim(waveform, frame_length=frame, hop_length=frame // 2)
    target = OPERA_MIN_SECONDS * OPERA_SAMPLE_RATE
    if len(trimmed) < target:
        repeated = trimmed
        while len(repeated) < target - len(trimmed):
            repeated = np.concatenate([repeated, repeated])
        left = target - len(trimmed)
        padded = np.zeros(target, dtype=np.float32)
        if random.Random(7456).random() < 0.5:  # OPERA seeds 7456 before choosing the side
            padded[left:], padded[:left] = trimmed, repeated[len(repeated) - left:]
        else:
            padded[: len(trimmed)], padded[len(trimmed):] = trimmed, repeated[:left]
        trimmed = padded
    mel = librosa.feature.melspectrogram(
        y=trimmed, sr=OPERA_SAMPLE_RATE, n_mels=64, fmin=50, fmax=8000, n_fft=1024, hop_length=512
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)
    if mel_db.max() != mel_db.min():
        mel_db = (mel_db - mel_db.min()) / (mel_db.max() - mel_db.min())
    return mel_db.T.astype(np.float32)


def load_opera(directory: str | Path, name: str):
    """Load a frozen OPERA encoder; refuses checkpoints whose encoder weights do not all load."""
    import torch

    from third_party.opera.models_cola import Cola

    filename, encoder, _ = OPERA_MODELS[name]
    checkpoint = torch.load(Path(directory) / filename, map_location="cpu", weights_only=True)
    model = Cola(encoder=encoder).eval()
    result = model.load_state_dict(checkpoint["state_dict"], strict=False)
    missing = [key for key in result.missing_keys if key.startswith("encoder.")]
    if missing:
        raise RuntimeError(f"OPERA checkpoint {filename} lacks encoder weights: {missing[:3]}")
    return model


def opera_embedding(model, name: str, waveform: np.ndarray) -> np.ndarray:
    import torch

    with torch.no_grad():
        features = model.extract_feature(torch.tensor(opera_input(waveform)[None]), OPERA_MODELS[name][2])
    return features.numpy()[0].astype(np.float32)


class Extractor:
    """Recording → fixed-size embedding for one frozen pretrained model."""

    def __init__(self, name: str, model_dir: str | Path):
        if name not in EXTRACTORS:
            raise ValueError(f"Unknown extractor {name!r}; choose from {sorted(EXTRACTORS)}")
        self.name, self.model_dir, self._model = name, Path(model_dir), None

    def _load(self):
        if self._model is None:
            if self.name.startswith("yamnet"):
                self._model = load_yamnet(self.model_dir)
            elif self.name.startswith("opera"):
                self._model = load_opera(self.model_dir, self.name)
        return self._model

    def embed(self, path: str | Path) -> np.ndarray:
        model = self._load()
        if self.name == "yamnet":
            return yamnet_embedding(model, load_yamnet_audio(path))
        if self.name == "yamnet_bandpass":
            return yamnet_embedding(model, load_yamnet_bandpass_audio(path))
        return opera_embedding(model, self.name, load_yamnet_audio(path))


# name -> default model directory (relative to backend/)
EXTRACTORS = {
    "yamnet": "artifacts/pretrained/yamnet",
    "yamnet_bandpass": "artifacts/pretrained/yamnet",
    "opera_ct": "artifacts/pretrained/opera",
    "opera_ce": "artifacts/pretrained/opera",
}


def fit_logistic_head(x_fit, y_fit, x_validation, y_validation):
    """Standardized, class-balanced logistic regression; C chosen by validation log loss."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    best = None
    for c in (0.001, 0.01, 0.1, 1.0):
        model = make_pipeline(
            StandardScaler(), LogisticRegression(C=c, class_weight="balanced", max_iter=5000)
        ).fit(x_fit, y_fit)
        loss = log_loss(y_validation, model.predict_proba(x_validation), labels=model.classes_)
        if best is None or loss < best[0]:
            best = (loss, c, model)
    return best[2], {"C": best[1]}


def export_logistic_head(pipeline, class_names: list[str], path: str | Path):
    """Save a fitted scaler + logistic-regression pipeline as an equivalent Dense-softmax model."""
    from tensorflow.keras import Input, Model
    from tensorflow.keras.layers import Dense

    scaler, regression = pipeline[0], pipeline[-1]
    order = [list(regression.classes_).index(name) for name in class_names]
    coef = regression.coef_[order] / scaler.scale_  # (classes, features)
    intercept = regression.intercept_[order] - coef @ scaler.mean_
    inputs = Input(shape=(coef.shape[1],), name="yamnet_embedding")
    outputs = Dense(len(class_names), activation="softmax", name="yamnet_logistic")(inputs)
    head = Model(inputs, outputs)
    head.get_layer("yamnet_logistic").set_weights([coef.T.astype(np.float32), intercept.astype(np.float32)])
    head.save(path)
    return head


def fuse_probabilities(
    respinet: np.ndarray, yamnet: np.ndarray, fusion: dict[str, object]
) -> np.ndarray:
    """Weighted mean of the two calibrated members (before the final fused temperature)."""
    weights = fusion["weights"]
    combined = (
        float(weights[0]) * apply_temperature(np.atleast_2d(respinet), float(fusion["respinet_temperature"]))
        + float(weights[1]) * apply_temperature(np.atleast_2d(yamnet), float(fusion["yamnet_temperature"]))
    )
    return combined / combined.sum(axis=1, keepdims=True)


def directory_sha256(directory: str | Path) -> str:
    """One hash over every file's relative path and content, so any change to a SavedModel shows."""
    directory = Path(directory)
    digest = hashlib.sha256()
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        digest.update(path.relative_to(directory).as_posix().encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).hexdigest().encode("ascii") + b"\n")
    return digest.hexdigest()
