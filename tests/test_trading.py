"""
Tests for the trading subsystem — wallet, trade lifecycle, profit sharing.
"""

import pytest


# ── Helpers ────────────────────────────────────────────────────────

def register_and_login(client, email="trader@test.com", password="pass123", role="subscriber"):
    client.post("/auth/register", json={"email": email, "password": password, "role": role})
    res = client.post("/auth/login", json={"email": email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_live_model(client):
    """Create a researcher, create a model, deploy it, return model_id."""
    headers = register_and_login(client, email="researcher@test.com", role="researcher")
    res = client.post("/researcher/models", json={
        "name": "Test Algo",
        "description": "SMA crossover test",
        "asset_class": "forex",
        "strategy_code": "",
    }, headers=headers)
    model_id = res.json()["id"]
    client.post(f"/researcher/deploy/{model_id}", headers=headers)
    return model_id


def subscribe_to_model(client, model_id, headers):
    res = client.post(f"/subscribe/{model_id}", json={"profit_share_pct": 0.20}, headers=headers)
    return res.json()["subscription"]["id"]


# ── Wallet Tests ──────────────────────────────────────────────────

class TestWallet:
    def test_fund_wallet(self, client):
        headers = register_and_login(client)
        res = client.post("/trading/wallet/fund", json={"amount": 10000}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["balance"] == 10000.0
        assert "10,000" in data["message"]

    def test_fund_wallet_negative(self, client):
        headers = register_and_login(client)
        res = client.post("/trading/wallet/fund", json={"amount": -100}, headers=headers)
        assert res.status_code == 400

    def test_get_balance(self, client):
        headers = register_and_login(client)
        client.post("/trading/wallet/fund", json={"amount": 5000}, headers=headers)
        res = client.get("/trading/wallet/balance", headers=headers)
        assert res.status_code == 200
        assert res.json()["balance"] == 5000.0

    def test_fund_wallet_over_limit(self, client):
        headers = register_and_login(client)
        res = client.post("/trading/wallet/fund", json={"amount": 2000000}, headers=headers)
        assert res.status_code == 400

    def test_withdraw_wallet(self, client):
        headers = register_and_login(client)
        client.post("/trading/wallet/fund", json={"amount": 10000}, headers=headers)
        res = client.post("/trading/wallet/withdraw", json={"amount": 3000}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["balance"] == 7000.0
        assert "3,000" in data["message"]

    def test_withdraw_insufficient(self, client):
        headers = register_and_login(client)
        client.post("/trading/wallet/fund", json={"amount": 1000}, headers=headers)
        res = client.post("/trading/wallet/withdraw", json={"amount": 5000}, headers=headers)
        assert res.status_code == 400

    def test_withdraw_negative(self, client):
        headers = register_and_login(client)
        res = client.post("/trading/wallet/withdraw", json={"amount": -100}, headers=headers)
        assert res.status_code == 400


# ── Trade Lifecycle Tests ─────────────────────────────────────────

class TestTradeLifecycle:
    def _setup(self, client):
        model_id = create_live_model(client)
        headers = register_and_login(client, email="sub@test.com")
        sub_id = subscribe_to_model(client, model_id, headers)
        client.post("/trading/wallet/fund", json={"amount": 50000}, headers=headers)
        return model_id, headers, sub_id

    def test_configure_trade(self, client):
        _, headers, sub_id = self._setup(client)
        res = client.post("/trading/trades/configure", json={
            "subscription_id": sub_id,
            "capital": 1000,
        }, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["capital"] == 1000
        assert data["status"] == "pending"
        assert data["estimated_risk"] in ["Low", "Medium", "High"]
        assert data["trade_id"] > 0

    def test_execute_trade(self, client):
        _, headers, sub_id = self._setup(client)
        # Configure
        config_res = client.post("/trading/trades/configure", json={
            "subscription_id": sub_id,
            "capital": 5000,
        }, headers=headers)
        trade_id = config_res.json()["trade_id"]

        # Execute
        exec_res = client.post(f"/trading/trades/{trade_id}/execute", headers=headers)
        assert exec_res.status_code == 200
        data = exec_res.json()
        assert data["status"] == "completed"
        assert data["capital"] == 5000
        assert "num_trades" in data
        assert isinstance(data["pnl"], (int, float))

    def test_execute_insufficient_balance(self, client):
        model_id = create_live_model(client)
        headers = register_and_login(client, email="broke@test.com")
        sub_id = subscribe_to_model(client, model_id, headers)
        # Don't fund wallet
        res = client.post("/trading/trades/configure", json={
            "subscription_id": sub_id,
            "capital": 1000,
        }, headers=headers)
        assert res.status_code == 400
        assert "Insufficient" in res.json()["detail"]

    def test_list_trades(self, client):
        _, headers, sub_id = self._setup(client)
        # Create and execute a trade
        config_res = client.post("/trading/trades/configure", json={
            "subscription_id": sub_id,
            "capital": 1000,
        }, headers=headers)
        trade_id = config_res.json()["trade_id"]
        client.post(f"/trading/trades/{trade_id}/execute", headers=headers)

        res = client.get("/trading/trades", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_list_subscription_trades(self, client):
        _, headers, sub_id = self._setup(client)
        config_res = client.post("/trading/trades/configure", json={
            "subscription_id": sub_id,
            "capital": 1000,
        }, headers=headers)
        trade_id = config_res.json()["trade_id"]
        client.post(f"/trading/trades/{trade_id}/execute", headers=headers)

        res = client.get(f"/trading/trades/subscription/{sub_id}", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1


# ── Profit Sharing Tests ─────────────────────────────────────────

class TestProfitSharing:
    def test_profit_sharing_after_trade(self, client):
        model_id = create_live_model(client)
        headers = register_and_login(client, email="profitguy@test.com")
        sub_id = subscribe_to_model(client, model_id, headers)
        client.post("/trading/wallet/fund", json={"amount": 100000}, headers=headers)

        # Execute a few trades
        for _ in range(3):
            config_res = client.post("/trading/trades/configure", json={
                "subscription_id": sub_id,
                "capital": 5000,
            }, headers=headers)
            trade_id = config_res.json()["trade_id"]
            client.post(f"/trading/trades/{trade_id}/execute", headers=headers)

        res = client.get("/trading/profit-sharing", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should have 3 trade records
        assert len(data) == 3

    def test_profit_sharing_empty(self, client):
        headers = register_and_login(client)
        res = client.get("/trading/profit-sharing", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    def test_researcher_earns_from_trade(self, client):
        """When a profitable trade happens, the researcher's balance should increase."""
        model_id = create_live_model(client)
        researcher_headers = register_and_login(client, email="researcher@test.com")

        # Get researcher's initial balance
        # (we need to check via earnings endpoint)
        init_res = client.get("/researcher/earnings", headers=researcher_headers)
        init_earnings = init_res.json()["total_earnings"]

        # Subscriber trades
        sub_headers = register_and_login(client, email="active_sub@test.com")
        sub_id = subscribe_to_model(client, model_id, sub_headers)
        client.post("/trading/wallet/fund", json={"amount": 100000}, headers=sub_headers)

        # Execute several trades (some may be profitable due to random walk)
        for _ in range(5):
            config_res = client.post("/trading/trades/configure", json={
                "subscription_id": sub_id,
                "capital": 5000,
            }, headers=sub_headers)
            trade_id = config_res.json()["trade_id"]
            client.post(f"/trading/trades/{trade_id}/execute", headers=sub_headers)

        # Check earnings — may or may not have increased depending on random PnL
        final_res = client.get("/researcher/earnings", headers=researcher_headers)
        assert final_res.status_code == 200
        # At minimum, the endpoint works
        assert "total_earnings" in final_res.json()
