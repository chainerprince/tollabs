"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";
import type { ModalCredentialsStatus } from "@/lib/types";

export default function SettingsPage() {
  const { user, login: updateAuth, token } = useAuth();

  /* ── Modal credentials state ─────────────────────────────── */
  const [modalTokenId, setModalTokenId] = useState("");
  const [modalTokenSecret, setModalTokenSecret] = useState("");
  const [modalStatus, setModalStatus] = useState<ModalCredentialsStatus | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    auth.getModalCredentials().then(setModalStatus).catch(() => {});
  }, []);

  const handleSaveModal = async () => {
    if (!modalTokenId.trim() || !modalTokenSecret.trim()) {
      setModalMsg({ text: "Both fields are required", ok: false });
      return;
    }
    setModalSaving(true);
    setModalMsg(null);
    try {
      const res = await auth.saveModalCredentials(modalTokenId.trim(), modalTokenSecret.trim());
      setModalStatus(res);
      setModalTokenId("");
      setModalTokenSecret("");
      setModalMsg({ text: "Modal credentials saved successfully!", ok: true });
      // Update the local user to reflect has_modal_credentials
      if (user && token) {
        updateAuth(token, { ...user, has_modal_credentials: true });
      }
    } catch (e) {
      setModalMsg({ text: e instanceof Error ? e.message : "Failed to save", ok: false });
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteModal = async () => {
    try {
      await auth.deleteModalCredentials();
      setModalStatus({ has_credentials: false, modal_token_id_preview: "" });
      setModalMsg({ text: "Modal credentials removed", ok: true });
      if (user && token) {
        updateAuth(token, { ...user, has_modal_credentials: false });
      }
    } catch {
      setModalMsg({ text: "Failed to remove credentials", ok: false });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-500 mb-8">Manage your account preferences</p>

          {/* Profile Section */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="person" className="text-gray-400" />
              Profile
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
                <input
                  type="text"
                  value={user?.role === "researcher" ? "Researcher" : "Subscriber"}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm capitalize"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Display Name</label>
                <input
                  type="text"
                  defaultValue={user?.email?.split("@")[0] ?? ""}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Timezone</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent">
                  <option>UTC (GMT+0)</option>
                  <option>US/Eastern (GMT-5)</option>
                  <option>US/Central (GMT-6)</option>
                  <option>US/Pacific (GMT-8)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="notifications" className="text-gray-400" />
              Notifications
            </h2>
            <div className="space-y-4">
              {[
                { label: "Trade execution alerts", desc: "Notified when a trade is executed on your behalf", default: true },
                { label: "Profit sharing reports", desc: "Weekly summary of profit sharing settlements", default: true },
                { label: "New model launches", desc: "When researchers publish new strategies", default: false },
                { label: "System announcements", desc: "Platform updates and maintenance windows", default: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-gray-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* API Keys Section */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="key" className="text-gray-400" />
              Connected Services
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icon name="check_circle" className="text-green-600 text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Gemini AI</p>
                    <p className="text-xs text-gray-500">Strategy analysis & code generation</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Icon name="link" className="text-gray-400 text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Brokerage Account</p>
                    <p className="text-xs text-gray-500">Connect for live trading</p>
                  </div>
                </div>
                <button className="text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                  Connect
                </button>
              </div>
            </div>
          </section>

          {/* Modal GPU Credentials — Researchers only */}
          {user?.role === "researcher" && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Icon name="memory" className="text-purple-500" />
                Modal GPU Credentials
              </h2>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                Connect your{" "}
                <a
                  href="https://modal.com/settings#tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline font-medium"
                >
                  Modal account
                </a>{" "}
                to run training and fine-tuning on real GPUs. Your credentials are stored securely and used only for compute on your behalf.
              </p>

              {/* Current status */}
              {modalStatus?.has_credentials && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Icon name="check_circle" className="text-green-600 text-sm" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">Modal Connected</p>
                      <p className="text-xs text-green-600 font-mono">
                        Token: {modalStatus.modal_token_id_preview}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteModal}
                    className="text-xs font-medium text-red-600 bg-white border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {/* Input fields */}
              {!modalStatus?.has_credentials && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Token ID
                    </label>
                    <input
                      type="text"
                      value={modalTokenId}
                      onChange={(e) => setModalTokenId(e.target.value)}
                      placeholder="ak-..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Token Secret
                    </label>
                    <input
                      type="password"
                      value={modalTokenSecret}
                      onChange={(e) => setModalTokenSecret(e.target.value)}
                      placeholder="as-..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                    />
                  </div>
                  <button
                    onClick={handleSaveModal}
                    disabled={modalSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Icon name={modalSaving ? "hourglass_empty" : "vpn_key"} className="text-base" />
                    {modalSaving ? "Saving..." : "Save Credentials"}
                  </button>
                </div>
              )}

              {modalMsg && (
                <p className={`text-xs font-medium ${modalMsg.ok ? "text-green-600" : "text-red-600"}`}>
                  {modalMsg.text}
                </p>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">How to get credentials:</strong> Go to{" "}
                  <a
                    href="https://modal.com/settings#tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline"
                  >
                    modal.com/settings → Tokens
                  </a>
                  , click &quot;Create new token&quot;, and copy the Token ID and Token Secret.
                </p>
              </div>
            </section>
          )}

          {/* Danger Zone */}
          <section className="bg-white rounded-xl border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete account</p>
                <p className="text-xs text-gray-500">Permanently remove your account and all data</p>
              </div>
              <button className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">
                Delete Account
              </button>
            </div>
          </section>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <button className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
