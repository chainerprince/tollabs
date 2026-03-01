"""
Seed script — populates the DB with demo data so the dashboard has content.

Run with:
    python -m app.utils.seed
"""

import sys
import os

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database import init_db, SessionLocal
from app.models.user import User
from app.models.trading_model import TradingModel
from app.models.subscription import Subscription
from app.models.transaction import Transaction
from app.mocks.mock_stripe import create_connected_account
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    print("🌱 Initialising database…")
    init_db()

    db = SessionLocal()

    # ── Check if already seeded ──────────────────────────────
    if db.query(User).first():
        print("⚠️  Database already contains data — skipping seed.")
        db.close()
        return

    # ── Users ────────────────────────────────────────────────
    researchers = [
        User(email="alice@tollabs.io", hashed_password=pwd_context.hash("password123"), role="researcher", stripe_customer_id="cus_mock_alice", balance=0.0),
        User(email="bob@tollabs.io", hashed_password=pwd_context.hash("password123"), role="researcher", stripe_customer_id="cus_mock_bob", balance=0.0),
    ]
    subscribers = [
        User(email="charlie@tollabs.io", hashed_password=pwd_context.hash("password123"), role="subscriber", stripe_customer_id="cus_mock_charlie", balance=10000.0),
        User(email="diana@gmail.com", hashed_password=pwd_context.hash("password123"), role="subscriber", stripe_customer_id="cus_mock_diana", balance=25000.0),
        User(email="eve@gmail.com", hashed_password=pwd_context.hash("password123"), role="subscriber", stripe_customer_id="cus_mock_eve", balance=5000.0),
    ]

    for u in researchers + subscribers:
        db.add(u)
    db.commit()

    # Refresh to get IDs
    for u in researchers + subscribers:
        db.refresh(u)

    # Create Stripe Connected Accounts for researchers
    for r in researchers:
        create_connected_account(r.id, r.email)

    alice, bob = researchers
    charlie, diana, eve = subscribers

    print(f"  ✅ Created {len(researchers)} researchers + {len(subscribers)} subscribers")

    # ── Trading Models ───────────────────────────────────────
    models = [
        TradingModel(
            creator_id=alice.id,
            name="Forex SMA Crossover",
            description="Simple moving-average crossover strategy on EUR/USD. Uses 10/30 SMA.",
            asset_class="forex",
            strategy_code="",  # Uses default strategy
            status="live",
            performance_metadata={"sharpe_ratio": 1.23, "max_drawdown_pct": 8.5, "total_return_pct": 34.2, "win_rate": 58.0, "num_trades": 42},
        ),
        TradingModel(
            creator_id=alice.id,
            name="GBP/USD Momentum",
            description="Momentum-based strategy for GBP/USD with RSI filter.",
            asset_class="forex",
            strategy_code="",
            status="live",
            performance_metadata={"sharpe_ratio": 0.95, "max_drawdown_pct": 12.3, "total_return_pct": 21.7, "win_rate": 52.0, "num_trades": 67},
        ),
        TradingModel(
            creator_id=bob.id,
            name="Tech Stock Mean Reversion",
            description="Mean-reversion strategy on AAPL using Bollinger Bands.",
            asset_class="stock",
            strategy_code="",
            status="live",
            performance_metadata={"sharpe_ratio": 1.55, "max_drawdown_pct": 6.1, "total_return_pct": 45.8, "win_rate": 63.0, "num_trades": 38},
        ),
        TradingModel(
            creator_id=bob.id,
            name="Crypto Volatility Breakout",
            description="Draft strategy — not yet deployed.",
            asset_class="stock",
            strategy_code="# TODO: implement",
            status="draft",
            performance_metadata={},
        ),
    ]
    for m in models:
        db.add(m)
    db.commit()
    for m in models:
        db.refresh(m)

    print(f"  ✅ Created {len(models)} trading models ({sum(1 for m in models if m.status == 'live')} live)")

    # ── Subscriptions ────────────────────────────────────────
    subs = [
        Subscription(subscriber_id=charlie.id, model_id=models[0].id, profit_share_pct=0.20, is_active=True, stripe_session_id="cs_mock_seed_1"),
        Subscription(subscriber_id=charlie.id, model_id=models[2].id, profit_share_pct=0.25, is_active=True, stripe_session_id="cs_mock_seed_2"),
        Subscription(subscriber_id=diana.id, model_id=models[0].id, profit_share_pct=0.20, is_active=True, stripe_session_id="cs_mock_seed_3"),
        Subscription(subscriber_id=diana.id, model_id=models[1].id, profit_share_pct=0.15, is_active=True, stripe_session_id="cs_mock_seed_4"),
        Subscription(subscriber_id=eve.id, model_id=models[2].id, profit_share_pct=0.20, is_active=True, stripe_session_id="cs_mock_seed_5"),
    ]
    for s in subs:
        db.add(s)
    db.commit()
    for s in subs:
        db.refresh(s)

    print(f"  ✅ Created {len(subs)} subscriptions")

    # ── Seed some historical trades (simulate a couple of cycles) ──
    from app.mocks.mock_trading import run_single_model_cycle
    from app.services.profit_service import process_profit_for_subscription

    for cycle_num in range(3):
        for model in [m for m in models if m.status == "live"]:
            cycle = run_single_model_cycle(model.strategy_code, model.asset_class, periods=200)
            model.performance_metadata = cycle["metrics"]

            active_subs = (
                db.query(Subscription)
                .filter(Subscription.model_id == model.id, Subscription.is_active == True)
                .all()
            )
            for sub in active_subs:
                process_profit_for_subscription(db, sub, cycle["metrics"]["total_pnl"])

    db.commit()
    print(f"  ✅ Ran 3 simulation cycles for historical data")

    # ── Summary ──────────────────────────────────────────────
    tx_count = db.query(Transaction).count()
    print(f"  ✅ Total transactions in ledger: {tx_count}")

    # Print researcher balances
    for r in researchers:
        db.refresh(r)
        print(f"  💰 {r.email} balance: ${r.balance:.2f}")

    db.close()
    print("\n🎉 Seed complete! Start the server with: python run.py")


if __name__ == "__main__":
    seed()
