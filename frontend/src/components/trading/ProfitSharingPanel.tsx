"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { trading } from "@/lib/api";
import type { ProfitSharingDetail } from "@/lib/types";

export default function ProfitSharingPanel() {
  const [details, setDetails] = useState<ProfitSharingDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trading
      .getProfitSharing()
      .then(setDetails)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPnl = details.reduce((s, d) => s + d.trade_pnl, 0);
  const totalResearcherShare = details.reduce((s, d) => s + d.researcher_share, 0);
  const totalPlatformShare = details.reduce((s, d) => s + d.platform_share, 0);
  const totalNet = details.reduce((s, d) => s + d.subscriber_net, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Icon name="pie_chart" className="text-violet-600 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Profit Sharing Ledger</h3>
            <p className="text-[10px] text-slate-500">{details.length} trade{details.length !== 1 && "s"} settled</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="p-4 grid grid-cols-4 gap-3 border-b border-slate-100">
        <div className="p-3 bg-slate-50 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Total PnL</p>
          <p className={`text-sm font-bold ${totalPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="p-3 bg-green-50/50 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Your Net</p>
          <p className={`text-sm font-bold ${totalNet >= 0 ? "text-green-700" : "text-red-600"}`}>
            ${totalNet.toFixed(2)}
          </p>
        </div>
        <div className="p-3 bg-blue-50/50 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">To Researchers</p>
          <p className="text-sm font-bold text-blue-700">${totalResearcherShare.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Platform Fee</p>
          <p className="text-sm font-bold text-slate-600">${totalPlatformShare.toFixed(2)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
      ) : details.length === 0 ? (
        <div className="p-8 text-center">
          <Icon name="receipt" className="text-3xl text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No completed trades yet</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-slate-500 font-medium">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Strategy</th>
                <th className="text-right px-4 py-2">Trade PnL</th>
                <th className="text-right px-4 py-2">Researcher</th>
                <th className="text-right px-4 py-2">Platform</th>
                <th className="text-right px-4 py-2">Your Net</th>
                <th className="text-right px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {details.map((d) => (
                <tr key={d.trade_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-500 font-mono">{d.trade_id}</td>
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="font-medium text-slate-800">{d.model_name}</p>
                      <p className="text-[10px] text-slate-400">{d.researcher_email}</p>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${d.trade_pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {d.trade_pnl >= 0 ? "+" : ""}${d.trade_pnl.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-600">
                    ${d.researcher_share.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    ${d.platform_share.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${d.subscriber_net >= 0 ? "text-green-700" : "text-red-600"}`}>
                    ${d.subscriber_net.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-400">
                    {d.executed_at ? new Date(d.executed_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
