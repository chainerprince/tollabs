"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

interface StrategyControlProps {
  isActive: boolean;
  onCancel: () => void;
}

export default function StrategyControl({ isActive, onCancel }: StrategyControlProps) {
  const [alerts, setAlerts] = useState(true);
  const [reinvest, setReinvest] = useState(false);

  return (
    <div className="p-6 border-b border-slate-200 bg-white flex-1 flex flex-col">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon name="tune" className="text-slate-400" />
        Strategy Control
      </h3>
      <div className="flex-1 space-y-4">
        {/* Status */}
        <div
          className={`p-4 rounded-xl border flex flex-col gap-3 ${
            isActive
              ? "border-green-200 bg-green-50/50"
              : "border-red-200 bg-red-50/50"
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-800">Execution Status</span>
            {isActive && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            The strategy is currently{" "}
            <strong className={isActive ? "text-green-600" : "text-red-600"}>
              {isActive ? "active" : "cancelled"}
            </strong>{" "}
            {isActive
              ? "and monitoring the market for entry signals."
              : "— subscription has been cancelled."}
          </p>
          {isActive && (
            <button
              onClick={onCancel}
              className="w-full py-2 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              Stop Execution
            </button>
          )}
        </div>

        {/* Toggle controls */}
        <div className="space-y-3 pt-2">
          {/* Alerts toggle */}
          <div className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm">
                <Icon name="notifications_active" className="text-lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">Alerts</span>
                <span className="text-xs text-slate-400">Push &amp; Email</span>
              </div>
            </div>
            <button
              onClick={() => setAlerts(!alerts)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                alerts ? "bg-toll-blue" : "bg-slate-200"
              }`}
            >
              <div
                className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white border border-gray-300 rounded-full transition-transform ${
                  alerts ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          {/* Reinvest toggle */}
          <div className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm">
                <Icon name="pie_chart" className="text-lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">Reinvest Profit</span>
                <span className="text-xs text-slate-400">Compound gains</span>
              </div>
            </div>
            <button
              onClick={() => setReinvest(!reinvest)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                reinvest ? "bg-toll-blue" : "bg-slate-200"
              }`}
            >
              <div
                className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white border border-gray-300 rounded-full transition-transform ${
                  reinvest ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
