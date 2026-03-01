import Icon from "@/components/ui/Icon";
import type { PerformanceMetadata } from "@/lib/types";

interface StatsBarProps {
  metrics: PerformanceMetadata;
}

export default function StatsBar({ metrics }: StatsBarProps) {
  return (
    <div className="h-auto md:h-32 bg-white border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 shrink-0">
      {/* Win Rate */}
      <div className="p-5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Win Rate
        </span>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold text-slate-800">
            {(metrics.win_rate ?? 0).toFixed(0)}%
          </span>
          <span className="text-xs text-slate-400 mb-1">Last 30 days</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-toll-blue h-full rounded-full"
            style={{ width: `${metrics.win_rate ?? 0}%` }}
          />
        </div>
      </div>

      {/* Sharpe */}
      <div className="p-5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Sharpe Ratio
        </span>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold text-slate-800">
            {(metrics.sharpe_ratio ?? 0).toFixed(2)}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              (metrics.sharpe_ratio ?? 0) > 1.5
                ? "bg-green-50 text-accent-green"
                : "bg-yellow-50 text-yellow-600"
            }`}
          >
            {(metrics.sharpe_ratio ?? 0) > 1.5 ? "EXCELLENT" : "MODERATE"}
          </span>
        </div>
        <span className="text-xs text-slate-400">Risk-adjusted return metric</span>
      </div>

      {/* Max Drawdown */}
      <div className="p-5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Max Drawdown
        </span>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-2xl font-bold text-slate-800">
            -{(metrics.max_drawdown_pct ?? 0).toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400 mb-1">
            {(metrics.max_drawdown_pct ?? 0) < 10 ? "Low Risk" : "High Risk"} Profile
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-slate-300 h-full rounded-full"
            style={{ width: `${Math.min(100, (metrics.max_drawdown_pct ?? 0) * 3)}%` }}
          />
        </div>
      </div>

      {/* Stripe badge */}
      <div className="p-5 flex items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-stripe-blurple font-medium text-xs mb-1">
            <Icon name="verified" className="text-sm" />
            <span>Profit Sharing Active</span>
          </div>
          <p className="text-[10px] text-slate-400 max-w-[140px] mx-auto leading-tight">
            Payments processed securely via Stripe Connect.
          </p>
        </div>
      </div>
    </div>
  );
}
