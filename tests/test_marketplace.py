"""Tests for marketplace endpoints."""

from tests.conftest import register_user, auth_header


def test_marketplace_empty(client):
    resp = client.get("/marketplace/models")
    assert resp.status_code == 200
    assert resp.json() == []


def test_marketplace_with_live_model(client):
    # Create researcher + model + deploy
    researcher = register_user(client, "researcher@test.com", "pass", "researcher")
    headers = auth_header(researcher)

    # Create model
    resp = client.post("/researcher/models", json={
        "name": "Test Model",
        "asset_class": "forex",
        "description": "A test model",
        "strategy_code": "",
    }, headers=headers)
    assert resp.status_code == 201
    model_id = resp.json()["id"]

    # Not visible yet (draft)
    resp = client.get("/marketplace/models")
    assert len(resp.json()) == 0

    # Deploy
    resp = client.post(f"/researcher/deploy/{model_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "live"

    # Now visible
    resp = client.get("/marketplace/models")
    assert len(resp.json()) == 1
    assert resp.json()[0]["name"] == "Test Model"


def test_marketplace_model_detail(client):
    researcher = register_user(client, "r@test.com", "pass", "researcher")
    headers = auth_header(researcher)

    resp = client.post("/researcher/models", json={
        "name": "Detail Model",
        "asset_class": "stock",
    }, headers=headers)
    model_id = resp.json()["id"]
    client.post(f"/researcher/deploy/{model_id}", headers=headers)

    resp = client.get(f"/marketplace/models/{model_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Detail Model"
    assert data["asset_class"] == "stock"
    assert "trade_history" in data


def test_marketplace_model_not_found(client):
    resp = client.get("/marketplace/models/9999")
    assert resp.status_code == 404
