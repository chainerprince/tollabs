"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { ai } from "@/lib/api";

/* ── Preset strategy snippets ────────────────────────────────── */
const PRESETS = [
  {
    label: "SMA Crossover",
    icon: "trending_up",
    description: "Buy when the 20-period SMA crosses above the 50-period SMA, sell when it crosses below. Stop loss at 2%.",
  },
  {
    label: "Mean Reversion",
    icon: "swap_vert",
    description: "Buy when price drops 2 standard deviations below the 20-period mean, sell when it returns to the mean. Stop loss at 3%.",
  },
  {
    label: "Breakout",
    icon: "north_east",
    description: "Buy when price breaks above the 20-period high, sell when it drops below the 10-period low. Stop loss at 1.5%.",
  },
  {
    label: "RSI Strategy",
    icon: "speed",
    description: "Buy when 14-period RSI drops below 30 (oversold), sell when RSI rises above 70 (overbought). Stop loss at 2%.",
  },
  {
    label: "MACD Signal",
    icon: "stacked_line_chart",
    description: "Buy when the MACD line crosses above the signal line and histogram is positive. Sell when MACD crosses below signal. Stop loss at 2.5%.",
  },
  {
    label: "Price Level",
    icon: "price_check",
    description: "Buy at 50, sell at 55. Stop loss at 48. Take profit at 57.",
  },
];

/* ── Building block chips ────────────────────────────────────── */
const BUILDING_BLOCKS: { label: string; insert: string }[] = [
  { label: "Buy at price", insert: "Buy when price reaches $" },
  { label: "Sell at price", insert: "Sell when price reaches $" },
  { label: "Stop loss", insert: "Stop loss at " },
  { label: "Take profit", insert: "Take profit at " },
  { label: "SMA crossover", insert: "Buy when the short SMA crosses above the long SMA" },
  { label: "RSI oversold", insert: "Buy when RSI drops below 30" },
  { label: "RSI overbought", insert: "Sell when RSI rises above 70" },
  { label: "Trailing stop", insert: "Use a trailing stop loss of " },
  { label: "Position size", insert: "Use position size of " },
  { label: "Bollinger Bands", insert: "Buy when price touches the lower Bollinger Band, sell at the upper band" },
  { label: "Volume filter", insert: "Only trade when volume is above the 20-period average" },
  { label: "Time filter", insert: "Only trade during market hours" },
];

/* ── Flow steps ──────────────────────────────────────────────── */
type Step = "describe" | "review" | "ready";

interface Props {
  asset: string;
  onCodeGenerated: (code: string) => void;
  onBacktest: () => void;
}

