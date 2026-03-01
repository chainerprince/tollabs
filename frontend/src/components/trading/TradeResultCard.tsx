"use client";

import Icon from "@/components/ui/Icon";
import type { TradeRecord2 } from "@/lib/types";

interface Props {
  trade: TradeRecord2;
  onNewTrade: () => void;
  onViewSharing: () => void;
}

export default function TradeResultCard({ trade, onNewTrade, onViewSharing }: Props) {
  const isProfit = trade.pnl >= 0;

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
      </div>

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
