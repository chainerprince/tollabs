"use client";

import { useEffect, useState } from "react";
import { marketplace } from "@/lib/api";
import type { PlatformStats } from "@/lib/types";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function HomeStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    marketplace.getStats().then(setStats).catch(() => {});
  }, []);

  const items = stats
    ? [
        { value: fmt(stats.total_volume), label: "Volume Traded" },
        { value: String(stats.total_models), label: "Live Models" },
        { value: String(stats.active_subscribers), label: "Active Subscribers" },
        { value: fmt(stats.developer_payouts), label: "Dev Payouts" },
      ]
    : [
        { value: "—", label: "Volume Traded" },
        { value: "—", label: "Live Models" },
        { value: "—", label: "Active Subscribers" },
        { value: "—", label: "Dev Payouts" },
      ];

  return (
    <div className="mt-20 pt-10 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-70">
      {items.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-2xl font-bold text-gray-900">{s.value}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
