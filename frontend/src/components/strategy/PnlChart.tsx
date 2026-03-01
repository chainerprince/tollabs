/* Cumulative PnL chart for the strategy dashboard — dynamic from trade data */

import type { TradeRecord } from "@/lib/types";

interface PnlChartProps {
  cumulativePnl: number;
  returnPct: number;
  trades?: TradeRecord[];
}

function buildPnlPath(trades: TradeRecord[], width: number, height: number, padY = 60, padTop = 80): string {
  if (trades.length === 0) return "";
  let cum = 0;
  const points = [0];
  for (const t of trades) {
    cum += t.pnl ?? 0;
    points.push(cum);
  }
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = maxY - minY || 1;

  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = padTop + (1 - (p - minY) / range) * (height - padTop - padY);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function PnlChart({ cumulativePnl, returnPct, trades = [] }: PnlChartProps) {
  const W = 1350;
  const H = 800;
  const hasData = trades.length > 0;
  const linePath = hasData ? buildPnlPath(trades, W, H) : "";
  const fillPath = linePath ? `${linePath} L${W},${H} L0,${H} Z` : "";
  return (
    <section className="flex-1 flex flex-col relative min-w-0 bg-white">
      {/* Chart header */}
      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-slate-700">Cumulative PnL</h2>
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            {["1W", "1M", "3M", "YTD"].map((range, i) => (
              <button
                key={range}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  i === 0
                    ? "bg-white shadow-sm text-toll-blue"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-toll-blue" />
          <span>Strategy</span>
          <span className="w-2 h-2 rounded-full bg-slate-300 ml-2" />
          <span>Benchmark</span>
        </div>
      </div>

      {/* Chart body */}
      <div className="flex-1 w-full h-full relative chart-grid overflow-hidden group cursor-crosshair bg-slate-50/30">
        {/* Overlay stats */}
        <div className="absolute top-6 left-6 z-10 flex flex-col">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Net Profit (Live)
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              ${cumulativePnl.toFixed(2)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-bold flex items-center ${
                returnPct >= 0
                  ? "bg-green-100 text-accent-green"
                  : "bg-red-100 text-accent-red"
              }`}
            >
              {returnPct >= 0 ? "+" : ""}
              {returnPct.toFixed(1)}%
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1">Since inception</span>
        </div>

        {/* SVG chart */}
        {hasData ? (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#135bec" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#135bec" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#pnlGradient)" />
            <path d={linePath} fill="none" stroke="#135bec" strokeWidth="3" />
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            No trade data available
          </div>
        )}

        {/* Y-axis */}
        <div className="absolute right-0 top-14 bottom-0 w-16 border-l border-slate-100 bg-white/50 flex flex-col justify-between py-6 text-[10px] text-slate-400 font-mono text-right px-2 pointer-events-none">
          {hasData ? (
            <>
              <span>+{Math.abs(returnPct).toFixed(0)}%</span>
              <span>0%</span>
            </>
          ) : (
            <span></span>
          )}
        </div>

        {/* X-axis */}
        <div className="absolute bottom-0 left-0 right-16 h-8 border-t border-slate-100 bg-white/50 flex justify-between px-10 items-center text-[10px] text-slate-400 font-mono pointer-events-none">
          {hasData && trades.length > 0 ? (
            <>
              <span>Trade 1</span>
              <span>Trade {Math.floor(trades.length / 2)}</span>
              <span>Trade {trades.length}</span>
            </>
          ) : (
            <span></span>
          )}
        </div>
      </div>
    </section>
  );
}
