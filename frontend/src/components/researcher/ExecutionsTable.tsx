import type { TradeRecord } from "@/lib/types";

interface ExecutionsTableProps {
  trades: TradeRecord[];
}

export default function ExecutionsTable({ trades }: ExecutionsTableProps) {
  const recentTrades = trades.slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-900">Recent Executions</h3>
        <button className="text-toll-blue text-xs font-medium hover:underline">Export CSV</button>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-toll-text-light uppercase bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Entry</th>
            <th className="px-4 py-2 font-medium">Exit</th>
            <th className="px-4 py-2 font-medium text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {recentTrades.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-toll-text-light">
                No trades yet. Run a simulation first.
              </td>
            </tr>
          ) : (
            recentTrades.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">
                  {t.entry_time ? new Date(t.entry_time).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      t.type === "long"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {t.type === "long" ? "Buy" : "Sell"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">
                  {t.entry_price?.toFixed(5) ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">
                  {t.exit_price?.toFixed(5) ?? "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-medium font-mono text-xs ${
                    (t.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {(t.pnl ?? 0) >= 0 ? "+" : ""}
                  ${Math.abs(t.pnl ?? 0).toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
