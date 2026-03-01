"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import EquityCurve from "@/components/researcher/EquityCurve";
import MetricsGrid from "@/components/researcher/MetricsGrid";
import ExecutionsTable from "@/components/researcher/ExecutionsTable";
import StrategyTab from "@/components/researcher/StrategyTab";
import ParametersTab from "@/components/researcher/ParametersTab";
import StrategyBuilder from "@/components/researcher/StrategyBuilder";
import Icon from "@/components/ui/Icon";
import { backtest, training } from "@/lib/api";
import type { BacktestResult, PerformanceMetadata, TradeRecord, ModelArtifact } from "@/lib/types";

type ConfigTab = "build" | "data" | "strategy" | "parameters";

export default function ResearcherDashboardPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("build");
  const [asset, setAsset] = useState("EUR/USD");
  const [periods, setPeriods] = useState(500);
  const [strategyCode, setStrategyCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetadata>({});
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ModelArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<string>("");
  const [codeExpanded, setCodeExpanded] = useState(false);

  useEffect(() => {
    training.listArtifacts().then(setArtifacts).catch(() => {});
  }, []);

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
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const tabs: { key: ConfigTab; label: string; icon: string; badge?: string }[] = [
    { key: "build", label: "Build", icon: "construction", badge: "NL" },
    { key: "data", label: "Data", icon: "cloud_download" },
    { key: "strategy", label: "Analyze", icon: "auto_awesome" },
    { key: "parameters", label: "Params", icon: "tune" },
  ];

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-900">Backtest Laboratory</h1>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-toll-blue rounded-full border border-blue-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-semibold tracking-wide uppercase">Compute Ready</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-toll-text-light hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
              <Icon name="terminal" className="text-[18px]" />
              Logs
            </button>
            <button
              onClick={runSimulation}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-toll-blue/20 disabled:opacity-50"
            >
              <Icon name="play_arrow" className="text-[18px]" />
              {running ? "Running..." : "Run Simulation"}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left config panel */}
          <div className="w-[420px] flex flex-col border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-3 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === tab.key
                      ? "text-toll-blue border-toll-blue"
                      : "text-toll-text-light border-transparent hover:text-slate-900"
                  }`}
                >
                  <Icon name={tab.icon} className="text-base" />
                  {tab.label}
                  {tab.badge && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full font-bold uppercase">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Build Tab (NL Strategy Builder) ──────────────── */}
            {activeTab === "build" && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Build Your Strategy</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Describe your trading strategy in plain English and we&apos;ll generate the code. Or pick a template to start.
                  </p>
                </div>

                <StrategyBuilder
                  asset={asset}
                  onCodeGenerated={(code) => setStrategyCode(code)}
                  onBacktest={runSimulation}
                />
              </div>
            )}

            {/* ── Data Tab ─────────────────────────────────────── */}
            {activeTab === "data" && (
              <div className="p-5 space-y-6">
                {/* Data source */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Icon name="cloud_download" className="text-toll-text-light text-lg" />
                    Historical Tick Data
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      onClick={() => setAsset("EUR/USD")}
                      className={`cursor-pointer border rounded-lg p-3 flex flex-col gap-1 transition-all ${
                        asset === "EUR/USD"
                          ? "border-toll-blue bg-toll-blue-light ring-1 ring-toll-blue/50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className={`text-xs font-bold uppercase ${asset === "EUR/USD" ? "text-toll-blue" : "text-toll-text-light"}`}>
                        Forex
                      </span>
                      <span className="text-sm font-medium text-slate-800">EUR/USD</span>
                    </label>
                    <label
                      onClick={() => setAsset("AAPL")}
                      className={`cursor-pointer border rounded-lg p-3 flex flex-col gap-1 transition-all ${
                        asset === "AAPL"
                          ? "border-toll-blue bg-toll-blue-light ring-1 ring-toll-blue/50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className={`text-xs font-bold uppercase ${asset === "AAPL" ? "text-toll-blue" : "text-toll-text-light"}`}>
                        Stocks
                      </span>
                      <span className="text-sm font-medium text-slate-600">AAPL</span>
                    </label>
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

                {/* Fine-tuned model */}
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
                            `# Using fine-tuned model: ${e.target.value}\nimport json, pathlib\nmodel_path = pathlib.Path("${e.target.value}")\nmodel_config = json.loads(model_path.read_text())\n\n# Your strategy logic using the fine-tuned model\ndef on_tick(tick):\n    # model.predict(tick) ...\n    pass\n`
                          );
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
                    >
                      <option value="">None — use custom strategy code</option>
                      {artifacts.map((a) => (
                        <option key={a.path} value={a.path}>{a.filename}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 p-3 text-center">
                      No fine-tuned models yet.{" "}
                      <a href="/researcher/training" className="text-toll-blue hover:underline">Train one →</a>
                    </p>
                  )}
                </section>

                <div className="h-px bg-slate-200" />

                {/* Strategy code (expandable) */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Icon name="code" className="text-toll-text-light text-lg" />
                      Strategy Logic (Python)
                    </h3>
                    <button
                      onClick={() => setCodeExpanded(!codeExpanded)}
                      className="text-xs text-slate-400 hover:text-toll-blue flex items-center gap-1 transition-colors"
                    >
                      <Icon name={codeExpanded ? "unfold_less" : "unfold_more"} className="text-sm" />
                      {codeExpanded ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-md">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                      <span className="text-xs text-slate-400 font-mono">
                        {strategyCode ? "strategy.py" : "momentum_strategy.py"}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${strategyCode ? "text-green-400" : "text-slate-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${strategyCode ? "bg-green-400" : "bg-slate-500"}`} />
                        {strategyCode ? "Ready" : "Default SMA"}
                      </span>
                    </div>
                    <textarea
                      value={strategyCode}
                      onChange={(e) => setStrategyCode(e.target.value)}
                      placeholder={`# Leave empty for default SMA crossover\n# Or use the Build tab to generate from NL\ndef on_tick(tick):\n    sma_fast = ta.sma(close, 20)\n    sma_slow = ta.sma(close, 50)\n    ...`}
                      className={`w-full p-3 bg-transparent text-xs font-mono leading-relaxed text-slate-300 resize-none focus:outline-none transition-all ${
                        codeExpanded ? "h-80" : "h-32"
                      }`}
                      spellCheck={false}
                    />
                  </div>
                  {!strategyCode && (
                    <button
                      onClick={() => setActiveTab("build")}
                      className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Icon name="auto_awesome" className="text-sm" />
                      Build strategy with natural language →
                    </button>
                  )}
                </section>
              </div>
            )}

            {/* ── Strategy Tab (AI Analysis) ───────────────────── */}
            {activeTab === "strategy" && (
              <StrategyTab strategyCode={strategyCode} asset={asset} periods={periods} />
            )}

            {/* ── Parameters Tab ───────────────────────────────── */}
            {activeTab === "parameters" && (
              <ParametersTab strategyCode={strategyCode} onUpdateCode={setStrategyCode} />
            )}
          </div>

          {/* Right results panel */}
          <div className="flex-1 flex flex-col bg-slate-50 min-w-0 overflow-y-auto">
            {/* Quick flow hint when no results */}
            {!result && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Icon name="science" className="text-3xl text-slate-300" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-2">Ready to backtest</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Build your strategy on the left, then hit <strong className="text-slate-600">Run Simulation</strong> to see results here.
                  </p>

                  {/* Flow steps */}
                  <div className="flex items-center justify-center gap-3 mb-6">
                    {[
                      { icon: "construction", label: "Describe", tab: "build" as ConfigTab },
                      { icon: "cloud_download", label: "Configure", tab: "data" as ConfigTab },
                      { icon: "play_arrow", label: "Backtest", tab: null },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {i > 0 && <Icon name="arrow_forward" className="text-slate-300 text-sm" />}
                        <button
                          onClick={() => item.tab && setActiveTab(item.tab)}
                          className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                            item.tab ? "hover:bg-slate-100 cursor-pointer" : ""
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-toll-blue/10 flex items-center justify-center">
                            <Icon name={item.icon} className="text-toll-blue text-xl" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500">{item.label}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTab("build")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Icon name="construction" className="text-lg" />
                    Start Building
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <>
                <div className="p-6 pb-2">
                  <EquityCurve trades={trades} totalReturnPct={metrics.total_return_pct ?? 0} />
                </div>
                <div className="px-6 pb-6 space-y-4">
                  <MetricsGrid metrics={metrics} />
                  <ExecutionsTable trades={trades} />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
