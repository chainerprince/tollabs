"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import EquityCurve from "@/components/researcher/EquityCurve";
import MetricsGrid from "@/components/researcher/MetricsGrid";
import ExecutionsTable from "@/components/researcher/ExecutionsTable";
import StrategyTab from "@/components/researcher/StrategyTab";
import ParametersTab from "@/components/researcher/ParametersTab";
import StrategyBuilder from "@/components/researcher/StrategyBuilder";
import Icon from "@/components/ui/Icon";
import { backtest, training, ai, compute } from "@/lib/api";
import type {
  BacktestResult,
  PerformanceMetadata,
  TradeRecord,
  ModelArtifact,
} from "@/lib/types";

type StartMode = "scratch" | "model" | "template" | null;

/* ── Classic strategy presets ─────────────────────────────────── */
const CLASSIC_PRESETS = [
  {
    label: "SMA Crossover",
    icon: "trending_up",
    desc: "Buy when the 20-period SMA crosses above the 50-period SMA, sell when it crosses below. Stop loss at 2%.",
    color: "border-blue-200 bg-blue-50",
  },
  {
    label: "Mean Reversion",
    icon: "swap_vert",
    desc: "Buy when price drops 2 standard deviations below the 20-period mean, sell when it returns to the mean. Stop loss at 3%.",
    color: "border-violet-200 bg-violet-50",
  },
  {
    label: "Breakout",
    icon: "north_east",
    desc: "Buy when price breaks above the 20-period high, sell when it drops below the 10-period low. Stop loss at 1.5%.",
    color: "border-emerald-200 bg-emerald-50",
  },
  {
    label: "RSI Strategy",
    icon: "speed",
    desc: "Buy when 14-period RSI drops below 30 (oversold), sell when RSI rises above 70 (overbought). Stop loss at 2%.",
    color: "border-amber-200 bg-amber-50",
  },
  {
    label: "MACD Signal",
    icon: "stacked_line_chart",
    desc: "Buy when the MACD line crosses above the signal line and histogram is positive. Sell when MACD crosses below signal. Stop loss at 2.5%.",
    color: "border-rose-200 bg-rose-50",
  },
  {
    label: "Bollinger Band Bounce",
    icon: "stacked_bar_chart",
    desc: "Buy when price touches the lower Bollinger Band, sell at the upper band. Use 20-period, 2 std deviation bands. Stop loss at 2%.",
    color: "border-cyan-200 bg-cyan-50",
  },
];

/* ── Wizard steps ─────────────────────────────────────────────── */
const STEPS = [
  { key: "choose", label: "Choose", icon: "explore", desc: "Pick a starting point" },
  { key: "build", label: "Build", icon: "construction", desc: "Describe your strategy" },
  { key: "configure", label: "Configure", icon: "tune", desc: "Data & parameters" },
  { key: "backtest", label: "Backtest", icon: "science", desc: "Run & analyze" },
  { key: "publish", label: "Publish", icon: "publish", desc: "Deploy to marketplace" },
] as const;

type Step = (typeof STEPS)[number]["key"];

