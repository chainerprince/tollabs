import Icon from "@/components/ui/Icon";
import type { ModelEarning } from "@/lib/types";

interface StripePanelProps {
  models: ModelEarning[];
}

export default function StripePanel({ models }: StripePanelProps) {
  return (
    <div className="space-y-6">
      {/* Stripe Connect card */}
      <div className="bg-gradient-to-br from-[#635bff] to-[#4e45e5] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-bold text-xl tracking-tight">Stripe</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded font-medium">Connect</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Get paid faster</h3>
          <p className="text-blue-100 text-sm mb-6">
            Connect your bank account to receive automated daily payouts for your model subscriptions.
          </p>
          <div className="flex flex-col gap-3">
            {["Instant identity verification", "Global bank transfers", "Automated tax forms"].map(
              (f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-blue-50">
                  <Icon name="check_circle" className="text-base" />
                  <span>{f}</span>
                </div>
              )
            )}
          </div>
          <button className="mt-6 w-full py-2.5 bg-white text-[#635bff] rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
            Complete Setup
            <Icon name="arrow_forward" className="text-sm" />
          </button>
        </div>
      </div>

      {/* Top performing models */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4">Top Performing Models</h3>
        <div className="space-y-4">
          {models.map((m, i) => {
            const colors = ["orange", "blue", "purple", "green"];
            const c = colors[i % colors.length];
            const maxEarned = Math.max(...models.map((x) => x.total_earned), 1);
            const pct = (m.total_earned / maxEarned) * 100;

            return (
              <div key={m.model_id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded bg-${c}-100 flex items-center justify-center text-${c}-600`}>
                      <Icon name="show_chart" className="text-sm" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{m.model_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      ${m.total_earned.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-toll-blue h-1.5 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {models.length === 0 && (
            <p className="text-sm text-toll-text-light">No model earnings yet.</p>
          )}
        </div>
      </div>

      {/* Payout schedule */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4">Payout Schedule</h3>
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mb-1" />
            <div className="w-0.5 h-10 bg-gray-200" />
            <div className="w-2 h-2 bg-gray-300 rounded-full" />
          </div>
          <div>
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-900">Next Payout</p>
              <p className="text-xs text-toll-text-light">Est. Weekly</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Following Payout</p>
              <p className="text-xs text-toll-text-light">Est. 2 weeks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
