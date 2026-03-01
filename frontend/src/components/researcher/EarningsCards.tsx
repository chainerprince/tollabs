import Icon from "@/components/ui/Icon";

interface EarningsCardsProps {
  totalRevenue: number;
  subscriberCount: number;
  profitShared: number;
}

export default function EarningsCards({ totalRevenue, subscriberCount, profitShared }: EarningsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Revenue */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-blue-50 rounded-lg text-toll-blue">
            <Icon name="payments" className="text-2xl" />
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-toll-blue rounded-full">
            Last 30d
          </span>
        </div>
        <h3 className="text-toll-text-light text-sm font-medium uppercase tracking-wide">
          Total Revenue
        </h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">${totalRevenue.toFixed(2)}</span>
          <span className="text-sm text-toll-text-light">USD</span>
        </div>
        <p className="text-xs text-toll-text-light mt-2">Last 30 days vs previous period</p>
      </div>

      {/* Active Subscribers */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Icon name="people" className="text-2xl" />
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            Active
          </span>
        </div>
        <h3 className="text-toll-text-light text-sm font-medium uppercase tracking-wide">
          Active Subscribers
        </h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{subscriberCount}</span>
          <span className="text-sm text-toll-text-light">Users</span>
        </div>
        <p className="text-xs text-toll-text-light mt-2">Across active models</p>
      </div>

      {/* Profit Shared */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Icon name="share" className="text-8xl text-stripe-blurple" />
        </div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="p-2 bg-purple-50 rounded-lg text-stripe-blurple">
            <Icon name="pie_chart" className="text-2xl" />
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-toll-text-light rounded-full">
            All time
          </span>
        </div>
        <h3 className="text-toll-text-light text-sm font-medium uppercase tracking-wide relative z-10">
          Profit Shared
        </h3>
        <div className="mt-1 flex items-baseline gap-2 relative z-10">
          <span className="text-3xl font-bold text-slate-900">${profitShared.toFixed(2)}</span>
        </div>
        <p className="text-xs text-toll-text-light mt-2 relative z-10">Commission paid to TOLLABS</p>
      </div>
    </div>
  );
}
