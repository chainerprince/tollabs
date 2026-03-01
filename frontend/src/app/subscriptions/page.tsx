"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { subscriptions } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";
import type { Subscription } from "@/lib/types";

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await subscriptions.mySubscriptions();
        setSubs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
    else setLoading(false);
  }, [user]);

  const handleCancel = async (id: number) => {
    try {
      await subscriptions.cancel(id);
      setSubs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: false } : s))
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-toll-bg min-h-screen flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-toll-text">My Subscriptions</h1>
              <p className="text-sm text-toll-text-light mt-1">
                Manage your active strategy subscriptions
              </p>
            </div>
            <button
              onClick={() => router.push("/marketplace")}
              className="flex items-center gap-2 px-4 py-2 bg-toll-blue text-white text-sm font-medium rounded-lg shadow-sm hover:bg-toll-blue-dark transition-colors"
            >
              <Icon name="add" className="text-sm" />
              Browse Models
            </button>
          </div>

          {loading ? (
            <div className="text-center text-toll-text-light py-20">Loading...</div>
          ) : !user ? (
            <div className="text-center py-20">
              <Icon name="lock" className="text-4xl text-toll-text-light mb-4" />
              <p className="text-toll-text-light mb-4">Please sign in to view your subscriptions.</p>
              <button
                onClick={() => router.push("/login")}
                className="px-4 py-2 bg-toll-blue text-white rounded-lg text-sm font-medium"
              >
                Sign In
              </button>
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-20">
              <Icon name="inbox" className="text-5xl text-slate-300 mb-4" />
              <p className="text-toll-text-light mb-4">No subscriptions yet.</p>
              <button
                onClick={() => router.push("/marketplace")}
                className="px-4 py-2 bg-toll-blue text-white rounded-lg text-sm font-medium"
              >
                Explore Marketplace
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {subs.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${
                          sub.is_active ? "bg-toll-blue" : "bg-slate-300"
                        }`}
                      >
                        <Icon name="psychology" className="text-xl" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-toll-text">
                          Model #{sub.model_id}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-toll-text-light">
                          <span>
                            Subscribed:{" "}
                            {new Date(sub.subscribed_at).toLocaleDateString()}
                          </span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              sub.is_active
                                ? "bg-green-100 text-accent-green"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sub.is_active ? "Active" : "Cancelled"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs text-toll-text-light block">
                          Cumulative PnL
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            sub.cumulative_pnl >= 0
                              ? "text-accent-green"
                              : "text-accent-red"
                          }`}
                        >
                          {sub.cumulative_pnl >= 0 ? "+" : ""}$
                          {sub.cumulative_pnl.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.is_active && (
                          <button
                            onClick={() => router.push(`/trade?sub=${sub.id}`)}
                            className="px-3 py-2 bg-gradient-to-r from-toll-blue to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-toll-blue-dark hover:to-indigo-700 transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Icon name="bolt" className="text-sm" />
                            Trade
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/strategy/${sub.model_id}`)}
                          className="px-3 py-2 bg-toll-blue/10 text-toll-blue rounded-lg text-sm font-medium hover:bg-toll-blue/20 transition-colors"
                        >
                          View
                        </button>
                        {sub.is_active && (
                          <button
                            onClick={() => handleCancel(sub.id)}
                            className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
