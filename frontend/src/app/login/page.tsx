"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth as authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Icon from "@/components/ui/Icon";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      login(res.access_token, res.user);
      router.push(res.user.role === "researcher" ? "/researcher/dashboard" : "/marketplace");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-toll-bg-alt flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-toll-blue rounded-lg flex items-center justify-center text-white">
              <Icon name="token" className="text-2xl" />
            </div>
            <span className="font-bold text-2xl tracking-tight">TOLLABS</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-sm text-toll-text-light mb-6">
            Sign in to your account to continue.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-toll-text-light mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-toll-blue font-medium hover:underline">
              Get Started
            </Link>
          </p>

          {/* Demo hints */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">Demo accounts (password: password123):</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setEmail("alice@tollabs.io"); setPassword("password123"); }}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100"
              >
                alice@tollabs.io (researcher)
              </button>
              <button
                type="button"
                onClick={() => { setEmail("bob@tollabs.io"); setPassword("password123"); }}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100"
              >
                bob@tollabs.io (researcher)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
