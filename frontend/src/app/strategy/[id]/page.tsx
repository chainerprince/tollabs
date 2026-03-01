"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { subscriptions, marketplace, trading } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import PnlChart from "@/components/strategy/PnlChart";
import StatsBar from "@/components/strategy/StatsBar";
import InvestmentPanel from "@/components/strategy/InvestmentPanel";
import StrategyControl from "@/components/strategy/StrategyControl";
import type { Subscription, TradingModel, TradingModelDetail, PerformanceMetadata, TradeRecord } from "@/lib/types";

export default function StrategyPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const modelId = Number(params.id);

  const [sub, setSub] = useState<Subscription | null>(null);
  const [model, setModel] = useState<TradingModel | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch model info
        const m = await marketplace.getModel(modelId);
        setModel(m as unknown as TradingModel);

        // Fetch user subscriptions, wallet balance
        if (user) {
          const [subs, wallet] = await Promise.all([
            subscriptions.mySubscriptions(),
            trading.getBalance(),
          ]);
          const match = subs.find((s) => s.model_id === modelId && s.is_active);
          if (match) setSub(match);
          setWalletBalance(wallet.balance);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [modelId, user]);

  const handleCancel = async () => {
    if (!sub) return;
    try {
      await subscriptions.cancel(sub.id);
      setSub({ ...sub, is_active: false });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-toll-text-light">
        Loading strategy...
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center text-toll-text-light">
        Model not found.
      </div>
    );
  }

  const metrics: PerformanceMetadata = model.performance_metadata ?? {};

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-toll-blue/10 flex items-center justify-center text-toll-blue font-bold">
              <Icon name="psychology" className="text-xl" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none mb-1">
                {model.name}
              </h1>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>by</span>
                <span className="font-medium text-toll-blue">
                  {model.creator_email ?? `User #${model.creator_id}`}
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full mx-1" />
                <span
                  className={`flex items-center px-1.5 py-0.5 rounded-full border text-xs ${
                    sub?.is_active
                      ? "text-accent-green bg-green-50 border-green-100"
                      : "text-slate-500 bg-slate-50 border-slate-200"
                  }`}
                >
                  {sub?.is_active && (
                    <span className="w-1.5 h-1.5 bg-accent-green rounded-full mr-1 status-pulse" />
                  )}
                  {sub?.is_active ? "Active" : model.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/marketplace")}
            className="text-sm font-medium text-toll-text-light hover:text-toll-blue"
          >
            ← Back to Marketplace
          </button>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-900">{user.email.split("@")[0]}</span>
              <div className="w-9 h-9 rounded-full bg-toll-blue flex items-center justify-center text-white text-sm font-bold">
                {user.email[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 flex flex-col">
          <PnlChart
            cumulativePnl={sub?.cumulative_pnl ?? metrics.total_pnl ?? 0}
            returnPct={metrics.total_return_pct ?? 0}
            trades={(model as unknown as TradingModelDetail)?.trade_history ?? []}
          />
          <StatsBar metrics={metrics} />
        </div>

        {/* Right sidebar */}
        <aside className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 z-20 shadow-[0_0_15px_rgba(0,0,0,0.03)] overflow-y-auto">
          <InvestmentPanel
            balance={walletBalance}
            cumulativePnl={sub?.cumulative_pnl ?? 0}
            onBalanceChange={(newBal) => setWalletBalance(newBal)}
          />
          <StrategyControl isActive={sub?.is_active ?? false} onCancel={handleCancel} />

          {/* Trade button */}
          {sub?.is_active && (
            <div className="p-4 border-t border-slate-200">
              <button
                onClick={() => router.push(`/trade?sub=${sub.id}`)}
                className="w-full py-3 bg-gradient-to-r from-toll-blue to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-toll-blue-dark hover:to-indigo-700 transition-all shadow-lg shadow-toll-blue/20 flex items-center justify-center gap-2"
              >
                <Icon name="bolt" className="text-base" />
                Open Trading Portal
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">Chat with the AI agent • Configure & execute trades</p>
            </div>
          )}

          {/* Recent Activity */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Recent Activity</h4>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-700 font-medium">Subscription Active</span>
                  <span className="text-[10px] text-slate-400">
                    {sub ? new Date(sub.subscribed_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-700 font-medium">
                    PnL: {(sub?.cumulative_pnl ?? 0) >= 0 ? "+" : ""}${(sub?.cumulative_pnl ?? 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">Cumulative</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
