"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { trading } from "@/lib/api";
import type { MultiTradeResult } from "@/lib/types";

interface Props {
  subscriptionId: number;
  modelName: string;
  walletBalance: number;
}

export default function MultiTradePanel({ subscriptionId, modelName, walletBalance }: Props) {
  const [numTrades, setNumTrades] = useState(5);
  const [capitalPerTrade, setCapitalPerTrade] = useState(100);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<MultiTradeResult | null>(null);
  const [error, setError] = useState("");

  const totalRequired = numTrades * capitalPerTrade;
  const canExecute = totalRequired <= walletBalance && capitalPerTrade >= 10;

  const handleExecute = async () => {
    setExecuting(true);
    setError("");
    setResult(null);
    try {
      const res = await trading.executeMultiTrade(subscriptionId, capitalPerTrade, numTrades);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Multi-trade execution failed");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Config Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white">
            <Icon name="rocket_launch" className="text-xl" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Multi-Trade Execution</h3>
            <p className="text-xs text-slate-500">Execute multiple AI-powered trades in one batch using <span className="font-semibold">{modelName}</span></p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Number of trades slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Number of Trades</label>
              <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-lg">{numTrades}</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={numTrades}
              onChange={(e) => setNumTrades(Number(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1</span><span>5</span><span>10</span><span>15</span><span>20</span>
            </div>
          </div>

          {/* Capital per trade */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Capital per Trade</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={capitalPerTrade}
                onChange={(e) => setCapitalPerTrade(Number(e.target.value))}
                min={10}
                step={10}
                className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Summary bar */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Trades</p>
                <p className="text-lg font-bold text-slate-900">{numTrades}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Per Trade</p>
                <p className="text-lg font-bold text-slate-900">${capitalPerTrade.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Total</p>
                <p className={`text-lg font-bold ${canExecute ? "text-emerald-600" : "text-red-600"}`}>
                  ${totalRequired.toLocaleString()}
                </p>
              </div>
            </div>
            {!canExecute && totalRequired > walletBalance && (
              <p className="text-[10px] text-red-500 text-center mt-2">
                Insufficient balance (${walletBalance.toLocaleString()} available)
              </p>
            )}
          </div>

          {/* Execute */}
          <button
            onClick={handleExecute}
            disabled={executing || !canExecute}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {executing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Executing {numTrades} trades...
              </>
            ) : (
              <>
                <Icon name="rocket_launch" className="text-lg" />
                Execute {numTrades} Trades — ${totalRequired.toLocaleString()}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <Icon name="error" className="text-base" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="close" className="text-base" />
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Aggregate */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="analytics" className="text-xl text-violet-600" />
              <h3 className="font-bold text-slate-900">Batch Results</h3>
              <span className="ml-auto text-xs text-slate-500">{result.total_trades} trades</span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Successful", value: result.completed, color: "text-emerald-600 bg-emerald-50" },
                { label: "Failed", value: result.failed, color: "text-red-600 bg-red-50" },
                { label: "Total Capital", value: `$${result.total_capital_deployed.toFixed(2)}`, color: "text-blue-600 bg-blue-50" },
                { label: "Net P&L", value: `${result.total_pnl >= 0 ? "+" : ""}$${result.total_pnl.toFixed(2)}`, color: result.total_pnl >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50" },
              ].map((s) => (
                <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[9px] uppercase tracking-wide opacity-70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Individual trades */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Individual Trades</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {result.trades.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.status === "executed" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                      <Icon name={t.status === "executed" ? "check" : "close"} className="text-base" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">Trade #{i + 1}</p>
                      <p className="text-[10px] text-slate-400">
                        {t.signal ?? "—"} · {t.direction?.toUpperCase() ?? "—"} · ${t.entry_price?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${(t.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => setResult(null)}
            className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Execute Another Batch
          </button>
        </div>
      )}
    </div>
  );
}
