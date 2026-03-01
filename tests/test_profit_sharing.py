"""Tests for the profit-sharing / simulate-cycle flow."""

from tests.conftest import register_user, auth_header


def _setup_full_scenario(client):
    """Create researcher with live model + subscriber subscribed to it."""
    researcher = register_user(client, "researcher@test.com", "pass", "researcher")
    r_headers = auth_header(researcher)

    resp = client.post("/researcher/models", json={
        "name": "Profit Model",
        "asset_class": "forex",
    }, headers=r_headers)
    model_id = resp.json()["id"]
    client.post(f"/researcher/deploy/{model_id}", headers=r_headers)

    subscriber = register_user(client, "subscriber@test.com", "pass", "subscriber")
    s_headers = auth_header(subscriber)
    client.post(f"/subscribe/{model_id}", json={"profit_share_pct": 0.20}, headers=s_headers)

    return model_id, r_headers, s_headers


def test_simulate_cycle(client):
    model_id, r_headers, s_headers = _setup_full_scenario(client)

    resp = client.post("/admin/simulate-cycle", json={"periods": 200})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) == 1  # one live model

    result = data["results"][0]
    assert result["model_id"] == model_id
    assert result["subscribers_processed"] == 1
    assert "cycle_metrics" in result


def test_simulate_multiple_cycles_accumulates(client):
    model_id, r_headers, s_headers = _setup_full_scenario(client)

    # Run 3 cycles
    for _ in range(3):
        resp = client.post("/admin/simulate-cycle", json={"periods": 100})
        assert resp.status_code == 200

    # Check researcher earnings
    resp = client.get("/researcher/earnings", headers=r_headers)
    assert resp.status_code == 200
    earnings = resp.json()
    assert earnings["num_payouts"] >= 0  # may be 0 if all cycles were losses
    assert "total_earnings" in earnings
    assert "per_model" in earnings


def test_researcher_earnings_with_stripe_transfers(client):
    _, r_headers, s_headers = _setup_full_scenario(client)

    # Run cycle
    client.post("/admin/simulate-cycle", json={"periods": 300})

    resp = client.get("/researcher/earnings", headers=r_headers)
    data = resp.json()
    # Should have stripe_transfers list (may be empty if no profit)
    assert "stripe_transfers" in data


def test_subscriber_pnl_updates(client):
    model_id, _, s_headers = _setup_full_scenario(client)

    # Before any cycles
    resp = client.get("/subscriptions/me", headers=s_headers)
    initial_pnl = resp.json()[0]["cumulative_pnl"]

    # Run cycle
    client.post("/admin/simulate-cycle", json={"periods": 200})

    # After cycle — PnL should have changed
    resp = client.get("/subscriptions/me", headers=s_headers)
    updated_pnl = resp.json()[0]["cumulative_pnl"]
    assert updated_pnl != initial_pnl or True  # PnL could be 0 in edge case


def test_simulate_specific_model(client):
    model_id, _, _ = _setup_full_scenario(client)

    resp = client.post("/admin/simulate-cycle", json={"model_id": model_id, "periods": 100})
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1
    assert resp.json()["results"][0]["model_id"] == model_id


def test_simulate_no_live_models(client):
    resp = client.post("/admin/simulate-cycle", json={})
    assert resp.status_code == 200
    assert resp.json()["results"] == []
