"""Tests for subscription endpoints."""

from tests.conftest import register_user, auth_header


def _setup_live_model(client):
    """Helper: create a researcher with a live model, return (model_id, researcher_headers)."""
    researcher = register_user(client, "researcher@test.com", "pass", "researcher")
    headers = auth_header(researcher)
    resp = client.post("/researcher/models", json={
        "name": "Sub Model",
        "asset_class": "forex",
    }, headers=headers)
    model_id = resp.json()["id"]
    client.post(f"/researcher/deploy/{model_id}", headers=headers)
    return model_id, headers


def test_subscribe_to_model(client):
    model_id, _ = _setup_live_model(client)
    subscriber = register_user(client, "sub@test.com", "pass", "subscriber")
    headers = auth_header(subscriber)

    resp = client.post(f"/subscribe/{model_id}", json={"profit_share_pct": 0.20}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Subscribed successfully"
    assert data["subscription"]["model_id"] == model_id
    assert data["checkout_session"]["payment_status"] == "paid"


def test_subscribe_duplicate_fails(client):
    model_id, _ = _setup_live_model(client)
    subscriber = register_user(client, "sub@test.com", "pass", "subscriber")
    headers = auth_header(subscriber)

    client.post(f"/subscribe/{model_id}", json={}, headers=headers)
    resp = client.post(f"/subscribe/{model_id}", json={}, headers=headers)
    assert resp.status_code == 400
    assert "Already subscribed" in resp.json()["detail"]


def test_subscribe_to_draft_fails(client):
    researcher = register_user(client, "researcher@test.com", "pass", "researcher")
    resp = client.post("/researcher/models", json={
        "name": "Draft Model",
        "asset_class": "stock",
    }, headers=auth_header(researcher))
    model_id = resp.json()["id"]

    subscriber = register_user(client, "sub@test.com", "pass", "subscriber")
    resp = client.post(f"/subscribe/{model_id}", json={}, headers=auth_header(subscriber))
    assert resp.status_code == 400
    assert "not live" in resp.json()["detail"]


def test_my_subscriptions(client):
    model_id, _ = _setup_live_model(client)
    subscriber = register_user(client, "sub@test.com", "pass", "subscriber")
    headers = auth_header(subscriber)

    client.post(f"/subscribe/{model_id}", json={}, headers=headers)
    resp = client.get("/subscriptions/me", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["model_name"] == "Sub Model"


def test_cancel_subscription(client):
    model_id, _ = _setup_live_model(client)
    subscriber = register_user(client, "sub@test.com", "pass", "subscriber")
    headers = auth_header(subscriber)

    resp = client.post(f"/subscribe/{model_id}", json={}, headers=headers)
    sub_id = resp.json()["subscription"]["id"]

    resp = client.delete(f"/subscriptions/{sub_id}", headers=headers)
    assert resp.status_code == 200

    # Verify inactive
    resp = client.get("/subscriptions/me", headers=headers)
    assert resp.json()[0]["is_active"] is False
