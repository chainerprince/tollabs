"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { subscriptions, trading, marketplace } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";
import type { Subscription, TradeRecord2, TradingModel, WalletInfo } from "@/lib/types";

/* ── Helpers ──────────────────────────────────────────────────── */
const fmtUSD = (n: number) =>
  n >= 0
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pctColor = (n: number) => (n >= 0 ? "text-emerald-600" : "text-red-500");
const pctBg = (n: number) => (n >= 0 ? "bg-emerald-50" : "bg-red-50");

export default function InvestorDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [trades, setTrades] = useState<TradeRecord2[]>([]);
  const [models, setModels] = useState<TradingModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [subsData, walletData, tradesData, modelsData] = await Promise.all([
          subscriptions.mySubscriptions(),
          trading.getBalance(),
          trading.listTrades(),
          marketplace.listModels(),
        ]);
        setSubs(subsData);
        setWallet(walletData);
        setTrades(tradesData);
        setModels(modelsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const activeSubs = subs.filter((s) => s.is_active);
  const totalPnl = subs.reduce((sum, s) => sum + (s.cumulative_pnl ?? 0), 0);
  const completedTrades = trades.filter((t) => t.status === "completed");
  const recentTrades = completedTrades.slice(0, 5);
  const totalTraded = completedTrades.reduce((sum, t) => sum + t.capital, 0);
  const totalTradePnl = completedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate =
    completedTrades.length > 0
      ? Math.round((completedTrades.filter((t) => t.pnl > 0).length / completedTrades.length) * 100)
      : 0;

  const getModelName = (modelId: number) => {
    return models.find((m) => m.id === modelId)?.name ?? `Model #${modelId}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen flex">
        <Sidebar />
        <main className="flex-1 md:ml-64 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading dashboard…</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8 overflow-y-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {user?.email.split("@")[0]}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Here&apos;s an overview of your investment portfolio.
              </p>
            </div>
            <button
              onClick={() => router.push("/marketplace")}
              className="flex items-center gap-2 px-4 py-2.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Icon name="explore" className="text-base" />
              Explore Models
            </button>
          </div>
        </header>

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Wallet */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Wallet Balance</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Icon name="account_balance_wallet" className="text-base text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmtUSD(wallet?.balance ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-1">Available to trade</p>
          </div>

          {/* Active Subs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Subscriptions</span>
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Icon name="subscriptions" className="text-base text-violet-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{activeSubs.length}</p>
            <p className="text-xs text-slate-400 mt-1">{subs.length} total</p>
          </div>

          {/* Total PnL */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cumulative PnL</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pctBg(totalPnl)}`}>
                <Icon name={totalPnl >= 0 ? "trending_up" : "trending_down"} className={`text-base ${pctColor(totalPnl)}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${pctColor(totalPnl)}`}>
              {totalPnl >= 0 ? "+" : ""}{fmtUSD(totalPnl)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Across all subscriptions</p>
          </div>

          {/* Win Rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Win Rate</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Icon name="emoji_events" className="text-base text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{winRate}%</p>
            <p className="text-xs text-slate-400 mt-1">{completedTrades.length} completed trades</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Active Subscriptions ──────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Icon name="library_add_check" className="text-base text-slate-400" />
                Active Subscriptions
              </h3>
              <button
                onClick={() => router.push("/subscriptions")}
                className="text-xs text-toll-blue hover:underline font-medium"
              >
                View all →
              </button>
            </div>

            {activeSubs.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="inbox" className="text-4xl text-slate-200 mb-3" />
                <p className="text-sm text-slate-400 mb-4">No active subscriptions yet.</p>
                <button
                  onClick={() => router.push("/marketplace")}
                  className="text-sm text-toll-blue hover:underline font-medium"
                >
                  Browse the marketplace →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeSubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/trade?sub=${sub.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-toll-blue to-indigo-600 flex items-center justify-center text-white">
                        <Icon name="psychology" className="text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{getModelName(sub.model_id)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            Since {new Date(sub.subscribed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                          <span className="text-[11px] text-slate-400">
                            {(sub.profit_share_pct * 100).toFixed(0)}% share
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${pctColor(sub.cumulative_pnl ?? 0)}`}>
                        {(sub.cumulative_pnl ?? 0) >= 0 ? "+" : ""}{fmtUSD(sub.cumulative_pnl ?? 0)}
                      </p>
                      <span className="text-[11px] text-emerald-500 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Quick Actions + Wallet ───────────────────────── */}
          <div className="space-y-6">
            {/* Wallet Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="account_balance_wallet" className="text-lg text-slate-300" />
                <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Wallet</span>
              </div>
              <p className="text-3xl font-bold mb-1">{fmtUSD(wallet?.balance ?? 0)}</p>
              <p className="text-xs text-slate-400 mb-5">Available balance</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await trading.fundWallet(1000);
                      setWallet(res);
                    } catch (e) { console.error(e); }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <Icon name="add" className="text-sm" />
                  Deposit
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await trading.withdrawWallet(500);
                      setWallet(res);
                    } catch (e) { console.error(e); }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <Icon name="output" className="text-sm" />
                  Withdraw
                </button>
              </div>
            </div>

            {/* Portfolio Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Icon name="pie_chart" className="text-base text-slate-400" />
                Portfolio Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total Traded</span>
                  <span className="text-sm font-semibold text-slate-900">{fmtUSD(totalTraded)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Realized PnL</span>
                  <span className={`text-sm font-semibold ${pctColor(totalTradePnl)}`}>
                    {totalTradePnl >= 0 ? "+" : ""}{fmtUSD(totalTradePnl)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Trades Executed</span>
                  <span className="text-sm font-semibold text-slate-900">{completedTrades.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Win Rate</span>
                  <span className="text-sm font-semibold text-slate-900">{winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Trades ──────────────────────────────────── */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Icon name="swap_horiz" className="text-base text-slate-400" />
              Recent Trades
            </h3>
            {completedTrades.length > 0 && (
              <button
                onClick={() => router.push("/investor/trades")}
                className="text-xs text-toll-blue hover:underline font-medium"
              >
                View all →
              </button>
            )}
          </div>

          {recentTrades.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="receipt_long" className="text-4xl text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">No trades yet. Subscribe to a model and start trading.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-medium">Model</th>
                    <th className="text-left px-6 py-3 font-medium">Direction</th>
                    <th className="text-right px-6 py-3 font-medium">Capital</th>
                    <th className="text-right px-6 py-3 font-medium">PnL</th>
                    <th className="text-right px-6 py-3 font-medium">Your Net</th>
                    <th className="text-right px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {getModelName(t.model_id)}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.direction === "long"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-500"
                        }`}>
                          <Icon name={t.direction === "long" ? "arrow_upward" : "arrow_downward"} className="text-xs" />
                          {t.direction ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">{fmtUSD(t.capital)}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${pctColor(t.pnl)}`}>
                        {t.pnl >= 0 ? "+" : ""}{fmtUSD(t.pnl)}
                      </td>
                      <td className={`px-6 py-3 text-right font-semibold ${pctColor(t.subscriber_net)}`}>
                        {t.subscriber_net >= 0 ? "+" : ""}{fmtUSD(t.subscriber_net)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 text-xs">
                        {t.executed_at
                          ? new Date(t.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
