"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { researcher } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import EarningsCards from "@/components/researcher/EarningsCards";
import PerformanceChart from "@/components/researcher/PerformanceChart";
import PayoutsTable from "@/components/researcher/PayoutsTable";
import StripePanel from "@/components/researcher/StripePanel";
import type { ResearcherEarnings, Transaction } from "@/lib/types";

export default function ResearcherEarningsPage() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<ResearcherEarnings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      researcher.getEarnings().catch(() => null),
      researcher.getTransactions().catch(() => []),
    ])
      .then(([e, t]) => {
        if (e) setEarnings(e);
        setTransactions(t as Transaction[]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-toll-text-light">
        Loading earnings...
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col overflow-hidden">
      {/* Top nav bar */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-toll-blue flex items-center justify-center text-white font-bold">
              <Icon name="science" className="text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">TOLLABS</h1>
              <span className="text-xs text-toll-text-light">Researcher Console</span>
            </div>
          </Link>
          <div className="h-6 w-px bg-slate-200" />
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/researcher/dashboard" className="text-toll-text-light hover:text-toll-blue transition-colors">
              Overview
            </Link>
            <span className="text-toll-blue border-b-2 border-toll-blue pb-4 -mb-4 pt-1">
              Earnings
            </span>
            <Link href="/marketplace" className="text-toll-text-light hover:text-toll-blue transition-colors">
              Models
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-toll-text-light transition-colors relative">
            <Icon name="notifications" className="text-xl" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </button>
          {user && (
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.email.split("@")[0]}</div>
                <div className="text-xs text-toll-text-light capitalize">{user.role}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-toll-blue flex items-center justify-center text-white text-sm font-bold">
                {user.email[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page header */}
            <div className="flex justify-between items-end mb-2">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Earnings Dashboard</h2>
                <p className="text-toll-text-light text-sm mt-1">
                  Track your model revenue and subscription payouts.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                  <Icon name="file_download" className="text-base" />
                  Export CSV
                </button>
                <Link
                  href="/researcher/dashboard"
                  className="px-4 py-2 bg-toll-blue hover:bg-toll-blue-dark rounded-lg text-sm font-medium text-white shadow-sm flex items-center gap-2"
                >
                  <Icon name="add" className="text-base" />
                  New Model
                </Link>
              </div>
            </div>

            {/* Cards */}
            <EarningsCards
              totalRevenue={earnings?.total_earnings ?? 0}
              subscriberCount={earnings?.num_payouts ?? 0}
              profitShared={earnings?.total_earnings ? earnings.total_earnings * 0.15 : 0}
            />

            {/* Chart + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <PerformanceChart transactions={transactions} />
                <PayoutsTable transactions={transactions} />
              </div>
              <div>
                <StripePanel models={earnings?.per_model ?? []} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
