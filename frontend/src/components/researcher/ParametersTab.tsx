"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { ai } from "@/lib/api";
import type { StrategyParameter } from "@/lib/types";

interface ParametersTabProps {
  strategyCode: string;
  onUpdateCode: (newCode: string) => void;
}

export default function ParametersTab({ strategyCode, onUpdateCode }: ParametersTabProps) {
  const [params, setParams] = useState<StrategyParameter[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const extractParams = async () => {
    setLoading(true);
    try {
      const res = await ai.extractParams(strategyCode);
      setParams(res.parameters);
      const initial: Record<string, string> = {};
      res.parameters.forEach((p) => (initial[p.name] = p.current_value));
      setEditValues(initial);
      setDirty(false);
    } catch {
      setParams([
        { name: "fast_period", current_value: "20", type: "int", description: "Fast SMA lookback window", suggested_range: "5-30" },
        { name: "slow_period", current_value: "50", type: "int", description: "Slow SMA lookback window", suggested_range: "20-200" },
        { name: "stop_loss_pct", current_value: "0.02", type: "float", description: "Stop-loss percentage", suggested_range: "0.01-0.05" },
        { name: "take_profit_pct", current_value: "0.04", type: "float", description: "Take-profit percentage", suggested_range: "0.02-0.10" },
        { name: "position_size", current_value: "0.1", type: "float", description: "Fraction of capital per trade", suggested_range: "0.05-0.25" },
      ]);
      const fallback: Record<string, string> = {};
      ["20", "50", "0.02", "0.04", "0.1"].forEach((v, i) => {
        const names = ["fast_period", "slow_period", "stop_loss_pct", "take_profit_pct", "position_size"];
        fallback[names[i]] = v;
      });
      setEditValues(fallback);
    } finally {
      setLoading(false);
    }
  };

  /* Auto-extract on mount */
  useEffect(() => {
    extractParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValueChange = (name: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  const handleApply = () => {
    // Build a new strategy code header with the parameter assignments
    const paramLines = params.map((p) => {
      const val = editValues[p.name] ?? p.current_value;
      return `${p.name} = ${val}`;
    });
    const header = `# ── Strategy Parameters ──\n${paramLines.join("\n")}\n\n`;

    // If the code already has a parameter block, replace it; otherwise prepend
    const paramBlockRegex = /# ── Strategy Parameters ──[\s\S]*?\n\n/;
    if (paramBlockRegex.test(strategyCode)) {
      onUpdateCode(strategyCode.replace(paramBlockRegex, header));
    } else {
      onUpdateCode(header + strategyCode);
    }
    setDirty(false);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "int": return "tag";
      case "float": return "decimal_increase";
      case "bool": return "toggle_on";
      default: return "text_fields";
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "int": return "text-blue-600 bg-blue-50";
      case "float": return "text-orange-600 bg-orange-50";
      case "bool": return "text-green-600 bg-green-50";
      default: return "text-slate-600 bg-slate-50";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Icon name="tune" className="text-toll-blue text-lg" />
          Tunable Parameters
        </h3>
        <button
          onClick={extractParams}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Icon name={loading ? "hourglass_top" : "refresh"} className="text-sm" />
          {loading ? "Extracting..." : "Re-extract"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
          <div className="w-5 h-5 border-2 border-toll-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-toll-blue">Gemini is extracting parameters...</span>
        </div>
      )}

      {!loading && params.length === 0 && (
        <div className="bg-slate-50 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <Icon name="tune" className="text-3xl text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No parameters found.</p>
          <p className="text-xs text-slate-400 mt-1">Add strategy code and click Re-extract.</p>
        </div>
      )}

      {/* Parameter cards */}
      {!loading && params.length > 0 && (
        <div className="space-y-3">
          {params.map((p) => (
            <div
              key={p.name}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${typeColor(p.type)}`}>
                    <Icon name={typeIcon(p.type)} className="text-sm" />
                  </div>
                  <div>
                    <span className="text-sm font-mono font-semibold text-slate-900">{p.name}</span>
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColor(p.type)}`}>
                      {p.type}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Range: {p.suggested_range}</span>
              </div>

              <p className="text-xs text-slate-500 mb-3">{p.description}</p>

              <div className="flex items-center gap-3">
                <input
                  type={p.type === "int" ? "number" : p.type === "float" ? "number" : "text"}
                  step={p.type === "float" ? "0.001" : p.type === "int" ? "1" : undefined}
                  value={editValues[p.name] ?? p.current_value}
                  onChange={(e) => handleValueChange(p.name, e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-toll-blue/20 focus:border-toll-blue"
                />
                <span className="text-xs text-slate-400">
                  default: <span className="font-mono text-slate-600">{p.current_value}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply button */}
      {!loading && params.length > 0 && (
        <div className="space-y-3 pt-2">
          <button
            onClick={handleApply}
            disabled={!dirty}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              dirty
                ? "bg-toll-blue hover:bg-toll-blue-dark text-white shadow-sm shadow-toll-blue/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Icon name="check" className="text-lg" />
            Apply Parameters to Strategy
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            This will inject the parameter values into your strategy code header.
          </p>
        </div>
      )}
    </div>
  );
}
