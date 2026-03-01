"""Tests for backtest endpoints."""


def test_run_backtest_default_strategy(client):
    resp = client.post("/backtest/run", json={
        "asset": "EUR/USD",
        "periods": 300,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "metrics" in data
    assert data["metrics"]["num_trades"] >= 0
    assert "sharpe_ratio" in data["metrics"]


def test_run_backtest_custom_strategy(client):
    code = """
# Simple: buy at index 50, sell at index 100
trades.append({
    "pnl": prices[100]["close"] - prices[50]["close"],
    "entry_price": prices[50]["close"],
    "exit_price": prices[100]["close"],
    "type": "long",
})
"""
    resp = client.post("/backtest/run", json={
        "strategy_code": code,
        "asset": "AAPL",
        "periods": 200,
    })
    assert resp.status_code == 200
    assert resp.json()["metrics"]["num_trades"] == 1


def test_get_backtest_results(client):
    resp = client.post("/backtest/run", json={"asset": "EUR/USD", "periods": 100})
    job_id = resp.json()["job_id"]

    resp = client.get(f"/backtest/results/{job_id}")
    assert resp.status_code == 200
    assert resp.json()["job_id"] == job_id


def test_backtest_not_found(client):
    resp = client.get("/backtest/results/nonexistent")
    assert resp.status_code == 404


def test_list_backtest_jobs(client):
    client.post("/backtest/run", json={"asset": "EUR/USD"})
    client.post("/backtest/run", json={"asset": "GBP/USD"})

    resp = client.get("/backtest/jobs")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2
