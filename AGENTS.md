# AI Assistant & Developer Guidelines: RespiNet (Respiratory Atlas)

## CRITICAL: Mandatory Documentation Synchronization Rule

Whenever you propose, implement, or refactor ANY code in this repository:
1. **Target Document to Update:**
   [`documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/documentation/PROJECT_RESEARCH_CHRONICLE_AND_ARCHITECTURE_EVOLUTION.md)
2. **When to Update:**
   - Any architectural changes in [`backend/model.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/model.py).
   - Any preprocessing, filtering, or feature extraction changes in [`backend/preprocessing.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/preprocessing.py) or [`backend/featureExtraction.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/featureExtraction.py).
   - Any loss functions, optimizers, learning rate schedules, or hyperparameter adjustments in [`backend/train.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/train.py).
   - Any dataset shifts, new download scripts, manifest transformations, or patient grouping logic in [`backend/download_dataset.sh`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/download_dataset.sh) or [`backend/dataset_provenance.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/dataset_provenance.py).
   - Any new training runs, validation results, calibration scores, or benchmark evaluations.
   - Any backend server endpoint modifications ([`backend/server.py`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/backend/server.py)) or frontend workflow additions ([`frontend/`](file:///run/media/qitiya/SSD2/repos/Respiratory-diseases-recognition-through-respiratory-sound-with-the-help-of-deep-neural-network/frontend)).
3. **Requirement:**
   You must keep the master chronicle synchronized so that downstream models generating academic project reports or papers always have complete, accurate, and up-to-date ground truth.
