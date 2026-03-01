"""
Mock Stripe module — simulates Checkout Sessions, Transfers, and Connected Accounts.
Returns JSON objects that mimic real Stripe API responses so the frontend can
swap to real Stripe later by replacing this single module.
"""

import uuid
from datetime import datetime, timezone


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


# ── In-memory stores ─────────────────────────────────────────────
_checkout_sessions: dict[str, dict] = {}
_transfers: list[dict] = []
_connected_accounts: dict[int, dict] = {}  # user_id -> account


def create_connected_account(user_id: int, email: str) -> dict:
    """Create a mock Stripe Connected Account for a researcher."""
    account_id = f"acct_mock_{uuid.uuid4().hex[:12]}"
    account = {
        "id": account_id,
        "object": "account",
        "email": email,
        "charges_enabled": True,
        "payouts_enabled": True,
        "created": _now_ts(),
        "metadata": {"tollabs_user_id": user_id},
    }
    _connected_accounts[user_id] = account
    return account


def create_checkout_session(
    user_id: int,
    model_id: int,
    model_name: str,
    profit_share_pct: float,
) -> dict:
    """Simulate a Stripe Checkout Session for a subscription."""
    session_id = f"cs_mock_{uuid.uuid4().hex[:16]}"
    session = {
        "id": session_id,
        "object": "checkout.session",
        "payment_status": "paid",
        "status": "complete",
        "mode": "subscription",
        "customer": f"cus_mock_{user_id}",
        "metadata": {
            "user_id": user_id,
            "model_id": model_id,
            "model_name": model_name,
            "profit_share_pct": profit_share_pct,
        },
        "created": _now_ts(),
        "url": f"https://checkout.stripe.mock/pay/{session_id}",
    }
    _checkout_sessions[session_id] = session
    return session


def process_payout(researcher_id: int, amount: float, description: str = "") -> dict:
    """Simulate a Stripe Transfer to a researcher's connected account."""
    account = _connected_accounts.get(researcher_id)
    transfer_id = f"tr_mock_{uuid.uuid4().hex[:12]}"
    transfer = {
        "id": transfer_id,
        "object": "transfer",
        "amount": round(amount * 100),  # Stripe uses cents
        "amount_decimal": str(round(amount, 2)),
        "currency": "usd",
        "destination": account["id"] if account else "acct_unknown",
        "description": description or f"TOLLABS payout to researcher {researcher_id}",
        "created": _now_ts(),
        "metadata": {"researcher_id": researcher_id},
    }
    _transfers.append(transfer)
    return transfer


def get_transfers_for_user(user_id: int) -> list[dict]:
    """Return all mock transfers for a given user."""
    return [t for t in _transfers if t["metadata"].get("researcher_id") == user_id]


def get_checkout_session(session_id: str) -> dict | None:
    return _checkout_sessions.get(session_id)


def get_all_sessions() -> list[dict]:
    return list(_checkout_sessions.values())
