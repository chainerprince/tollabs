"""
Tests for the Training / Fine-tuning subsystem.
"""

import time
from pathlib import Path
from tests.conftest import register_user, auth_header


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent / "workspaces"


def _setup_researcher(client):
    """Register a researcher and create a dummy dataset in their workspace."""
    resp = register_user(client, email="researcher@test.com", password="pass123", role="researcher")
    headers = auth_header(resp)
    user_id = resp["user"]["id"]

    # Create a dummy CSV dataset in the user's workspace
    workspace = WORKSPACE_ROOT / str(user_id)
    workspace.mkdir(parents=True, exist_ok=True)
    dataset = workspace / "test_data.csv"
    dataset.write_text("close,volume\n1.12,1000\n1.13,1200\n1.11,900\n1.14,1100\n1.15,1300\n")

    return headers, user_id, dataset


def test_list_base_models(client):
    """GET /training/models should return curated models."""
    headers, _, _ = _setup_researcher(client)
    resp = client.get("/training/models", headers=headers)
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 6
    assert any(m["model_id"] == "amazon/chronos-t5-small" for m in models)
    assert all("task" in m for m in models)


def test_list_base_models_filtered(client):
    """GET /training/models?task=sentiment-analysis should filter."""
    headers, _, _ = _setup_researcher(client)
    resp = client.get("/training/models?task=sentiment-analysis", headers=headers)
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 2
    assert all(m["task"] == "sentiment-analysis" for m in models)


def test_search_models(client):
    """GET /training/models/search?q=chronos should find Chronos models."""
    headers, _, _ = _setup_researcher(client)
    resp = client.get("/training/models/search?q=chronos", headers=headers)
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 1
    assert "chronos" in models[0]["model_id"].lower()


def test_download_model(client):
    """POST /training/models/download creates placeholder in workspace."""
    headers, user_id, _ = _setup_researcher(client)
    resp = client.post(
        "/training/models/download",
        json={"model_id": "ProsusAI/finbert"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_id"] == "ProsusAI/finbert"
    assert "config.json" in data["files"]

    # Verify files exist on disk
    model_dir = WORKSPACE_ROOT / str(user_id) / "models" / "ProsusAI_finbert"
    assert model_dir.exists()
    assert (model_dir / "config.json").exists()


def test_submit_job_missing_dataset(client):
    """POST /training/jobs with non-existent dataset should fail."""
    headers, _, _ = _setup_researcher(client)
    resp = client.post(
        "/training/jobs",
        json={
            "job_name": "test-job",
            "base_model": "amazon/chronos-t5-small",
            "dataset_filename": "nonexistent.csv",
        },
        headers=headers,
    )
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower()


def test_submit_and_monitor_job(client):
    """Full E2E: submit job → poll progress → verify completion."""
    headers, user_id, dataset = _setup_researcher(client)

    # Submit
    resp = client.post(
        "/training/jobs",
        json={
            "job_name": "chronos-test-v1",
            "base_model": "amazon/chronos-t5-small",
            "dataset_filename": "test_data.csv",
            "config": {"epochs": 1, "learning_rate": 0.001, "batch_size": 8, "lora_rank": 4},
        },
        headers=headers,
    )
    assert resp.status_code == 200
    job = resp.json()
    assert job["status"] in ("queued", "running")
    job_id = job["id"]

    # List jobs
    resp = client.get("/training/jobs", headers=headers)
    assert resp.status_code == 200
    jobs = resp.json()
    assert any(j["id"] == job_id for j in jobs)

    # Poll until complete (mock takes ~15s for 1 epoch)
    for _ in range(40):
        time.sleep(0.5)
        resp = client.get(f"/training/jobs/{job_id}", headers=headers)
        assert resp.status_code == 200
        job = resp.json()
        if job["status"] in ("completed", "failed"):
            break

    assert job["status"] == "completed"
    assert job["progress"] == 100.0
    assert job["model_artifact_path"] is not None
    assert "loss_history" in job["metrics"]
    assert len(job["metrics"]["loss_history"]) > 0

    # Verify artifact exists on disk
    artifact_path = WORKSPACE_ROOT / str(user_id) / job["model_artifact_path"]
    assert artifact_path.exists()


def test_cancel_job(client):
    """Cancel a running job."""
    headers, _, _ = _setup_researcher(client)

    # Submit
    resp = client.post(
        "/training/jobs",
        json={
            "job_name": "cancel-test",
            "base_model": "amazon/chronos-t5-small",
            "dataset_filename": "test_data.csv",
            "config": {"epochs": 5},
        },
        headers=headers,
    )
    assert resp.status_code == 200
    job_id = resp.json()["id"]

    time.sleep(3)  # Let it start running

    # Cancel
    resp = client.delete(f"/training/jobs/{job_id}", headers=headers)
    assert resp.status_code == 200
    # Job should be cancelled or possibly already completed (timing-dependent)
    assert resp.json()["status"] in ("cancelled", "completed")


def test_list_artifacts(client):
    """GET /training/artifacts — empty by default, populated after training."""
    headers, _, _ = _setup_researcher(client)
    resp = client.get("/training/artifacts", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_unauthenticated_access(client):
    """Training endpoints should require auth."""
    resp = client.get("/training/models")
    assert resp.status_code == 401 or resp.status_code == 403

    resp = client.get("/training/jobs")
    assert resp.status_code == 401 or resp.status_code == 403
