"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth as authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Icon from "@/components/ui/Icon";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"researcher" | "subscriber">("subscriber");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register(email, password, role);
      login(res.access_token, res.user);
      router.push(role === "researcher" ? "/researcher/dashboard" : "/investor/dashboard");
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Create an account</h2>
          <p className="text-sm text-toll-text-light mb-6">
            Join TOLLABS and start trading or sharing strategies.
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
                minLength={6}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("subscriber")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    role === "subscriber"
                      ? "border-toll-blue bg-toll-blue-light"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon name="trending_up" className={`text-2xl mb-2 ${role === "subscriber" ? "text-toll-blue" : "text-slate-400"}`} />
                  <div className="text-sm font-semibold text-slate-800">Investor</div>
                  <div className="text-xs text-toll-text-light">Subscribe to strategies</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("researcher")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    role === "researcher"
                      ? "border-toll-blue bg-toll-blue-light"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon name="science" className={`text-2xl mb-2 ${role === "researcher" ? "text-toll-blue" : "text-slate-400"}`} />
                  <div className="text-sm font-semibold text-slate-800">Researcher</div>
                  <div className="text-xs text-toll-text-light">Build & monetize models</div>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-toll-text-light mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-toll-blue font-medium hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
