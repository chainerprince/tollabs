/* Equity Curve SVG chart component — dynamic from trade data */

import type { TradeRecord } from "@/lib/types";

interface EquityCurveProps {
  trades?: TradeRecord[];
  totalReturnPct?: number;
}

function buildPath(trades: TradeRecord[], width: number, height: number, padY = 40): string {
  if (trades.length === 0) return "";
  // Build cumulative PnL series
  let cumulative = 0;
  const points = [0]; // start at 0
  for (const t of trades) {
    cumulative += t.pnl ?? 0;
    points.push(cumulative);
  }
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const rangeY = maxY - minY || 1;

  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = padY + (1 - (p - minY) / rangeY) * (height - 2 * padY);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function EquityCurve({ trades = [], totalReturnPct = 0 }: EquityCurveProps) {
  const W = 1200;
  const H = 350;
  const hasData = trades.length > 0;
  const linePath = hasData ? buildPath(trades, W, H) : "";
  const fillPath = linePath ? `${linePath} L${W},${H} L0,${H} Z` : "";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 h-[400px] flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Equity Curve</h2>
          <p className="text-xs text-toll-text-light">
            {hasData
              ? `${trades.length} trades \u2022 ${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}% return`
              : "Run a simulation to see results"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <div className="w-2.5 h-2.5 bg-toll-blue rounded-sm" />
            <span className="text-xs font-medium text-slate-600">Strategy PnL</span>
          </div>
        </div>
      </div>
      <div className="flex-1 relative w-full chart-grid rounded-b-xl overflow-hidden">
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            No data yet &mdash; run a backtest to generate the equity curve
          </div>
        ) : (
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Fill */}
            <path d={fillPath} fill="url(#equityGradient)" />
            {/* Line */}
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          </svg>
        )}
      </div>
    </div>
  );
}
