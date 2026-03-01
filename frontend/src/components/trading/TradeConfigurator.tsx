"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

interface Props {
  walletBalance: number;
  modelName: string;
  onFundWallet: (amount: number) => Promise<void>;
  onConfigure: (capital: number) => void;
  funding: boolean;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000, 50000];

export default function TradeConfigurator({ walletBalance, modelName, onFundWallet, onConfigure, funding }: Props) {
  const [capital, setCapital] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [showFund, setShowFund] = useState(false);

  const parsedCapital = parseFloat(capital.replace(/,/g, ""));
  const canTrade = parsedCapital > 0 && parsedCapital <= walletBalance;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Wallet section */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Icon name="account_balance_wallet" className="text-emerald-600 text-lg" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Wallet Balance</p>
              <p className="text-xl font-bold text-slate-900">${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button
            onClick={() => setShowFund(!showFund)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
          >
            <Icon name="add" className="text-sm" />
            Add Funds
          </button>
        </div>

        {showFund && (
          <div className="mt-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <p className="text-[11px] text-slate-500 mb-2 font-medium">Quick add (mock deposit)</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setFundAmount(String(amt))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    fundAmount === String(amt)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="Custom amount"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-300"
              />
              <button
                onClick={async () => {
                  const amt = parseFloat(fundAmount);
                  if (amt > 0) {
                    await onFundWallet(amt);
                    setFundAmount("");
                    setShowFund(false);
                  }
                }}
                disabled={!parseFloat(fundAmount) || funding}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {funding ? "Adding..." : "Deposit"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <Icon name="info" className="text-xs" />
              Mock funds for testing. Real brokerage integration coming soon.
            </p>
          </div>
        )}
      </div>

      {/* Capital input */}
      <div className="p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-1">Trade Capital</h4>
        <p className="text-[11px] text-slate-500 mb-3">
          How much do you want to trade with <span className="font-semibold text-slate-700">{modelName}</span>?
        </p>

        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">$</span>
          <input
            type="text"
            value={capital}
            onChange={(e) => setCapital(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="0.00"
            className="w-full pl-9 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-toll-blue/40 focus:ring-2 focus:ring-toll-blue/10"
          />
        </div>

        {/* Quick capital presets */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[10, 25, 50, 75, 100].map((pct) => {
            const amt = Math.floor(walletBalance * (pct / 100));
            return (
              <button
                key={pct}
                onClick={() => setCapital(String(amt))}
                disabled={walletBalance <= 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:border-toll-blue/30 hover:text-toll-blue hover:bg-toll-blue/5 disabled:opacity-30 transition-colors"
              >
                {pct}%{pct < 100 && ` ($${amt.toLocaleString()})`}
              </button>
            );
          })}
        </div>

        {/* Warnings */}
        {parsedCapital > walletBalance && walletBalance > 0 && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-600">
            <Icon name="error" className="text-sm" />
            Exceeds wallet balance. Add more funds or reduce capital.
          </div>
        )}

        {walletBalance === 0 && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-xs text-amber-700">
            <Icon name="warning" className="text-sm" />
            Your wallet is empty. Add funds first to start trading.
          </div>
        )}

        <button
          onClick={() => onConfigure(parsedCapital)}
          disabled={!canTrade}
          className="w-full py-3 bg-toll-blue text-white rounded-xl text-sm font-semibold hover:bg-toll-blue-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="preview" className="text-base" />
          Review Trade Summary
        </button>
      </div>
    </div>
  );
}