/* ── Quick-start templates ────────────────────────────────────── */
const TEMPLATES = [
  {
    id: "scratch",
    label: "Start from scratch",
    icon: "edit_note",
    desc: "Describe your strategy in plain English and we'll generate the code.",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "model",
    label: "Use a fine-tuned model",
    icon: "smart_toy",
    desc: "Select one of your trained models as the signal source.",
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    id: "template",
    label: "Classic strategy template",
    icon: "auto_awesome",
    desc: "Start with a proven strategy pattern and customise it.",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    id: "editor",
    label: "Open the Editor",
    icon: "code",
    desc: "Write Python from a blank notebook with full GPU access.",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
];

export default function StudioPage() {
  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────── */
  const [step, setStep] = useState<Step>("choose");
  const [startMode, setStartMode] = useState<StartMode>(null);
  const [asset, setAsset] = useState("EUR/USD");
  const [periods, setPeriods] = useState(500);
  const [strategyCode, setStrategyCode] = useState("");
  const [running, setRunning] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetadata>({});
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ModelArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState("");
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [openingInEditor, setOpeningInEditor] = useState(false);
  const [configTab, setConfigTab] = useState<"data" | "strategy" | "parameters">("data");

  const handleOpenInEditor = async () => {
    if (!strategyCode) return;
    setOpeningInEditor(true);
    try {
      const label = startMode === "model" && selectedArtifact
        ? selectedArtifact.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "strategy"
        : `studio-strategy-${Date.now().toString(36)}`;
      const project = await compute.createProjectFromCode({
        name: label,
        code: strategyCode,
        description: `Strategy created in Studio (${startMode} mode)`,
      });
      router.push(`/compute?project=${project.slug}`);
    } catch {
      setOpeningInEditor(false);
    }
  };

  useEffect(() => {
    training.listArtifacts().then(setArtifacts).catch(() => {});
  }, []);

  /* ── Backtest ───────────────────────────────────────────────── */
  const runSimulation = async () => {
    setRunning(true);
    try {
      const r = await backtest.run({
        strategy_code: strategyCode,
        asset,
        periods,
        volatility: 0.01,
      });
      setResult(r);
      setMetrics(r.metrics);
      setTrades(r.trades);
      setStep("backtest");
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  };
  const goPrev = () => {
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-900">Researcher Studio</h1>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-toll-blue rounded-full border border-blue-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-semibold tracking-wide uppercase">Ready</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {step !== "choose" && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Icon name="arrow_back" className="text-base" />
                Back
              </button>
            )}
            {step === "build" && (
              <button
                onClick={() => { if (strategyCode) goNext(); }}
                disabled={!strategyCode}
                className="flex items-center gap-2 px-4 py-2 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              >
                Configure →
              </button>
            )}
            {step === "configure" && (
              <button
                onClick={runSimulation}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-toll-blue/20 disabled:opacity-50"
              >
                <Icon name="play_arrow" className="text-[18px]" />
                {running ? "Running…" : "Run Backtest"}
              </button>
            )}
            {step === "backtest" && result && (
              <button
                onClick={() => setStep("publish")}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Icon name="publish" className="text-[18px]" />
                Publish →
              </button>
            )}
          </div>
        </header>

        {/* ── Step indicators ─────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 px-6">
          <div className="flex items-center gap-1 py-2">
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = s.key === step;
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`w-8 h-px ${done ? "bg-toll-blue" : "bg-slate-200"}`} />
                  )}
                  <button
                    onClick={() => setStep(s.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? "bg-toll-blue/10 text-toll-blue"
                        : done
                          ? "text-toll-blue hover:bg-blue-50"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        active
                          ? "bg-toll-blue text-white"
                          : done
                            ? "bg-toll-blue/20 text-toll-blue"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {done ? (
                        <Icon name="check" className="text-sm" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step content ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Choose ──────────────────────────────────── */}
          {step === "choose" && (
            <div className="max-w-3xl mx-auto px-6 py-12">
              <div className="text-center mb-10">
                <div className="w-14 h-14 mx-auto mb-4 bg-toll-blue/10 rounded-2xl flex items-center justify-center">
                  <Icon name="rocket_launch" className="text-2xl text-toll-blue" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">How would you like to start?</h2>
                <p className="text-sm text-slate-500">Pick a starting point and we&apos;ll guide you through the rest.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "editor") {
                        router.push("/compute");
                      } else if (t.id === "scratch") {
                        setStartMode("scratch");
                        setStep("build");
                      } else if (t.id === "model") {
                        setStartMode("model");
                        setStep("build");
                      } else if (t.id === "template") {
                        setStartMode("template");
                        setStep("build");
                      }
                    }}
                    className={`border rounded-xl p-5 text-left hover:shadow-md transition-all group ${t.color}`}
                  >
                    <Icon name={t.icon} className="text-2xl mb-3 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-sm font-bold mb-1">{t.label}</h3>
                    <p className="text-xs opacity-70 leading-relaxed">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Build ───────────────────────────────────── */}
          {step === "build" && (
            <div className="max-w-2xl mx-auto px-6 py-8">
              {/* ── Scratch mode: NL strategy builder ──────────── */}
              {startMode === "scratch" && (
                <>
                  <h2 className="text-base font-bold text-slate-900 mb-1">Build Your Strategy</h2>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Describe your trading strategy in plain English and we&apos;ll generate the code.
                  </p>
                  <StrategyBuilder
                    asset={asset}
                    onCodeGenerated={(code) => setStrategyCode(code)}
                    onBacktest={() => goNext()}
                  />
                </>
              )}

              {/* ── Model mode: pick a fine-tuned model ────────── */}
              {startMode === "model" && (
                <>
                  <h2 className="text-base font-bold text-slate-900 mb-1">Select a Fine-Tuned Model</h2>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Choose one of your trained models to use as the signal source for your strategy.
                  </p>

                  {artifacts.length > 0 ? (
                    <div className="space-y-3">
                      {artifacts.map((a) => {
                        const isSelected = selectedArtifact === a.path;
                        return (
                          <button
                            key={a.path}
                            onClick={() => {
                              setSelectedArtifact(a.path);
                              setStrategyCode(
                                `# Using fine-tuned model: ${a.filename}\nimport json, pathlib\nmodel_path = pathlib.Path("${a.path}")\nmodel_config = json.loads(model_path.read_text())\n\n# Strategy using the fine-tuned model predictions\ndef on_tick(tick):\n    # sentiment = model.predict(tick.headline)\n    # if sentiment > 0.7: buy()\n    # if sentiment < 0.3: sell()\n    pass\n`
                              );
                            }}
                            className={`w-full text-left border rounded-xl p-4 transition-all ${
                              isSelected
                                ? "border-purple-400 bg-purple-50 ring-2 ring-purple-400/30"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isSelected ? "bg-purple-100" : "bg-slate-100"
                              }`}>
                                <Icon name="smart_toy" className={`text-lg ${
                                  isSelected ? "text-purple-600" : "text-slate-400"
                                }`} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{a.filename}</p>
                                <p className="text-[11px] text-slate-500 font-mono">{a.path}</p>
                              </div>
                              {isSelected && (
                                <Icon name="check_circle" className="text-purple-500 text-lg ml-auto" />
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {selectedArtifact && (
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() => goNext()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Continue with this model →
                          </button>
                          <button
                            onClick={handleOpenInEditor}
                            disabled={openingInEditor}
                            className="flex items-center gap-2 px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <Icon name="code" className="text-base" />
                            {openingInEditor ? "Opening…" : "Open in Editor"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Icon name="smart_toy" className="text-4xl text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500 mb-4">No fine-tuned models yet.</p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => router.push("/researcher/training")}
                          className="text-sm text-toll-blue hover:underline font-medium flex items-center gap-1"
                        >
                          <Icon name="hub" className="text-base" />
                          Go to Model Hub
                        </button>
                        <span className="text-slate-300">or</span>
                        <button
                          onClick={() => { setStartMode("scratch"); }}
                          className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                        >
                          Start from scratch instead →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Template mode: pick a classic preset ────────── */}
              {startMode === "template" && (
                <>
                  <h2 className="text-base font-bold text-slate-900 mb-1">Classic Strategy Templates</h2>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Pick a proven pattern. We&apos;ll generate production-ready code that you can customise.
                  </p>

                  {generatingTemplate && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                      <div className="w-5 h-5 border-2 border-toll-blue border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-700 font-medium">Generating strategy code…</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CLASSIC_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        disabled={generatingTemplate}
                        onClick={async () => {
                          setGeneratingTemplate(true);
                          try {
                            const result = await ai.buildStrategy(preset.desc, asset);
                            setStrategyCode(result.code);
                            setGeneratingTemplate(false);
                            goNext();
                          } catch {
                            setGeneratingTemplate(false);
                          }
                        }}
                        className={`border rounded-xl p-4 text-left hover:shadow-md transition-all disabled:opacity-50 ${preset.color}`}
                      >
                        <Icon name={preset.icon} className="text-xl mb-2 text-slate-600" />
                        <h3 className="text-sm font-bold text-slate-900 mb-1">{preset.label}</h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{preset.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Show generated code preview (all modes) */}
              {strategyCode && startMode !== "template" && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Icon name="code" className="text-base text-slate-400" />
                      Generated Code
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleOpenInEditor}
                        disabled={openingInEditor}
                        className="text-xs text-toll-blue hover:text-toll-blue-dark font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Icon name="open_in_new" className="text-sm" />
                        {openingInEditor ? "Opening…" : "Open in Editor"}
                      </button>
                      <button
                        onClick={() => setCodeExpanded(!codeExpanded)}
                        className="text-xs text-slate-400 hover:text-toll-blue flex items-center gap-1 transition-colors"
                      >
                        <Icon name={codeExpanded ? "unfold_less" : "unfold_more"} className="text-sm" />
                        {codeExpanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">strategy.py</span>
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Ready
                      </span>
                    </div>
                    <textarea
                      value={strategyCode}
                      onChange={(e) => setStrategyCode(e.target.value)}
                      className={`w-full p-3 bg-transparent text-xs font-mono leading-relaxed text-slate-300 resize-none focus:outline-none transition-all ${
                        codeExpanded ? "h-80" : "h-32"
                      }`}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Configure ───────────────────────────────── */}
          {step === "configure" && (
            <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 140px)" }}>
              {/* Side tabs */}
              <div className="w-[400px] flex flex-col border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
                <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                  {(
                    [
                      { key: "data" as const, label: "Data", icon: "cloud_download" },
                      { key: "strategy" as const, label: "Analyze", icon: "auto_awesome" },
                      { key: "parameters" as const, label: "Params", icon: "tune" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setConfigTab(tab.key)}
                      className={`flex-1 px-3 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                        configTab === tab.key
                          ? "text-toll-blue border-toll-blue"
                          : "text-toll-text-light border-transparent hover:text-slate-900"
                      }`}
                    >
                      <Icon name={tab.icon} className="text-base" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {configTab === "data" && (
                  <div className="p-5 space-y-6">
                    <section>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Icon name="cloud_download" className="text-toll-text-light text-lg" />
                        Historical Tick Data
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: "EUR/USD", type: "Forex" },
                          { id: "AAPL", type: "Stocks" },
                        ].map((a) => (
                          <label
                            key={a.id}
                            onClick={() => setAsset(a.id)}
                            className={`cursor-pointer border rounded-lg p-3 flex flex-col gap-1 transition-all ${
                              asset === a.id
                                ? "border-toll-blue bg-toll-blue-light ring-1 ring-toll-blue/50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <span className={`text-xs font-bold uppercase ${asset === a.id ? "text-toll-blue" : "text-toll-text-light"}`}>
                              {a.type}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{a.id}</span>
                          </label>
                        ))}
                      </div>

                      <div className="space-y-2 mt-4">
                        <label className="text-xs font-medium text-toll-text-light">Periods</label>
                        <input
                          type="number"
                          value={periods}
                          onChange={(e) => setPeriods(Number(e.target.value))}
                          className="w-full rounded-md border-slate-200 text-sm text-slate-700 shadow-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
                        />
                      </div>
                    </section>

                    <div className="h-px bg-slate-200" />

                    <section>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Icon name="smart_toy" className="text-toll-text-light text-lg" />
                        Fine-Tuned Model (Optional)
                      </h3>
                      {artifacts.length > 0 ? (
                        <select
                          value={selectedArtifact}
                          onChange={(e) => {
                            setSelectedArtifact(e.target.value);
                            if (e.target.value) {
                              setStrategyCode(
                                `# Using fine-tuned model: ${e.target.value}\nimport json, pathlib\nmodel_path = pathlib.Path("${e.target.value}")\nmodel_config = json.loads(model_path.read_text())\n\ndef on_tick(tick):\n    pass\n`
                              );
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
                        >
                          <option value="">None — use custom strategy code</option>
                          {artifacts.map((a) => (
                            <option key={a.path} value={a.path}>
                              {a.filename}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 p-3 text-center">
                          No fine-tuned models yet.{" "}
                          <a href="/researcher/training" className="text-toll-blue hover:underline">
                            Train one →
                          </a>
                        </p>
                      )}
                    </section>
                  </div>
                )}

                {configTab === "strategy" && (
                  <StrategyTab strategyCode={strategyCode} asset={asset} periods={periods} />
                )}
                {configTab === "parameters" && (
                  <ParametersTab strategyCode={strategyCode} onUpdateCode={setStrategyCode} />
                )}
              </div>

              {/* Right preview */}
              <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
                <div className="text-center max-w-md">
                  <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Icon name="science" className="text-2xl text-slate-300" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Ready to backtest</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Configure your data on the left, then click{" "}
                    <strong className="text-slate-600">Run Backtest</strong> in the top bar.
                  </p>
                  <button
                    onClick={runSimulation}
                    disabled={running}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Icon name="play_arrow" className="text-lg" />
                    {running ? "Running…" : "Run Backtest"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Backtest results ────────────────────────── */}
          {step === "backtest" && (
            <div className="p-6 space-y-6">
              {!result ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Icon name="science" className="text-4xl text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">
                      No results yet.{" "}
                      <button onClick={() => setStep("configure")} className="text-toll-blue hover:underline">
                        Go back and run a simulation →
                      </button>
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <EquityCurve trades={trades} totalReturnPct={metrics.total_return_pct ?? 0} />
                  <MetricsGrid metrics={metrics} />
                  <ExecutionsTable trades={trades} />
                </>
              )}
            </div>
          )}

          {/* ── Step 5: Publish ─────────────────────────────────── */}
          {step === "publish" && (
            <div className="max-w-lg mx-auto px-6 py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-5 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-200">
                <Icon name="check_circle" className="text-3xl text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Publish to Marketplace</h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Your strategy passed backtesting. Publish it to the marketplace so subscribers can
                start receiving signals.
              </p>

              {result && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 text-left">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Performance Summary</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-600">
                        {(metrics.total_return_pct ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase">Return</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">
                        {(metrics.win_rate ?? 0).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase">Win Rate</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{trades.length}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Trades</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setStep("backtest")}
                  className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ← Review Results
                </button>
                <button
                  onClick={() => router.push("/marketplace")}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Publish Strategy
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
