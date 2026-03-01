"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { marketplace } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import type { PlatformStats } from "@/lib/types";

interface SidebarLink {
  href: string;
  icon: string;
  label: string;
}

const subscriberLinks: SidebarLink[] = [
  { href: "/marketplace", icon: "explore", label: "Explore" },
  { href: "/subscriptions", icon: "library_add_check", label: "My Subscriptions" },
];

const researcherLinks: SidebarLink[] = [
  { href: "/researcher/studio", icon: "labs", label: "Studio" },
  { href: "/marketplace", icon: "storefront", label: "Marketplace" },
  { href: "/researcher/earnings", icon: "payments", label: "Earnings" },
  { href: "/compute", icon: "code", label: "Editor" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const links = user?.role === "researcher" ? researcherLinks : subscriberLinks;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed inset-y-0 z-20">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-toll-blue flex items-center justify-center text-white font-bold text-lg">
          T
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">TOLLABS</h1>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? "bg-slate-50 text-toll-blue font-semibold"
                  : "text-toll-text-light hover:text-toll-text hover:bg-slate-50"
              }`}
            >
              <Icon name={link.icon} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Platform Stats — fetched from API */}
      <SidebarStats />

      {/* User */}
      {user && (
        <div className="p-4 border-t border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-toll-blue flex items-center justify-center text-white text-xs font-bold">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-toll-text">{user.email.split("@")[0]}</p>
            <p className="text-xs text-toll-text-light capitalize">{user.role}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    marketplace.getStats().then(setStats).catch(() => {});
  }, []);

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(1)}k`
        : `$${n.toFixed(2)}`;

  return (
    <div className="p-4 border-t border-slate-100">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h4 className="text-xs font-semibold text-toll-text-light uppercase tracking-wider mb-3">
          Platform Stats
        </h4>
        {stats ? (
          <>
            <div className="mb-4">
              <p className="text-[10px] text-toll-text-light mb-1">Total Volume</p>
              <p className="text-lg font-bold text-accent-green">{fmt(stats.total_volume)}</p>
            </div>
            <div className="mb-4">
              <p className="text-[10px] text-toll-text-light mb-1">Developer Payouts</p>
              <p className="text-lg font-bold text-slate-800">{fmt(stats.developer_payouts)}</p>
            </div>
            <div className="flex gap-4 text-[10px] text-toll-text-light">
              <span>{stats.total_models} Models</span>
              <span>{stats.active_subscribers} Subscribers</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">Loading...</p>
        )}
      </div>
    </div>
  );
}
