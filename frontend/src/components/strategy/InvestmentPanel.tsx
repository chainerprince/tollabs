"use client";

import { useState } from "react";
import { trading } from "@/lib/api";
import Icon from "@/components/ui/Icon";

interface InvestmentPanelProps {
  balance: number;
  cumulativePnl: number;
  onBalanceChange?: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

export default function InvestmentPanel({ balance, cumulativePnl, onBalanceChange }: InvestmentPanelProps) {
  const [modal, setModal] = useState<"add" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (modal === "withdraw" && value > balance) {
      setError(`Insufficient balance. You have $${balance.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result =
        modal === "add"
          ? await trading.fundWallet(value)
          : await trading.withdrawWallet(value);

      setSuccess(result.message ?? `${modal === "add" ? "Added" : "Withdrew"} $${value.toLocaleString()}`);
      onBalanceChange?.(result.balance);
      setAmount("");

      // Auto-close after brief success message
      setTimeout(() => {
        setModal(null);
        setSuccess("");
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border-b border-slate-200 bg-white">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon name="account_balance" className="text-toll-blue" />
        Investment Capital
      </h3>

      {/* Balance Card */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4">
        <span className="text-xs text-slate-500 font-medium uppercase">Account Balance</span>
        <div className="text-2xl font-bold text-slate-900 mt-1 mb-1 font-mono">
          ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">
            PnL:{" "}
            <span className={cumulativePnl >= 0 ? "text-accent-green" : "text-accent-red"}>
              {cumulativePnl >= 0 ? "+" : ""}${cumulativePnl.toFixed(2)}
            </span>
          </span>
          <span className="text-toll-blue font-medium cursor-pointer hover:underline">
            History
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setModal("add"); setAmount(""); setError(""); setSuccess(""); }}
          className="flex items-center justify-center gap-2 bg-toll-blue hover:bg-toll-blue-dark text-white text-sm font-medium py-2.5 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-95"
        >
          <Icon name="add" className="text-sm" />
          Add Capital
        </button>
        <button
          onClick={() => { setModal("withdraw"); setAmount(""); setError(""); setSuccess(""); }}
          className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg transition-colors shadow-sm active:scale-95"
        >
          <Icon name="arrow_outward" className="text-sm" />
          Withdraw
        </button>
      </div>

      {/* ── Modal Overlay ──────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${modal === "add" ? "bg-toll-blue/5" : "bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${modal === "add" ? "bg-toll-blue/10 text-toll-blue" : "bg-slate-200 text-slate-600"}`}>
                  <Icon name={modal === "add" ? "add_circle" : "arrow_outward"} className="text-xl" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {modal === "add" ? "Add Capital" : "Withdraw Funds"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modal === "add"
                      ? "Fund your trading wallet"
                      : `Available: $${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    min="1"
                    max={modal === "withdraw" ? balance : 1000000}
                    step="100"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="0.00"
                    autoFocus
                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl text-lg font-mono text-slate-900 focus:ring-2 focus:ring-toll-blue focus:border-transparent placeholder:text-slate-300 transition-shadow"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setAmount(String(q)); setError(""); }}
                    disabled={modal === "withdraw" && q > balance}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      parseFloat(amount) === q
                        ? "bg-toll-blue text-white border-toll-blue"
                        : "bg-white text-slate-600 border-slate-200 hover:border-toll-blue/50 hover:text-toll-blue disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    ${(q / 1000).toFixed(0)}k
                  </button>
                ))}
                {modal === "withdraw" && (
                  <button
                    onClick={() => { setAmount(String(balance)); setError(""); }}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      parseFloat(amount) === balance
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                    }`}
                  >
                    Max
                  </button>
                )}
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <Icon name="error" className="text-base" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <Icon name="check_circle" className="text-base" />
                  {success}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setModal(null)}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className={`flex-1 py-2.5 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  modal === "add"
                    ? "bg-toll-blue hover:bg-toll-blue-dark shadow-sm shadow-blue-200"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Icon name={modal === "add" ? "add" : "arrow_outward"} className="text-sm" />
                    {modal === "add" ? "Fund Wallet" : "Withdraw"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
