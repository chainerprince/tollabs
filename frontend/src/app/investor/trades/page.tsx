"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { trading, marketplace } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";
import type { TradeRecord2, TradingModel, ProfitSharingDetail } from "@/lib/types";

const fmtUSD = (n: number) =>
  n >= 0
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pctColor = (n: number) => (n >= 0 ? "text-emerald-600" : "text-red-500");

export default function TradeHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [trades, setTrades] = useState<TradeRecord2[]>([]);
  const [models, setModels] = useState<TradingModel[]>([]);
  const [profitSharing, setProfitSharing] = useState<ProfitSharingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trades" | "sharing">("trades");

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [t, m, ps] = await Promise.all([
          trading.listTrades(),
          marketplace.listModels(),
          trading.getProfitSharing(),
        ]);
        setTrades(t);
        setModels(m);
        setProfitSharing(ps);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const getModelName = (id: number) => models.find((m) => m.id === id)?.name ?? `Model #${id}`;

  return (
    <div className="bg-slate-50 min-h-screen flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Trade History</h1>
          <p className="text-sm text-slate-500 mt-1">
            View all your executed trades and profit-sharing details.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
          {(["trades", "sharing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "trades" ? "All Trades" : "Profit Sharing"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading…
          </div>
        ) : tab === "trades" ? (
          /* ── All Trades ──────────────────────────────────── */
          trades.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <Icon name="receipt_long" className="text-4xl text-slate-200 mb-3" />
              <p className="text-sm text-slate-400 mb-4">No trades yet.</p>
              <button
                onClick={() => router.push("/subscriptions")}
                className="text-sm text-toll-blue hover:underline font-medium"
              >
                Go to subscriptions →
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-medium">Model</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-left px-6 py-3 font-medium">Direction</th>
                      <th className="text-right px-6 py-3 font-medium">Capital</th>
                      <th className="text-right px-6 py-3 font-medium">PnL</th>
                      <th className="text-right px-6 py-3 font-medium">Your Net</th>
                      <th className="text-right px-6 py-3 font-medium">Researcher</th>
                      <th className="text-right px-6 py-3 font-medium">Platform</th>
                      <th className="text-right px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {trades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-900">{getModelName(t.model_id)}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            t.status === "completed"
                              ? "bg-emerald-50 text-emerald-600"
                              : t.status === "failed"
                                ? "bg-red-50 text-red-500"
                                : "bg-amber-50 text-amber-600"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            t.direction === "long"
                              ? "bg-emerald-50 text-emerald-600"
                              : t.direction === "short"
                                ? "bg-red-50 text-red-500"
                                : "bg-slate-50 text-slate-400"
                          }`}>
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
                        <td className="px-6 py-3 text-right text-slate-500">{fmtUSD(t.researcher_share)}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{fmtUSD(t.platform_share)}</td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs">
                          {t.executed_at
                            ? new Date(t.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* ── Profit Sharing ──────────────────────────────── */
          profitSharing.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <Icon name="payments" className="text-4xl text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">No profit-sharing records yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-medium">Model</th>
                      <th className="text-left px-6 py-3 font-medium">Researcher</th>
                      <th className="text-right px-6 py-3 font-medium">Trade PnL</th>
                      <th className="text-right px-6 py-3 font-medium">Your Net</th>
                      <th className="text-right px-6 py-3 font-medium">Researcher Cut</th>
                      <th className="text-right px-6 py-3 font-medium">Platform Cut</th>
                      <th className="text-right px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {profitSharing.map((ps) => (
                      <tr key={ps.trade_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-900">{ps.model_name}</td>
                        <td className="px-6 py-3 text-slate-500">{ps.researcher_email}</td>
                        <td className={`px-6 py-3 text-right font-semibold ${pctColor(ps.trade_pnl)}`}>
                          {ps.trade_pnl >= 0 ? "+" : ""}{fmtUSD(ps.trade_pnl)}
                        </td>
                        <td className={`px-6 py-3 text-right font-semibold ${pctColor(ps.subscriber_net)}`}>
                          {ps.subscriber_net >= 0 ? "+" : ""}{fmtUSD(ps.subscriber_net)}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-500">{fmtUSD(ps.researcher_share)}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{fmtUSD(ps.platform_share)}</td>
                        <td className="px-6 py-3 text-right text-slate-400 text-xs">
                          {ps.executed_at
                            ? new Date(ps.executed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
