"use client";

import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";

export default function SettingsPage() {
  const { user } = useAuth();

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
