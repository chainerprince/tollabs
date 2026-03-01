import Icon from "@/components/ui/Icon";
import type { PerformanceMetadata } from "@/lib/types";

interface MetricsGridProps {
  metrics: PerformanceMetadata;
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  const totalReturn = metrics.total_return_pct ?? 0;
  const cards = [
    {
      icon: "trending_up",
      iconBg: "bg-blue-50",
      iconColor: "text-toll-blue",
      label: "Total Return",
      value: `${totalReturn.toFixed(1)}%`,
      badge: totalReturn >= 0 ? "Positive" : "Negative",
      badgeClass: totalReturn >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50",
    },
    {
      icon: "water_loss",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      label: "Max Drawdown",
      value: `-${(metrics.max_drawdown_pct ?? 0).toFixed(1)}%`,
      badge: (metrics.max_drawdown_pct ?? 0) < 10 ? "Low Risk" : "High Risk",
      badgeClass: (metrics.max_drawdown_pct ?? 0) < 10 ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50",
    },
    {
      icon: "psychology",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      label: "Sharpe Ratio",
      value: (metrics.sharpe_ratio ?? 0).toFixed(2),
      badge: (metrics.sharpe_ratio ?? 0) > 1 ? "Good" : (metrics.sharpe_ratio ?? 0) > 0 ? "Fair" : "Poor",
      badgeClass: (metrics.sharpe_ratio ?? 0) > 1 ? "text-green-600 bg-green-50" : "text-slate-500 bg-slate-50",
    },
    {
      icon: "receipt_long",
      iconBg: "bg-slate-50",
      iconColor: "text-slate-600",
      label: "Trades",
      value: String(metrics.num_trades ?? 0),
      badge: `Win Rate: ${(metrics.win_rate ?? 0).toFixed(0)}%`,
      badgeClass: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-1.5 ${c.iconBg} rounded-md ${c.iconColor} shrink-0`}>
              <Icon name={c.icon} className="text-lg" />
            </div>
            <span className="text-xs font-medium text-toll-text-light uppercase tracking-wider truncate">
              {c.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-slate-900 shrink-0">{c.value}</span>
            <span className={`text-xs font-medium ${c.badgeClass} px-1.5 py-0.5 rounded whitespace-nowrap`}>
              {c.badge}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
