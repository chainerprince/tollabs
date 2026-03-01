"use client";

import Icon from "@/components/ui/Icon";
import type { TradeSummary } from "@/lib/types";

interface Props {
  summary: TradeSummary;
  onExecute: () => void;
  onCancel: () => void;
  executing: boolean;
}

export default function TradeSummaryCard({ summary, onExecute, onCancel, executing }: Props) {
  const riskColors = {
    Low: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "shield" },
    Medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "warning" },
    High: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "error" },
  };

  const risk = riskColors[summary.estimated_risk] ?? riskColors.Medium;
  const subscriberKeep = (1 - summary.profit_share_pct - 0.10) * 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-toll-blue/5 to-indigo-50/50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-toll-blue/10 flex items-center justify-center">
            <Icon name="receipt_long" className="text-toll-blue text-xl" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Trade Summary</h3>
            <p className="text-[11px] text-slate-500">Review before executing</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-5 space-y-4">
        {/* Strategy */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Strategy</span>
          <span className="text-sm font-semibold text-slate-900">{summary.model_name}</span>
        </div>

        {/* Asset */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Asset Class</span>
          <span className="text-sm text-slate-700 font-mono">{summary.asset_class.toUpperCase()}</span>
        </div>

        {/* Capital */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Capital</span>
          <span className="text-lg font-bold text-slate-900">
            ${summary.capital.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Risk level */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Risk Level</span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${risk.bg} ${risk.text} border ${risk.border}`}>
            <Icon name={risk.icon} className="text-sm" />
            {summary.estimated_risk}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 font-medium mb-2">Profit Sharing Split</p>
          <div className="flex gap-2">
            <div className="flex-1 p-2.5 bg-green-50 rounded-xl text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">You Keep</p>
              <p className="text-base font-bold text-green-700">{subscriberKeep.toFixed(0)}%</p>
            </div>
            <div className="flex-1 p-2.5 bg-blue-50 rounded-xl text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">Researcher</p>
              <p className="text-base font-bold text-blue-700">{(summary.profit_share_pct * 100).toFixed(0)}%</p>
            </div>
            <div className="flex-1 p-2.5 bg-slate-50 rounded-xl text-center">
              <p className="text-[10px] text-slate-500 mb-0.5">TOLLABS</p>
              <p className="text-base font-bold text-slate-600">10%</p>
            </div>
          </div>
        </div>

        {/* Modifications */}
        {summary.modifications && (
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <p className="text-[10px] text-indigo-500 font-medium mb-1">Strategy Modifications</p>
            <p className="text-xs text-indigo-800">{summary.modifications}</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100 flex items-start gap-2">
          <Icon name="info" className="text-amber-600 text-sm mt-0.5" />
          <p className="text-[10px] text-amber-700 leading-relaxed">
            This is a <strong>simulated trade</strong>. Actual brokerage integration is coming soon.
            Past performance does not guarantee future results.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={onCancel}
          disabled={executing}
          className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onExecute}
          disabled={executing}
          className="flex-[2] py-3 bg-gradient-to-r from-toll-blue to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-toll-blue-dark hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-toll-blue/20"
        >
          {executing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Icon name="bolt" className="text-base" />
              Execute Trade
            </>
          )}
        </button>
      </div>
    </div>
  );
}
