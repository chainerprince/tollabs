"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type { TradeRecord2, AIExecutionDetails, TradingStep } from "@/lib/types";

interface Props {
  trade: TradeRecord2;
  onNewTrade: () => void;
  onViewSharing: () => void;
}

function StepCard({ step }: { step: TradingStep }) {
  const [expanded, setExpanded] = useState(false);
  const stepIcons: Record<number, string> = {
    1: "psychology",
    2: "analytics",
    3: "tune",
    4: "flag",
  };
  const stepColors: Record<number, string> = {
    1: "bg-blue-50 border-blue-200 text-blue-700",
    2: "bg-violet-50 border-violet-200 text-violet-700",
    3: "bg-amber-50 border-amber-200 text-amber-700",
    4: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  return (
    <div className={`rounded-xl border p-3 ${stepColors[step.step] || "bg-slate-50 border-slate-200 text-slate-700"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center flex-shrink-0">
          <Icon name={stepIcons[step.step] || "check_circle"} className="text-base" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">Step {step.step}: {step.name}</p>
          <p className="text-[10px] opacity-75 truncate">{step.description}</p>
        </div>
        <Icon name={expanded ? "expand_less" : "expand_more"} className="text-base opacity-50" />
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-current/10">
          {step.step === 1 && Array.isArray(step.result) ? (
            <div className="space-y-1">
              {(step.result as Array<Record<string, unknown>>).slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    s.label === "bullish" ? "bg-green-500" : s.label === "bearish" ? "bg-red-500" : "bg-slate-400"
                  }`} />
                  <span className="truncate flex-1">{String(s.headline).slice(0, 80)}</span>
                  <span className="font-mono font-bold">{String(s.label)}</span>
                  <span className="opacity-60">{(Number(s.confidence) * 100).toFixed(0)}%</span>
                </div>
              ))}
              {(step.result as Array<unknown>).length > 5 && (
                <p className="text-[10px] opacity-50">+{(step.result as Array<unknown>).length - 5} more headlines</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {Object.entries(step.result as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="opacity-70">{k.replace(/_/g, " ")}</span>
                  <span className="font-mono font-bold">
                    {typeof v === "number" ? (v < 1 && v > -1 ? (v * 100).toFixed(1) + "%" : v.toFixed(2)) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TradeResultCard({ trade, onNewTrade, onViewSharing }: Props) {
  const isProfit = trade.pnl >= 0;
  const isAI = trade.execution_details?.mode === "modal_ai";
  const aiDetails = isAI ? (trade.execution_details as unknown as AIExecutionDetails) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Result header */}
      <div className={`px-5 py-6 text-center ${isProfit ? "bg-gradient-to-b from-green-50 to-white" : "bg-gradient-to-b from-red-50 to-white"}`}>
        <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${isProfit ? "bg-green-100" : "bg-red-100"}`}>
          <Icon
            name={isProfit ? "trending_up" : "trending_down"}
            className={`text-3xl ${isProfit ? "text-green-600" : "text-red-600"}`}
          />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Trade {trade.status === "completed" ? "Completed" : "Processing"}
        </h3>
        <p className={`text-3xl font-black ${isProfit ? "text-green-600" : "text-red-600"}`}>
          {isProfit ? "+" : ""}${trade.pnl.toFixed(2)}
        </p>
        <p className={`text-sm font-medium mt-1 ${isProfit ? "text-green-500" : "text-red-500"}`}>
          {isProfit ? "+" : ""}{trade.pnl_pct.toFixed(2)}% return
        </p>
        {isAI && (
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 rounded-full">
            <Icon name="smart_toy" className="text-sm text-violet-600" />
            <span className="text-[10px] font-bold text-violet-700">AI-POWERED • {aiDetails?.signal}</span>
          </div>
        )}
      </div>

      {/* AI Multi-Step Decision Pipeline */}
      {isAI && aiDetails?.steps && aiDetails.steps.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Icon name="account_tree" className="text-base text-violet-600" />
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">
              AI Decision Pipeline • {aiDetails.headlines_analyzed} Headlines Analyzed
            </p>
          </div>
          <div className="space-y-2">
            {aiDetails.steps.map((step) => (
              <StepCard key={step.step} step={step} />
            ))}
          </div>
          {/* Model info */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <span>Model: <span className="font-mono font-medium text-slate-700">{aiDetails.model_info?.base_model || "FinBERT"}</span></span>
            <span>F1: <span className="font-bold text-emerald-600">{((aiDetails.model_info?.eval_f1 || 0) * 100).toFixed(1)}%</span></span>
            <span>Confidence: <span className="font-bold text-violet-600">{((aiDetails.confidence || 0) * 100).toFixed(1)}%</span></span>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="p-5 space-y-3 border-t border-slate-100">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Capital Deployed</span>
          <span className="font-semibold text-slate-900">${trade.capital.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Trades Executed</span>
          <span className="font-semibold text-slate-900">{trade.num_trades}</span>
        </div>
        {trade.entry_price && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Entry → Exit</span>
            <span className="font-mono text-slate-700">
              {trade.entry_price.toFixed(4)} → {trade.exit_price?.toFixed(4) ?? "—"}
            </span>
          </div>
        )}
        {trade.direction && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Direction</span>
            <span className={`font-bold ${trade.direction === "long" ? "text-green-600" : trade.direction === "short" ? "text-red-600" : "text-slate-500"}`}>
              {trade.direction.toUpperCase()}
            </span>
          </div>
        )}

        {/* Profit sharing breakdown (only if profitable) */}
        {trade.pnl > 0 && (
          <div className="mt-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100">
            <p className="text-[10px] text-violet-600 font-semibold mb-2">PROFIT SHARING</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Your Net Profit</span>
                <span className="font-bold text-green-700">+${trade.subscriber_net.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Researcher Share</span>
                <span className="font-medium text-blue-600">${trade.researcher_share.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Platform Fee</span>
                <span className="font-medium text-slate-500">${trade.platform_share.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={onViewSharing}
          className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="pie_chart" className="text-base" />
          Sharing Ledger
        </button>
        <button
          onClick={onNewTrade}
          className="flex-1 py-2.5 bg-toll-blue text-white rounded-xl text-sm font-medium hover:bg-toll-blue-dark transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="refresh" className="text-base" />
          Trade Again
        </button>
      </div>
    </div>
  );
}
