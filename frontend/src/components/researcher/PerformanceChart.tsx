/* Bar chart for earnings performance breakdown — driven by real transaction data */

import type { Transaction } from "@/lib/types";

interface PerformanceChartProps {
  transactions?: Transaction[];
}

function groupByMonth(txns: Transaction[]): { month: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    const date = new Date(t.created_at);
    const key = date.toLocaleString("default", { month: "short" });
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  // Return last 6 months or whatever we have
  const entries = Array.from(map.entries()).slice(-6);
  return entries.map(([month, revenue]) => ({ month, revenue }));
}

export default function PerformanceChart({ transactions = [] }: PerformanceChartProps) {
  const data = transactions.length > 0
    ? groupByMonth(transactions)
    : [];
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">Performance Breakdown</h3>
        <span className="text-xs text-toll-text-light font-medium">
          {data.length > 0 ? `${data.length} months` : "No data yet"}
        </span>
      </div>
      <div className="h-64 flex items-end justify-between gap-4 px-2">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Run simulations to generate performance data
          </div>
        ) : (
          data.map((d) => (
            <div key={d.month} className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full flex gap-1 items-end h-full justify-center relative">
                <div
                  className="w-3 lg:w-4 bg-toll-blue rounded-t-sm group-hover:opacity-80 transition-opacity"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-xs text-toll-text-light font-medium">{d.month}</span>
            </div>
          ))
        )}
      </div>
      {data.length > 0 && (
        <div className="mt-6 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-toll-blue" />
            <span className="text-xs text-toll-text-light font-medium">Revenue</span>
          </div>
        </div>
      )}
    </div>
  );
}
