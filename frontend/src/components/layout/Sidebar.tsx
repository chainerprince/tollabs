"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { marketplace } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import type { PlatformStats } from "@/lib/types";

interface SidebarLink {
  href: string;
  icon: string;
  label: string;
}

const investorLinks: SidebarLink[] = [
  { href: "/investor/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/marketplace", icon: "explore", label: "Marketplace" },
  { href: "/subscriptions", icon: "library_add_check", label: "Subscriptions" },
  { href: "/investor/trades", icon: "swap_horiz", label: "Trade History" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

const researcherLinks: SidebarLink[] = [
  { href: "/researcher/studio", icon: "auto_awesome", label: "Studio" },
  { href: "/compute", icon: "code", label: "Editor" },
  { href: "/researcher/training", icon: "hub", label: "Model Hub" },
  { href: "/marketplace", icon: "storefront", label: "Marketplace" },
  { href: "/researcher/earnings", icon: "payments", label: "Earnings" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  const links = user?.role === "researcher" ? researcherLinks : investorLinks;

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
        <div className="relative" ref={menuRef}>
          {/* Popup */}
          {showUserMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{user.email.split("@")[0]}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Icon name="settings" className="text-base text-slate-400" />
                  Settings
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    router.push("/login");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Icon name="logout" className="text-base" />
                  Log out
                </button>
              </div>
            </div>
          )}

          {/* User row (clickable) */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full p-4 border-t border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-toll-blue flex items-center justify-center text-white text-xs font-bold">
              {user.email[0].toUpperCase()}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-semibold text-toll-text truncate">{user.email.split("@")[0]}</p>
              <p className="text-xs text-toll-text-light capitalize">{user.role}</p>
            </div>
            <Icon
              name="expand_more"
              className={`text-base text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
            />
          </button>
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
