"use client";

import Icon from "@/components/ui/Icon";
import type { TradingModel } from "@/lib/types";

interface ModelCardProps {
  model: TradingModel;
  onSubscribe: (modelId: number) => void;
  onViewDetails: (modelId: number) => void;
  isSubscribed?: boolean;
}

const assetConfig: Record<string, { icon: string; colorClass: string; bgClass: string; borderClass: string; barClass: string[] }> = {
  forex: {
    icon: "currency_exchange",
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-100",
    barClass: ["bg-blue-200", "bg-blue-200", "bg-blue-200", "bg-blue-200", "bg-blue-300", "bg-blue-300", "bg-blue-400", "bg-blue-500"],
  },
  stock: {
    icon: "show_chart",
    colorClass: "text-purple-600",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-100",
    barClass: ["bg-purple-200", "bg-purple-200", "bg-purple-200", "bg-purple-200", "bg-purple-300", "bg-purple-300", "bg-purple-400", "bg-purple-500"],
  },
};

function getRandomBarHeights(seed: number): number[] {
  const heights: number[] = [];
  let h = 30 + (seed % 20);
  for (let i = 0; i < 8; i++) {
    h += 5 + ((seed * (i + 1)) % 12);
    heights.push(Math.min(95, h));
  }
  return heights;
}

export default function ModelCard({ model, onSubscribe, onViewDetails, isSubscribed }: ModelCardProps) {
  const asset = assetConfig[model.asset_class] ?? assetConfig.forex;
  const winRate = model.performance_metadata?.win_rate ?? 0;
  const monthlyReturn = model.performance_metadata?.total_return_pct ?? 0;
  const subscriberCount = model.subscriber_count ?? 0;
  const barHeights = getRandomBarHeights(model.id);

  const badgeColor =
    model.asset_class === "forex"
      ? "bg-blue-50 text-blue-700"
      : "bg-purple-50 text-purple-700";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow duration-300 group">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl ${asset.bgClass} border ${asset.borderClass} flex items-center justify-center`}
          >
            <Icon name={asset.icon} className={`${asset.colorClass} text-2xl`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-toll-blue transition-colors">
              {model.name}
            </h3>
            <p className="text-sm text-toll-text-light">
              by <span className="text-slate-700 font-medium">{model.creator_email ?? `User #${model.creator_id}`}</span>
            </p>
          </div>
        </div>
        <span className={`${badgeColor} text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
          {model.asset_class}
        </span>
      </div>

      {/* Mini chart */}
      <div className="h-24 bg-slate-50 rounded-lg mb-4 relative overflow-hidden border border-slate-100 flex items-end justify-center px-3 pb-2 gap-1.5">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={`w-3 ${asset.barClass[i]} rounded-sm shrink-0`}
            style={{ height: `${h}%` }}
          />
        ))}
        <div
          className={`absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${
            monthlyReturn > 3 ? "text-accent-green" : "text-toll-text-light"
          }`}
        >
          {monthlyReturn > 0 ? "+" : ""}
          {monthlyReturn.toFixed(1)}% Return
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-toll-text-light mb-0.5">Win Rate</p>
          <p className="text-base font-bold text-slate-800">{winRate.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-xs text-toll-text-light mb-0.5">Subscribers</p>
          <p className="text-base font-bold text-slate-800">{subscriberCount}</p>
        </div>
      </div>

      {/* Backtest Metrics (shown when model has backtest data) */}
      {model.backtest_metrics && Object.keys(model.backtest_metrics).length > 0 && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="verified" className="text-sm text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Backtest Verified</span>
            {model.backtest_asset && (
              <span className="text-[9px] text-emerald-600 ml-auto">{model.backtest_asset} · {model.backtest_periods ?? 0} periods</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className={`text-sm font-bold ${((model.backtest_metrics.sharpe_ratio as number) ?? 0) > 0.5 ? "text-emerald-700" : "text-slate-600"}`}>
                {((model.backtest_metrics.sharpe_ratio as number) ?? 0).toFixed(2)}
              </p>
              <p className="text-[9px] text-emerald-600 uppercase">Sharpe</p>
            </div>
            <div>
              <p className={`text-sm font-bold ${((model.backtest_metrics.max_drawdown_pct as number) ?? 0) > -15 ? "text-emerald-700" : "text-red-500"}`}>
                {((model.backtest_metrics.max_drawdown_pct as number) ?? 0).toFixed(1)}%
              </p>
              <p className="text-[9px] text-emerald-600 uppercase">Max DD</p>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">{(model.backtest_metrics.num_trades as number) ?? 0}</p>
              <p className="text-[9px] text-emerald-600 uppercase">Trades</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-toll-text-light font-medium uppercase">
            Pricing Model
          </span>
          <span className="text-sm font-bold text-slate-800">Subscribe &amp; Share</span>
        </div>
        {isSubscribed ? (
          <button
            onClick={() => onViewDetails(model.id)}
            className="bg-green-50 text-green-700 border border-green-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-green-100 flex items-center gap-1.5"
          >
            <Icon name="check_circle" className="text-sm" />
            Subscribed
          </button>
        ) : (
          <button
            onClick={() => onSubscribe(model.id)}
            className="bg-stripe-blurple hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Subscribe
          </button>
        )}
      </div>
    </div>
  );
}
