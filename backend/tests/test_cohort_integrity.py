import numpy as np
import pytest

from dataset_provenance import build_folder_dataset_audit
from evaluate import evaluate_by_group
from featureExtraction import AudioRecord, build_manifest_from_folders, deduplicate_records
from main import portable_path, source_name


def _folder_dataset(root, files):
    for relative, payload in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    return root


def test_deduplicate_keeps_one_copy_of_identical_audio(tmp_path):
    root = _folder_dataset(tmp_path, {
        "healthy/P15Healthy61S.wav": b"same-bytes",
        "healthy/P16Healthy18S.wav": b"same-bytes",
        "healthy/P17Healthy01S.wav": b"other-bytes",
    })
    records = build_manifest_from_folders(root, source="kaggle_asthma_v2")
    kept, removed = deduplicate_records(records)

    assert [record.path.name for record in kept] == ["P15Healthy61S.wav", "P17Healthy01S.wav"]
    assert len(removed) == 1
    assert removed[0]["path"].endswith("P16Healthy18S.wav")
    assert removed[0]["duplicate_of"].endswith("P15Healthy61S.wav")
    assert all(record.source == "kaggle_asthma_v2" for record in kept)


def test_identical_audio_with_conflicting_labels_stops_the_pipeline(tmp_path):
    root = _folder_dataset(tmp_path, {
        "copd/P1COPDMc_1.wav": b"same-bytes",
        "asthma/P1AsthmaIE_1.wav": b"same-bytes",
    })
    with pytest.raises(ValueError, match="different labels"):
        deduplicate_records(build_manifest_from_folders(root))


def test_folder_audit_hashes_content_and_counts_each_source(tmp_path):
    root = _folder_dataset(tmp_path, {"copd/P1COPDMc_1.wav": b"a", "healthy/P2Healthy1S.wav": b"b"})
    records = build_manifest_from_folders(root, source="kaggle_asthma_v2")
    audit = build_folder_dataset_audit(records, [root])
    assert audit["recordings"] == 2
    assert audit["per_source"]["kaggle_asthma_v2"]["recording_label_counts"] == {"copd": 1, "healthy": 1}
    assert len(audit["audio_inventory_sha256"]) == 64

    (root / "copd" / "P1COPDMc_1.wav").write_bytes(b"changed")
    assert build_folder_dataset_audit(records, [root])["audio_inventory_sha256"] != audit[
        "audio_inventory_sha256"
    ]


def test_source_names_and_portable_paths():
    assert source_name("dataset/ICBHI_as_folders") == "icbhi"
    assert source_name("dataset/Asthma_Detection_V2/Asthma Detection Dataset Version 2") == (
        "kaggle_asthma_v2"
    )
    assert portable_path("dataset/x/y.wav") == "dataset/x/y.wav"
    assert portable_path("/elsewhere/y.wav") == "/elsewhere/y.wav"


def test_metrics_are_reported_separately_per_source():
    y_true = np.array([0, 1, 0, 1])
    probabilities = np.array([[0.9, 0.1], [0.2, 0.8], [0.6, 0.4], [0.7, 0.3]])
    results = evaluate_by_group(
        y_true, probabilities, np.array([1, 2, 3, 4]), np.array(["icbhi", "icbhi", "kaggle", "kaggle"]),
        ["copd", "healthy"],
    )
    assert results["icbhi"]["recording_level"]["accuracy"] == 1.0
    assert results["kaggle"]["recording_level"]["accuracy"] == 0.5
    assert results["kaggle"]["patients"] == 2


def test_audio_record_source_defaults_for_existing_callers(tmp_path):
    assert AudioRecord(tmp_path / "a.wav", 1, "copd").source == "primary"


def _overlap_csv(path, rows):
    import csv

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["clip", "clip_class", "best_ncc", "is_overlap"])
        writer.writeheader()
        writer.writerows(rows)
    return path


def test_kaggle_copies_of_icbhi_are_excluded_but_icbhi_is_kept(tmp_path):
    from main import exclude_cross_dataset_overlap

    records = [
        AudioRecord(tmp_path / "copd" / "P1COPDMc_1.wav", 1, "copd", "kaggle_asthma_v2"),
        AudioRecord(tmp_path / "asthma" / "P1AsthmaIE_1.wav", 2, "asthma", "kaggle_asthma_v2"),
        AudioRecord(tmp_path / "copd" / "104_1b1_Al_sc_Meditron.wav", 104, "copd", "icbhi"),
    ]
    evidence = _overlap_csv(tmp_path / "overlap.csv", [
        {"clip": "COPD/P1COPDMc_1.wav", "clip_class": "copd", "best_ncc": 0.999, "is_overlap": True},
        {"clip": "asthma/P1AsthmaIE_1.wav", "clip_class": "asthma", "best_ncc": 0.2, "is_overlap": False},
    ])
    kept, report = exclude_cross_dataset_overlap(records, evidence)

    assert [record.path.name for record in kept] == ["P1AsthmaIE_1.wav", "104_1b1_Al_sc_Meditron.wav"]
    assert report["removed_recordings"] == 1
    assert report["removed_by_class"] == {"copd": 1}
    assert len(report["evidence_sha256"]) == 64


def test_overlap_exclusion_fails_closed_on_missing_or_stale_evidence(tmp_path):
    from main import exclude_cross_dataset_overlap

    records = [AudioRecord(tmp_path / "copd" / "P9COPDMc_9.wav", 9, "copd", "kaggle_asthma_v2")]
    with pytest.raises(FileNotFoundError, match="overlap evidence"):
        exclude_cross_dataset_overlap(records, tmp_path / "missing.csv")

    stale = _overlap_csv(tmp_path / "stale.csv", [
        {"clip": "copd/P1COPDMc_1.wav", "clip_class": "copd", "best_ncc": 0.999, "is_overlap": True},
    ])
    with pytest.raises(ValueError, match="does not cover 1 Kaggle clips"):
        exclude_cross_dataset_overlap(records, stale)
