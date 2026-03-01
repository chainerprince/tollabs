"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { subscriptions, marketplace, trading } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import StrategyAgent from "@/components/trading/StrategyAgent";
import TradeConfigurator from "@/components/trading/TradeConfigurator";
import TradeSummaryCard from "@/components/trading/TradeSummaryCard";
import TradeResultCard from "@/components/trading/TradeResultCard";
import ProfitSharingPanel from "@/components/trading/ProfitSharingPanel";
import type { Subscription, TradingModel, TradeSummary, TradeRecord2 } from "@/lib/types";

type Step = "agent" | "configure" | "summary" | "result" | "sharing";

function TradingPortalInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subId = Number(searchParams.get("sub")) || 0;

  /* ── State ──────────────────────────────────────────────────── */
  const [sub, setSub] = useState<Subscription | null>(null);
  const [model, setModel] = useState<TradingModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [step, setStep] = useState<Step>("agent");
  const [capital, setCapital] = useState<number | null>(null);
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [tradeResult, setTradeResult] = useState<TradeRecord2 | null>(null);
  const [executing, setExecuting] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState("");

  /* ── Load subscription + model + balance ────────────────────── */
  useEffect(() => {
    async function load() {
      if (!user || !subId) {
        setLoading(false);
        return;
      }
      try {
        const [subs, bal] = await Promise.all([
          subscriptions.mySubscriptions(),
          trading.getBalance(),
        ]);
        const match = subs.find((s) => s.id === subId);
        if (match) {
          setSub(match);
          setBalance(bal.balance);
          const m = await marketplace.getModel(match.model_id);
          setModel(m as unknown as TradingModel);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, subId]);

  /* ── Fund wallet ────────────────────────────────────────────── */
  const handleFundWallet = useCallback(async (amount: number) => {
    setFunding(true);
    try {
      const res = await trading.fundWallet(amount);
      setBalance(res.balance);
    } catch (e) {
      setError(String(e));
    } finally {
      setFunding(false);
    }
  }, []);

  /* ── Configure trade ────────────────────────────────────────── */
  const handleConfigure = useCallback(async (amt: number) => {
    if (!sub) return;
    setError("");
    try {
      const res = await trading.configureTrade(sub.id, amt);
      setSummary(res);
      setCapital(amt);
      setStep("summary");
    } catch (e) {
      setError(String(e));
    }
  }, [sub]);

  /* ── Execute trade ──────────────────────────────────────────── */
  const handleExecute = useCallback(async () => {
    if (!summary) return;
    setExecuting(true);
    setError("");
    try {
      const result = await trading.executeTrade(summary.trade_id);
      setTradeResult(result);
      setBalance((prev) => {
        // Refresh balance
        trading.getBalance().then((b) => setBalance(b.balance)).catch(() => {});
        return prev;
      });
      setStep("result");
    } catch (e) {
      setError(String(e));
    } finally {
      setExecuting(false);
    }
  }, [summary]);

  /* ── Reset for new trade ────────────────────────────────────── */
  const handleNewTrade = () => {
    setSummary(null);
    setTradeResult(null);
    setCapital(null);
    setExecuting(false);
    setError("");
    setStep("configure");
    // Refresh balance
    trading.getBalance().then((b) => setBalance(b.balance)).catch(() => {});
  };

  /* ── Loading / auth states ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="w-5 h-5 border-2 border-toll-blue/30 border-t-toll-blue rounded-full animate-spin" />
          Loading trading portal...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="lock" className="text-4xl text-slate-300 mb-3" />
          <p className="text-slate-500 mb-4">Sign in to access trading</p>
          <button onClick={() => router.push("/login")} className="px-6 py-2 bg-toll-blue text-white rounded-lg text-sm font-medium">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!sub || !model) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="search_off" className="text-4xl text-slate-300 mb-3" />
          <p className="text-slate-500 mb-4">Subscription not found. Subscribe to a model first.</p>
          <button onClick={() => router.push("/marketplace")} className="px-6 py-2 bg-toll-blue text-white rounded-lg text-sm font-medium">
            Browse Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-5">
          <button
            onClick={() => router.push(`/strategy/${model.id}`)}
            className="text-sm text-slate-400 hover:text-toll-blue transition-colors flex items-center gap-1"
          >
            <Icon name="arrow_back" className="text-base" />
            Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-toll-blue to-indigo-500 flex items-center justify-center text-white">
              <Icon name="bolt" className="text-lg" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">{model.name}</h1>
              <p className="text-[10px] text-slate-500">
                Trading Portal • {model.asset_class.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Wallet badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
            <Icon name="account_balance_wallet" className="text-emerald-600 text-sm" />
            <span className="text-sm font-bold text-emerald-700">
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Step navigation */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {(["agent", "configure", "sharing"] as Step[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s === "agent" || s === "configure" || s === "sharing") setStep(s);
                }}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  step === s
                    ? "bg-white text-toll-blue shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s === "agent" ? "💬 Agent" : s === "configure" ? "⚙️ Trade" : "📊 Sharing"}
              </button>
            ))}
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{user.email}</span>
              <div className="w-7 h-7 rounded-full bg-toll-blue flex items-center justify-center text-white text-[10px] font-bold">
                {user.email[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel: Strategy Agent Chat */}
        <div className="w-[420px] border-r border-slate-200 bg-white flex flex-col shrink-0">
          <StrategyAgent
            subscriptionId={sub.id}
            modelName={model.name}
            capital={capital}
            onSetCapital={(amt) => setCapital(amt)}
            onReady={() => setStep("configure")}
          />
        </div>

        {/* Right panel: Trade flow */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Error banner */}
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <Icon name="error" className="text-base" />
                {error}
                <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
                  <Icon name="close" className="text-base" />
                </button>
              </div>
            )}

            {/* Step: Configure */}
            {step === "configure" && (
              <TradeConfigurator
                walletBalance={balance}
                modelName={model.name}
                onFundWallet={handleFundWallet}
                onConfigure={handleConfigure}
                funding={funding}
              />
            )}

            {/* Step: Summary */}
            {step === "summary" && summary && (
              <TradeSummaryCard
                summary={summary}
                onExecute={handleExecute}
                onCancel={() => setStep("configure")}
                executing={executing}
              />
            )}

            {/* Step: Result */}
            {step === "result" && tradeResult && (
              <TradeResultCard
                trade={tradeResult}
                onNewTrade={handleNewTrade}
                onViewSharing={() => setStep("sharing")}
              />
            )}

            {/* Step: Profit sharing */}
            {step === "sharing" && <ProfitSharingPanel />}

            {/* Step: Agent (show hint to navigate) */}
            {step === "agent" && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-toll-blue/5 flex items-center justify-center mx-auto mb-4">
                  <Icon name="chat" className="text-3xl text-toll-blue/40" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  Chat with your Strategy Agent
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                  Use the chat on the left to ask questions about the strategy, discuss capital allocation, or request modifications.
                </p>
                <button
                  onClick={() => setStep("configure")}
                  className="px-6 py-2.5 bg-toll-blue text-white rounded-xl text-sm font-medium hover:bg-toll-blue-dark transition-colors"
                >
                  Ready to Trade →
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TradingPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-400">
          Loading trading portal…
        </div>
      }
    >
      <TradingPortalInner />
    </Suspense>
  );
}
