import numpy as np
import librosa
import os
from Augmentation import add_noise, shift, stretch

N_MFCC = 40
MAX_LEN = 200
USE_DELTAS = True


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

def InstantiateAttributes(dir_):

    """

    Extract feature from the Sound data. We extracted Mel-frequency cepstral coefficients( spectral

    features ), from the audio data. Augmentation of sound data by adding Noise, streaching and shifting

    is also implemented here. 40 features are extracted from each audio data and used to train the model.

    Args:

        dir_: Input directory to the Sound input file.

    Returns:

        X_: Array of features extracted from the sound file.

        y_: Array of target Labels.

    """

    X_ = []

    y_ = []

    COPD = []

    copd_count = 0

    for soundDir in (os.listdir(dir_)):

        if soundDir[-3:] == 'wav' and soundDir[:3] != '103' and soundDir[:3] != '108' and soundDir[:3] != '115':

            # data_x, sampling_rate = librosa.load(dir_+soundDir,res_type='kaiser_fast')

            # mfccs = np.mean(librosa.feature.mfcc(y=data_x, sr=sampling_rate, n_mfcc=40).T,axis=0)

            # X_.append(mfccs)

            # y_.append(list(data[data['patient_id']==int(soundDir[:3])]['disease'])[0])

            p = list(data[data['patient_id'] == int(soundDir[:3])]['disease'])[0]

            if (p == 'COPD'):

                if (soundDir[:3] in COPD) and copd_count < 2:

                    data_x, sampling_rate = librosa.load(dir_ + soundDir, res_type='kaiser_fast')

                    mfccs = _extract_features(data_x, sampling_rate)

                    COPD.append(soundDir[:3])

                    copd_count += 1

                    X_.append(mfccs)

                    y_.append(list(data[data['patient_id'] == int(soundDir[:3])]['disease'])[0])

                if (soundDir[:3] not in COPD):

                    data_x, sampling_rate = librosa.load(dir_ + soundDir, res_type='kaiser_fast')

                    mfccs = _extract_features(data_x, sampling_rate)

                    COPD.append(soundDir[:3])

                    copd_count = 0

                    X_.append(mfccs)

                    y_.append(list(data[data['patient_id'] == int(soundDir[:3])]['disease'])[0])

            if (p != 'COPD'):

                data_x, sampling_rate = librosa.load(dir_ + soundDir, res_type='kaiser_fast')

                mfccs = _extract_features(data_x, sampling_rate)

                X_.append(mfccs)

                y_.append(list(data[data['patient_id'] == int(soundDir[:3])]['disease'])[0])

                data_noise = add_noise(data_x, 0.005)

                mfccs_noise = _extract_features(data_noise, sampling_rate)

                X_.append(mfccs_noise)

                y_.append(p)

                data_shift = shift(data_x, 1600)

                mfccs_shift = _extract_features(data_shift, sampling_rate)

                X_.append(mfccs_shift)

                y_.append(p)

                data_stretch = stretch(data_x, 1.2)

                mfccs_stretch = _extract_features(data_stretch, sampling_rate)

                X_.append(mfccs_stretch)

                y_.append(p)

                data_stretch_2 = stretch(data_x, 0.8)

                mfccs_stretch_2 = _extract_features(data_stretch_2, sampling_rate)

                X_.append(mfccs_stretch_2)

                y_.append(p)

    X_ = np.array(X_)

    y_ = np.array(y_)

    return X_, y_