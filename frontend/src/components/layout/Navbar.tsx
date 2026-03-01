"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import Icon from "@/components/ui/Icon";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-toll-blue rounded-lg flex items-center justify-center text-white">
              <Icon name="token" className="text-xl" />
            </div>
            <span className="font-bold text-xl tracking-tight">TOLLABS</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-toll-text-light">
            <Link href="/marketplace" className="hover:text-toll-blue transition-colors">
              Marketplace
            </Link>
            <Link href="/compute" className="hover:text-toll-blue transition-colors">
              Compute
            </Link>
            {user?.role === "researcher" && (
              <>
                <Link href="/researcher/dashboard" className="hover:text-toll-blue transition-colors">
                  Backtest
                </Link>
                <Link href="/researcher/earnings" className="hover:text-toll-blue transition-colors">
                  Earnings
                </Link>
              </>
            )}
          </div>

          {/* Auth actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-3 cursor-pointer">
                  <span className="text-sm font-medium text-toll-text-light group-hover:text-toll-blue transition-colors">
                    {user.email.split("@")[0]}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-toll-blue flex items-center justify-center text-white text-sm font-bold ring-2 ring-transparent group-hover:ring-toll-blue/20 transition-all">
                    {user.email[0].toUpperCase()}
                  </div>
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 py-2 w-56 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{user.email.split("@")[0]}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {user.role}
                      </span>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/subscriptions"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Icon name="library_add_check" className="text-slate-400 text-lg" />
                        My Subscriptions
                      </Link>
                      <Link
                        href="/marketplace"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Icon name="explore" className="text-slate-400 text-lg" />
                        Marketplace
                      </Link>
                    </div>
                    <div className="border-t border-slate-100 py-1">
                      <button
                        onClick={logout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                      >
                        <Icon name="logout" className="text-red-400 text-lg" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-toll-text hover:text-toll-blue"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-toll-text text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
