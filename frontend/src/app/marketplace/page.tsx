"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ModelCard from "@/components/marketplace/ModelCard";
import FilterBar from "@/components/marketplace/FilterBar";
import Icon from "@/components/ui/Icon";
import { marketplace, subscriptions } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TradingModel } from "@/lib/types";

export default function MarketplacePage() {
  const [models, setModels] = useState<TradingModel[]>([]);
  const [filter, setFilter] = useState("All Models");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [subscribedModelIds, setSubscribedModelIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const [m, subs] = await Promise.all([
          marketplace.listModels(),
          user ? subscriptions.mySubscriptions() : Promise.resolve([]),
        ]);
        setModels(m);
        setSubscribedModelIds(
          new Set(subs.filter((s) => s.is_active).map((s) => s.model_id))
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleSubscribe = async (modelId: number) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      await subscriptions.subscribe(modelId);
      setSubscribedModelIds((prev) => new Set(prev).add(modelId));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const filtered = models.filter((m) => {
    const matchesFilter =
      filter === "All Models" ||
      m.asset_class.toLowerCase() === filter.toLowerCase();
    const matchesSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-slate-50 min-h-screen flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8 overflow-y-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Explore Models</h2>
            <p className="text-toll-text-light mt-1">
              Discover high-performance trading algorithms.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue w-64 bg-white"
              />
            </div>
          </div>
        </header>

        {/* Filters */}
        <FilterBar activeFilter={filter} onFilterChange={setFilter} />

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-toll-text-light">Loading models...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-toll-text-light">
            No models found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onSubscribe={handleSubscribe}
                onViewDetails={(id) => router.push(`/strategy/${id}`)}
                isSubscribed={subscribedModelIds.has(model.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
