import type { Transaction } from "@/lib/types";

interface PayoutsTableProps {
  transactions: Transaction[];
}

export default function PayoutsTable({ transactions }: PayoutsTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900">Recent Payouts</h3>
        <button className="text-sm text-toll-blue font-medium hover:underline">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-toll-text-light">
          <thead className="bg-slate-50 text-xs uppercase font-medium text-toll-text-light">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Transaction ID</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-toll-text-light">
                  No payouts yet. Deploy a model and get subscribers!
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">tx_{tx.id}</td>
                  <td className="px-6 py-4 capitalize">{tx.type.replace("_", " ")}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    ${Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Paid
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