export default function StrategyBuilder({ asset, onCodeGenerated, onBacktest }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleExpandToNotebook = () => {
    // Store strategy code + metadata for the compute page to pick up
    localStorage.setItem("tollabs_strategy_code", generatedCode);
    localStorage.setItem("tollabs_strategy_summary", summary);
    localStorage.setItem("tollabs_strategy_description", description);
    router.push("/compute?strategy=1");
  };

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const result = await ai.buildStrategy(description, asset);
      setGeneratedCode(result.code);
      setSummary(result.summary);
      onCodeGenerated(result.code);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate strategy");
    } finally {
      setGenerating(false);
    }
  }, [description, asset, onCodeGenerated]);

  const handlePreset = (desc: string) => {
    setDescription(desc);
  };

  const handleInsertBlock = (text: string) => {
    setDescription((prev) => {
      const separator = prev.trim() ? ". " : "";
      return prev.trim() + separator + text;
    });
  };

  const handleEdit = () => {
    setStep("describe");
  };

  const handleAcceptAndBacktest = () => {
    setStep("ready");
    onBacktest();
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        {(["describe", "review", "ready"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-px ${step === s || (s === "review" && step === "ready") || (s === "describe") ? "bg-toll-blue" : "bg-slate-200"}`} />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === s
                    ? "bg-toll-blue text-white"
                    : step === "ready" || (step === "review" && s === "describe")
                    ? "bg-green-100 text-green-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {step === "ready" || (step === "review" && s === "describe") ? (
                  <Icon name="check" className="text-xs" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10px] font-medium ${step === s ? "text-toll-blue" : "text-slate-400"}`}>
                {s === "describe" ? "Describe" : s === "review" ? "Review" : "Backtest"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 1: Describe strategy ─────────────────────── */}
      {step === "describe" && (
        <div className="space-y-4">
          {/* NL input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-2 block">
              Describe your strategy in plain English
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Buy when the price drops to 50 and sell when it reaches 55. Set a stop loss at 48 and take profit at 57. Only go long, no shorting."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm leading-relaxed focus:border-toll-blue focus:ring focus:ring-toll-blue/20 resize-none bg-white min-h-[100px]"
              rows={4}
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Include entry/exit conditions, stop loss, take profit, position sizing, and any other rules.
            </p>
          </div>

          {/* Building blocks */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick add
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUILDING_BLOCKS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => handleInsertBlock(b.insert)}
                  className="text-[10px] px-2.5 py-1.5 bg-slate-50 hover:bg-toll-blue-light hover:text-toll-blue text-slate-600 rounded-full border border-slate-200 hover:border-toll-blue/30 transition-colors font-medium"
                >
                  + {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Strategy templates
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.description)}
                  className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-left transition-all group ${
                    description === p.description
                      ? "border-toll-blue bg-toll-blue-light"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    description === p.description
                      ? "bg-toll-blue text-white"
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  }`}>
                    <Icon name={p.icon} className="text-sm" />
                  </div>
                  <span className={`text-[11px] font-medium leading-tight ${
                    description === p.description ? "text-toll-blue" : "text-slate-700"
                  }`}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200">
              <Icon name="error" className="text-sm" />
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-toll-blue/20 disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating strategy code...
              </>
            ) : (
              <>
                <Icon name="auto_awesome" className="text-lg" />
                Generate Strategy Code
              </>
            )}
          </button>
        </div>
      )}

      {/* ── STEP 2: Review generated code ─────────────────── */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Summary */}
          {summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="lightbulb" className="text-blue-600 text-sm" />
                <span className="text-[11px] font-semibold text-blue-700">Strategy Summary</span>
              </div>
              <div className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">
                {summary}
              </div>
            </div>
          )}

          {/* Code preview */}
          <div className="relative">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-t-lg border border-slate-700 border-b-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">strategy.py</span>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Generated
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExpandToNotebook}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                  title="Open in Cloud Notebook with cells"
                >
                  <Icon name="open_in_new" className="text-sm" />
                  Open in Notebook
                </button>
                <button
                  onClick={handleEdit}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
                >
                  <Icon name="edit" className="text-sm" />
                  Edit prompt
                </button>
              </div>
            </div>
            <div className={`bg-slate-900 rounded-b-lg border border-slate-700 border-t-0 overflow-hidden transition-all ${
              expanded ? "max-h-[600px]" : "max-h-[200px]"
            }`}>
              <textarea
                value={generatedCode}
                onChange={(e) => {
                  setGeneratedCode(e.target.value);
                  onCodeGenerated(e.target.value);
                }}
                className="w-full p-3 bg-transparent text-xs font-mono leading-relaxed text-green-300 resize-none focus:outline-none min-h-[200px]"
                style={{ height: expanded ? "auto" : "200px" }}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Detected parameters */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Your rules</p>
            <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Icon name="arrow_back" className="text-sm" />
              Modify
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-toll-blue text-toll-blue hover:bg-toll-blue-light rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Icon name="refresh" className="text-sm" />
              Regenerate
            </button>
            <button
              onClick={handleAcceptAndBacktest}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-green-600/20"
            >
              <Icon name="play_arrow" className="text-sm" />
              Accept & Backtest
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Ready / confirmation ──────────────────── */}
      {step === "ready" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Icon name="check_circle" className="text-green-600 text-2xl" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Strategy code applied</p>
              <p className="text-xs text-green-600 mt-0.5">
                Backtest is running with your generated strategy. Check the results panel →
              </p>
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Active strategy</p>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{summary}</div>
            </div>
          )}

          {/* Collapsed code preview */}
          <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">strategy.py</span>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Running
                </span>
              </div>
              <button
                onClick={handleExpandToNotebook}
                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                title="Open in Cloud Notebook"
              >
                <Icon name="open_in_new" className="text-sm" />
                <span>Open in Notebook</span>
              </button>
            </div>
            <pre className={`p-3 text-xs font-mono text-slate-300 overflow-auto transition-all ${
              expanded ? "max-h-[400px]" : "max-h-[100px]"
            }`}>
              {generatedCode}
            </pre>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Icon name="edit" className="text-sm" />
              Edit Strategy
            </button>
            <button
              onClick={onBacktest}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Icon name="replay" className="text-sm" />
              Run Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
