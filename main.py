import pandas as pd
import numpy as np
from featureExtraction import InstantiateAttributes
from train import trainModel

import os
if not os.path.exists('patient_diagnosis.csv'):
    print("Warning: patient_diagnosis.csv not found. Please download it from the ICBHI 2017 Challenge and place it in this directory.")
    print("For now, creating a dummy patient_diagnosis.csv for testing...")
    # Create dummy diagnosis to allow code to run
    # patients are 101 to 226
    patients = np.arange(101, 227)
    diseases = np.random.choice(['COPD', 'Healthy', 'URTI', 'Bronchiectasis', 'Pneumonia', 'Bronchiolitis', 'Asthma', 'LRTI'], size=len(patients))
    df = pd.DataFrame({'patient_id': patients, 'disease': diseases})
    df.to_csv('patient_diagnosis.csv', index=False)

print("Loading patient diagnosis data...")
import featureExtraction
featureExtraction.data = pd.read_csv('patient_diagnosis.csv')

print("Extracting features (this may take a while)...")
X, y = InstantiateAttributes('dataset/ICBHI_final_dataset/')
print(f"Extracted {len(X)} samples.")
from collections import Counter
class_counts = Counter(y)
print("Class distribution:")
for label, count in class_counts.items():
    print(f"  {label}: {count}")

# Ensure we have data
if len(X) > 0:
    print("Training model...")
    # Split train/test
    from sklearn.model_selection import train_test_split
    # One-hot encode y
    from sklearn.preprocessing import LabelEncoder
    from keras.utils import to_categorical
    
    le = LabelEncoder()
    y_labels = le.fit_transform(y)
    y_encoded = to_categorical(y_labels)
    
    import train
    train.x_train, train.x_test, train.y_train, train.y_test = train_test_split(
        X,
        y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=y_labels
    )
    train.num_batch_size = 32
    train.num_epochs = 50

    healthy_class_index = None
    if 'Healthy' in le.classes_:
        healthy_class_index = int(np.where(le.classes_ == 'Healthy')[0][0])
        print(f"Healthy class index: {healthy_class_index}")

    train.trainModel(X, y_encoded, healthy_class_index=healthy_class_index, healthy_class_multiplier=1.5)
else:
    print("No valid audio files found for extraction.")
