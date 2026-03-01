"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Icon from "@/components/ui/Icon";
import { researcher, training } from "@/lib/api";
import type {
  CredentialsStatus,
  TrainingJob,
  TrainingJobListItem,
  HFModelResult,
  GPUTier,
  BacktestModelResult,
} from "@/lib/types";

/* ── Wizard Steps ─────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: Record<Step, { title: string; icon: string }> = {
  1: { title: "Choose", icon: "search" },
  2: { title: "Build", icon: "tune" },
  3: { title: "Train", icon: "model_training" },
  4: { title: "Backtest", icon: "analytics" },
  5: { title: "Publish", icon: "storefront" },
};

export default function StudioPage() {
  /* ── Global state ─────────────────────────────────────────── */
  const [step, setStep] = useState<Step>(1);
  const [creds, setCreds] = useState<CredentialsStatus | null>(null);
  const [showCredsOverlay, setShowCredsOverlay] = useState(false);

  /* Step 1 — Choose base model */
  const [hfQuery, setHfQuery] = useState("financial sentiment");
  const [hfResults, setHfResults] = useState<HFModelResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [previousJobs, setPreviousJobs] = useState<TrainingJobListItem[]>([]);

  /* Step 2 — Configure training */
  const [jobName, setJobName] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("financial_sentiment_demo.csv");
  const [gpuTiers, setGpuTiers] = useState<GPUTier[]>([]);
  const [selectedGPU, setSelectedGPU] = useState("t4");
  const [epochs, setEpochs] = useState(3);
  const [lr, setLr] = useState(0.00002);
  const [batchSize, setBatchSize] = useState(16);
  const [loraRank, setLoraRank] = useState(8);

  /* Step 3 — Training in progress */
  const [activeJob, setActiveJob] = useState<TrainingJob | null>(null);
  const [pollJobId, setPollJobId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Step 4 — Backtest */
  const [backtestAsset, setBacktestAsset] = useState("stock");
  const [backtestPeriods, setBacktestPeriods] = useState(200);
  const [backtestResult, setBacktestResult] = useState<BacktestModelResult | null>(null);
  const [backtesting, setBacktesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  /* Step 5 — Publish */
  const [pubName, setPubName] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubAsset, setPubAsset] = useState("stock");
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");

  /* ── Load initial data ─────────────────────────────────────── */
  const loadInit = useCallback(async () => {
    try {
      const [c, j, g] = await Promise.all([
        researcher.getCredentials(),
        training.listJobs(),
        researcher.getGPUTiers(),
      ]);
      setCreds(c);
      setPreviousJobs(j);
      setGpuTiers(g);
      if (!c?.has_modal_credentials) setShowCredsOverlay(true);
    } catch {
      /* not logged in */
    }
  }, []);

  useEffect(() => { loadInit(); }, [loadInit]);

  /* HuggingFace search */
  const searchHF = async () => {
    setSearching(true);
    try { setHfResults(await training.searchHuggingFace(hfQuery)); } catch { /* noop */ }
    finally { setSearching(false); }
  };
  useEffect(() => { searchHF(); }, []); // eslint-disable-line

  /* Poll training job */
  useEffect(() => {
    if (!pollJobId) return;
    const iv = setInterval(async () => {
      try {
        const job = await training.getJob(pollJobId);
        setActiveJob(job);
        if (job.status === "completed" || job.status === "failed") {
          clearInterval(iv);
          if (job.status === "completed") setStep(4);
        }
      } catch { clearInterval(iv); }
    }, 3000);
    return () => clearInterval(iv);
  }, [pollJobId]);

  /* ── Actions ────────────────────────────────────────────────── */
  const handleSelectModel = (modelId: string, modelName: string) => {
    setSelectedModel(modelId);
    setJobName(`${modelName}-finetune`);
    setStep(2);
  };

  const handleResumeJob = (job: TrainingJobListItem) => {
    setSelectedModel(job.base_model);
    setJobName(job.job_name);
    if (job.status === "completed") {
      setPollJobId(job.id);
      // Fetch the full job to get metrics
      training.getJob(job.id).then((j) => { setActiveJob(j); setStep(4); }).catch(() => {});
    } else if (job.status === "running") {
      setPollJobId(job.id);
      training.getJob(job.id).then((j) => setActiveJob(j)).catch(() => {});
      setStep(3);
    }
  };

  const handleStartTraining = async () => {
    if (!selectedModel || !jobName) return;
    setSubmitting(true);
    try {
      // Upload dataset if a file was selected
      if (datasetFile) {
        await researcher.uploadDataset(datasetFile);
        setDatasetName(datasetFile.name);
      }
      const job = await training.submitJob({
        job_name: jobName,
        base_model: selectedModel,
        dataset_filename: datasetFile ? datasetFile.name : datasetName,
        config: { epochs, learning_rate: lr, batch_size: batchSize, lora_rank: loraRank, warmup_steps: 50, weight_decay: 0.01, max_seq_length: 256 },
      });
      setActiveJob(job);
      setPollJobId(job.id);
      setStep(3);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Training submission failed"); }
    finally { setSubmitting(false); }
  };

  const handleRunBacktest = async () => {
    if (!activeJob) return;
    setBacktesting(true);
    setAiSuggestion("");
    setIsDemo(false);
    try {
      const result = await researcher.backtestModel(activeJob.id, backtestAsset, backtestPeriods);
      setBacktestResult(result);
      // Auto-fetch AI suggestion if not profitable
      if ((result.metrics.total_pnl ?? 0) <= 0) {
        setLoadingAI(true);
        try {
          const ai = await researcher.aiSuggest(
            result.metrics as unknown as Record<string, unknown>,
            backtestAsset,
            backtestPeriods,
          );
          setAiSuggestion(ai.suggestion);
        } catch { setAiSuggestion(""); }
        finally { setLoadingAI(false); }
      }
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Backtest failed"); }
    finally { setBacktesting(false); }
  };

  const handleRunDemo = async () => {
    setBacktesting(true);
    setAiSuggestion("");
    setIsDemo(true);
    try {
      const result = await researcher.backtestDemo(backtestAsset, backtestPeriods);
      setBacktestResult(result);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Demo failed"); }
    finally { setBacktesting(false); }
  };

  const handlePublish = async () => {
    if (!activeJob || !backtestResult || !pubName) return;
    setPublishing(true);
    setPublishMsg("");
    try {
      await researcher.submitToMarketplace({
        training_job_id: activeJob.id,
        name: pubName,
        description: pubDesc,
        asset_class: pubAsset,
        backtest_metrics: backtestResult.metrics as Record<string, unknown>,
        backtest_asset: backtestResult.asset,
        backtest_periods: backtestResult.periods,
      });
      setPublishMsg("✓ Model published to marketplace!");
    } catch (e: unknown) { setPublishMsg(`✗ ${e instanceof Error ? e.message : "Publish failed"}`); }
    finally { setPublishing(false); }
  };

  const isProfitable = backtestResult && (backtestResult.metrics.total_pnl ?? 0) > 0;

  /* ── Credential overlay ─────────────────────────────────────── */
  const CredentialsOverlay = () => {
    const [tokenId, setTokenId] = useState("");
    const [tokenSecret, setTokenSecret] = useState("");
    const [saving, setSaving] = useState(false);

    const save = async () => {
      setSaving(true);
      try {
        await researcher.setModalCredentials(tokenId, tokenSecret);
        const c = await researcher.getCredentials();
        setCreds(c);
        setShowCredsOverlay(false);
      } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed to save credentials"); }
      finally { setSaving(false); }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
              <Icon name="key" className="text-xl text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Connect Modal.com</h3>
              <p className="text-xs text-slate-500">Required to train & deploy on GPUs</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Get your token from{" "}
            <a href="https://modal.com/settings" target="_blank" className="text-violet-600 underline">
              modal.com/settings
            </a>
          </p>
          <div className="space-y-3">
            <input type="text" placeholder="Token ID (ak-...)" value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input type="password" placeholder="Token Secret (as-...)" value={tokenSecret}
              onChange={(e) => setTokenSecret(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="flex gap-2">
              <button onClick={() => setShowCredsOverlay(false)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                Skip for now
              </button>
              <button onClick={save} disabled={saving || !tokenId || !tokenSecret}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                {saving ? "Validating..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex overflow-hidden">
      <Sidebar />
      {showCredsOverlay && <CredentialsOverlay />}

      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Researcher Studio</h1>
            <div className="h-5 w-px bg-slate-200" />
            <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-200">
              Choose → Build → Train → Backtest → Publish
            </span>
          </div>
          <div className="flex items-center gap-3">
            {creds?.has_modal_credentials ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <Icon name="check_circle" className="text-sm" /> Modal Connected
              </span>
            ) : (
              <button onClick={() => setShowCredsOverlay(true)}
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 hover:bg-amber-100">
                <Icon name="warning" className="text-sm" /> Connect Modal
              </button>
            )}
          </div>
        </header>

        {/* Step Progress Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    // Allow going back to previous completed steps
                    if (s < step || (s === 1)) setStep(s);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${
                    s === step
                      ? "bg-violet-100 text-violet-700 border border-violet-300"
                      : s < step
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                      : "bg-slate-50 text-slate-400 border border-slate-100"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    s === step ? "bg-violet-600 text-white" : s < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                  }`}>
                    {s < step ? <Icon name="check" className="text-xs" /> : s}
                  </div>
                  <span className="hidden sm:inline">{STEP_LABELS[s].title}</span>
                </button>
                {i < 4 && <div className={`w-4 h-0.5 mx-1 shrink-0 ${s < step ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── STEP 1: Choose Base Model or Build from Scratch ─── */}
          {step === 1 && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold mb-1">Step 1: Choose Your Starting Point</h2>
              <p className="text-sm text-slate-500 mb-6">Pick an open-source model from HuggingFace to fine-tune, or build a strategy from scratch in the code editor.</p>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Build from Scratch card */}
                <div className="lg:col-span-1">
                  <Link href="/compute"
                    className="block p-6 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl text-white hover:shadow-lg transition-shadow group">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon name="code" className="text-2xl" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Build from Scratch</h3>
                    <p className="text-sm text-white/80 mb-4">Open the code editor and write your own trading strategy with AI assistance.</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-full">
                      Open Code Editor <Icon name="arrow_forward" className="text-sm" />
                    </span>
                  </Link>

                  {/* Resume from completed jobs */}
                  {previousJobs.filter((j) => j.status === "completed" || j.status === "running").length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resume a Job</h4>
                      <div className="space-y-2">
                        {previousJobs
                          .filter((j) => j.status === "completed" || j.status === "running")
                          .slice(0, 5)
                          .map((j) => (
                            <button key={j.id} onClick={() => handleResumeJob(j)}
                              className="w-full text-left p-3 bg-white rounded-lg border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-800 truncate">{j.job_name}</p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  j.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                }`}>{j.status}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{j.base_model}</p>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* HuggingFace Search */}
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-bold text-slate-900">Fine-Tune an Open-Source Model</h3>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">HuggingFace</span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <input value={hfQuery} onChange={(e) => setHfQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchHF()}
                      placeholder="Search models (e.g. financial sentiment, llama, bert)..."
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <button onClick={searchHF} disabled={searching}
                      className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                      {searching ? "..." : "Search"}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {hfResults.map((m) => (
                      <button key={m.model_id}
                        onClick={() => handleSelectModel(m.model_id, m.name)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all hover:shadow-sm ${
                          selectedModel === m.model_id ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}>
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-slate-900 truncate flex-1">{m.model_id}</p>
                          <div className="flex items-center gap-3 ml-3 shrink-0 text-[10px] text-slate-400">
                            <span>↓{m.downloads > 1000 ? `${(m.downloads / 1000).toFixed(0)}k` : m.downloads}</span>
                            <span>♥{m.likes}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {m.pipeline_tag && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">{m.pipeline_tag}</span>}
                          {m.tags.slice(0, 4).map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100">{t}</span>)}
                        </div>
                      </button>
                    ))}
                    {hfResults.length === 0 && !searching && (
                      <div className="text-center py-12 text-slate-400">
                        <Icon name="search_off" className="text-4xl mb-2" />
                        <p className="text-sm">Search for a model to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Configure Fine-Tuning ────────────────────── */}
          {step === 2 && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-bold mb-1">Step 2: Configure Fine-Tuning</h2>
              <p className="text-sm text-slate-500 mb-6">Set up your training job, upload data, and pick a GPU.</p>

              <div className="grid lg:grid-cols-5 gap-6">
                {/* Config form */}
                <div className="lg:col-span-3 space-y-5">
                  {/* Base model */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Base Model</label>
                    <div className="text-sm font-mono text-violet-700 bg-violet-50 px-3 py-2.5 rounded-lg border border-violet-100">
                      {selectedModel}
                    </div>
                  </div>

                  {/* Job name */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Job Name</label>
                    <input value={jobName} onChange={(e) => setJobName(e.target.value)}
                      placeholder="my-trading-model-v1"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>

                  {/* Dataset upload */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Training Dataset</label>
                    <p className="text-xs text-slate-500 mb-3">Upload a CSV/JSON file or use the default demo dataset.</p>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-violet-300 hover:bg-violet-50 transition-colors">
                        <Icon name="upload_file" className="text-xl text-slate-400" />
                        <span className="text-sm text-slate-600 truncate">
                          {datasetFile ? datasetFile.name : "Choose file..."}
                        </span>
                        <input type="file" accept=".csv,.json,.jsonl,.txt" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setDatasetFile(f); setDatasetName(f.name); }
                          }} />
                      </label>
                      <button onClick={async () => {
                          try { await training.seedDemoDataset(); setDatasetName("financial_sentiment_demo.csv"); setDatasetFile(null); }
                          catch { /* noop */ }
                        }}
                        className="px-4 py-2.5 border border-violet-200 text-violet-600 rounded-lg text-xs font-medium hover:bg-violet-50 whitespace-nowrap">
                        Use Demo Data
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Using: {datasetName}</p>
                  </div>

                  {/* Hyperparameters */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 block">Hyperparameters</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Epochs</label>
                        <input type="number" value={epochs} onChange={(e) => setEpochs(+e.target.value)} min={1} max={50}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Learning Rate</label>
                        <input type="number" value={lr} onChange={(e) => setLr(+e.target.value)} step={0.00001}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Batch Size</label>
                        <input type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)} min={1} max={256}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">LoRA Rank</label>
                        <input type="number" value={loraRank} onChange={(e) => setLoraRank(+e.target.value)} min={0} max={128}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GPU Selection — right column */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Icon name="memory" className="text-xl text-violet-600" />
                      <h3 className="font-bold text-slate-900">GPU Selection</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">Powered by <span className="font-semibold text-violet-600">Modal.com</span></p>
                    <div className="space-y-2">
                      {gpuTiers.map((g) => (
                        <button key={g.id} onClick={() => setSelectedGPU(g.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedGPU === g.id
                              ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
                              : "border-slate-200 hover:border-slate-300"
                          }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-900">{g.name}</span>
                            <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded">{g.vram}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">{g.best_for}</span>
                            <span className="text-[10px] font-mono text-slate-400">{g.cost_hr}</span>
                          </div>
                        </button>
                      ))}
                      {gpuTiers.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Loading GPU tiers...</p>
                      )}
                    </div>

                    <button onClick={handleStartTraining}
                      disabled={submitting || !jobName || !selectedModel}
                      className="w-full mt-5 py-3 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      <Icon name="rocket_launch" className="text-lg" />
                      {submitting ? "Starting..." : `Train on ${gpuTiers.find((g) => g.id === selectedGPU)?.name ?? "GPU"}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Training in Progress ─────────────────────── */}
          {step === 3 && (
            <div className="max-w-xl mx-auto">
              <h2 className="text-xl font-bold mb-1">Step 3: Training in Progress</h2>
              <p className="text-sm text-slate-500 mb-6">Your model is training on the cloud. This page auto-updates.</p>

              {activeJob && (
                <div className="bg-white rounded-2xl border border-violet-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                        <Icon name="model_training" className="text-xl text-violet-600 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{activeJob.job_name}</h3>
                        <p className="text-xs text-slate-500 font-mono">{activeJob.base_model}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      activeJob.status === "completed" ? "bg-emerald-100 text-emerald-700"
                        : activeJob.status === "failed" ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>{activeJob.status.toUpperCase()}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-4 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${activeJob.progress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{activeJob.progress.toFixed(0)}% complete</p>

                  {/* Metrics */}
                  {activeJob.metrics && (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Current Loss", value: activeJob.metrics.current_loss?.toFixed(4) ?? "—", color: "text-blue-600" },
                        { label: "Best Loss", value: activeJob.metrics.best_loss?.toFixed(4) ?? "—", color: "text-emerald-600" },
                        { label: "Epoch", value: activeJob.metrics.epoch?.toString() ?? "—", color: "text-violet-600" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeJob.status === "completed" && (
                    <button onClick={() => setStep(4)}
                      className="w-full mt-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2">
                      <Icon name="analytics" className="text-lg" /> Proceed to Backtest
                    </button>
                  )}
                  {activeJob.status === "failed" && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      Training failed. <button onClick={() => setStep(2)} className="underline font-medium">Go back and retry.</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Backtest ─────────────────────────────────── */}
          {step === 4 && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-xl font-bold mb-1">Step 4: Backtest Against Historical Data</h2>
              <p className="text-sm text-slate-500 mb-6">Run your trained model against historical price data. You can only publish if the backtest shows positive profit.</p>

              {/* Backtest config */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="analytics" className="text-xl text-violet-600" />
                  <h3 className="font-bold text-slate-900">Backtest Configuration</h3>
                </div>
                <div className="grid sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Asset Class</label>
                    <select value={backtestAsset} onChange={(e) => setBacktestAsset(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm">
                      <option value="stock">Stock</option>
                      <option value="forex">Forex</option>
                      <option value="crypto">Crypto</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Periods</label>
                    <input type="number" value={backtestPeriods} onChange={(e) => setBacktestPeriods(+e.target.value)} min={50} max={1000}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleRunBacktest} disabled={backtesting || !activeJob}
                      className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Icon name="play_arrow" className="text-lg" />
                      {backtesting ? "Running..." : "Run Backtest"}
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleRunDemo} disabled={backtesting}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Icon name="auto_awesome" className="text-lg" />
                      Try Demo Strategy
                    </button>
                  </div>
                </div>
              </div>

              {/* Backtest Results */}
              {backtestResult && (
                <div className="space-y-6">
                  {/* Profitability banner */}
                  <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
                    isProfitable
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-red-50 border-red-300 text-red-800"
                  }`}>
                    <Icon name={isProfitable ? "trending_up" : "trending_down"} className="text-3xl" />
                    <div className="flex-1">
                      <p className="font-bold text-lg">
                        {isProfitable ? "✓ Profitable — Ready to Publish!" : "✗ Not Profitable — Adjust & Re-run"}
                      </p>
                      <p className="text-sm opacity-80">
                        Total P&L: ${(backtestResult.metrics.total_pnl ?? 0).toFixed(2)} ({(backtestResult.metrics.total_return_pct ?? 0).toFixed(2)}%)
                      </p>
                    </div>
                    {isDemo && (
                      <span className="text-xs font-bold bg-white/60 px-2.5 py-1 rounded-full">DEMO</span>
                    )}
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Total P&L", value: `$${(backtestResult.metrics.total_pnl ?? 0).toFixed(2)}`, positive: (backtestResult.metrics.total_pnl ?? 0) > 0 },
                      { label: "Return %", value: `${(backtestResult.metrics.total_return_pct ?? 0).toFixed(2)}%`, positive: (backtestResult.metrics.total_return_pct ?? 0) > 0 },
                      { label: "Sharpe Ratio", value: (backtestResult.metrics.sharpe_ratio ?? 0).toFixed(3), positive: (backtestResult.metrics.sharpe_ratio ?? 0) > 0.5 },
                      { label: "Max Drawdown", value: `${(backtestResult.metrics.max_drawdown_pct ?? 0).toFixed(2)}%`, positive: (backtestResult.metrics.max_drawdown_pct ?? 0) > -20 },
                      { label: "Win Rate", value: `${(backtestResult.metrics.win_rate ?? 0).toFixed(1)}%`, positive: (backtestResult.metrics.win_rate ?? 0) > 50 },
                      { label: "Trades", value: String(backtestResult.metrics.num_trades ?? 0), positive: true },
                    ].map((m) => (
                      <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                        <p className={`text-lg font-bold ${m.positive ? "text-emerald-600" : "text-red-500"}`}>{m.value}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Market Price Chart with Strategy Signals ─── */}
                  {backtestResult.prices && backtestResult.prices.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Icon name="show_chart" className="text-violet-600" />
                          Market Price &amp; Strategy Signals
                        </h4>
                        <div className="flex items-center gap-4 text-[10px]">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Price</span>
                          <span className="flex items-center gap-1"><span className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-500 inline-block" /> Buy</span>
                          <span className="flex items-center gap-1"><span className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 inline-block" /> Sell</span>
                        </div>
                      </div>
                      {(() => {
                        const prices = backtestResult.prices;
                        const closes = prices.map((p) => p.close);
                        const minP = Math.min(...closes);
                        const maxP = Math.max(...closes);
                        const range = maxP - minP || 1;
                        const chartH = 200;
                        const chartW = 800;
                        const step = chartW / (closes.length - 1 || 1);

                        // Build SVG path for price line
                        const points = closes.map((c, i) => {
                          const x = i * step;
                          const y = chartH - ((c - minP) / range) * (chartH - 20) - 10;
                          return `${x},${y}`;
                        });
                        const linePath = `M${points.join(" L")}`;

                        // Area fill
                        const areaPath = `${linePath} L${chartW},${chartH} L0,${chartH} Z`;

                        // Map signals to x,y coords
                        const signalTimeMap = new Map<string, number>();
                        prices.forEach((p, i) => signalTimeMap.set(p.timestamp, i));

                        const buySignals: { x: number; y: number }[] = [];
                        const sellSignals: { x: number; y: number }[] = [];
                        (backtestResult.signals ?? []).forEach((sig) => {
                          const idx = signalTimeMap.get(sig.time);
                          if (idx === undefined) return;
                          const x = idx * step;
                          const y = chartH - ((sig.price - minP) / range) * (chartH - 20) - 10;
                          if (sig.type === "buy") buySignals.push({ x, y });
                          else sellSignals.push({ x, y });
                        });

                        return (
                          <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full h-56" preserveAspectRatio="none">
                            {/* Grid lines */}
                            {[0.25, 0.5, 0.75].map((pct) => (
                              <line key={pct} x1={0} x2={chartW}
                                y1={chartH - pct * (chartH - 20) - 10}
                                y2={chartH - pct * (chartH - 20) - 10}
                                stroke="#f1f5f9" strokeWidth={1} />
                            ))}
                            {/* Price area fill */}
                            <path d={areaPath} fill="url(#priceGrad)" opacity={0.3} />
                            {/* Price line */}
                            <path d={linePath} fill="none" stroke="#64748b" strokeWidth={1.5} />
                            {/* Buy signals (green triangles pointing up) */}
                            {buySignals.map((s, i) => (
                              <polygon key={`b${i}`}
                                points={`${s.x},${s.y - 2} ${s.x - 4},${s.y + 6} ${s.x + 4},${s.y + 6}`}
                                fill="#10b981" />
                            ))}
                            {/* Sell signals (red triangles pointing down) */}
                            {sellSignals.map((s, i) => (
                              <polygon key={`s${i}`}
                                points={`${s.x},${s.y + 2} ${s.x - 4},${s.y - 6} ${s.x + 4},${s.y - 6}`}
                                fill="#ef4444" />
                            ))}
                            {/* Price labels */}
                            <text x={2} y={14} className="text-[9px] fill-slate-400">${maxP.toFixed(2)}</text>
                            <text x={2} y={chartH - 2} className="text-[9px] fill-slate-400">${minP.toFixed(2)}</text>
                            {/* Gradient def */}
                            <defs>
                              <linearGradient id="priceGrad" x1={0} y1={0} x2={0} y2={1}>
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                          </svg>
                        );
                      })()}
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-slate-400">{backtestResult.prices[0]?.timestamp?.slice(11, 16)}</span>
                        <span className="text-[9px] text-slate-400">
                          {backtestResult.signals?.length ?? 0} signals · {backtestResult.metrics.num_trades ?? 0} completed trades
                        </span>
                        <span className="text-[9px] text-slate-400">{backtestResult.prices[backtestResult.prices.length - 1]?.timestamp?.slice(11, 16)}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Equity Curve ────────────────────────────── */}
                  {backtestResult.trades.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Icon name="timeline" className="text-emerald-600" />
                        Equity Curve (Cumulative P&amp;L)
                      </h4>
                      {(() => {
                        const pnls = backtestResult.trades.map((t) => (t.pnl as number) ?? 0);
                        const cum: number[] = [];
                        pnls.forEach((p, i) => cum.push((cum[i - 1] ?? 0) + p));
                        const minC = Math.min(0, ...cum);
                        const maxC = Math.max(0, ...cum);
                        const range = maxC - minC || 1;
                        const chartH = 120;
                        const chartW = 700;
                        const step = chartW / (cum.length - 1 || 1);
                        const zeroY = chartH - ((0 - minC) / range) * (chartH - 10) - 5;
                        const pts = cum.map((c, i) => {
                          const x = i * step;
                          const y = chartH - ((c - minC) / range) * (chartH - 10) - 5;
                          return `${x},${y}`;
                        });
                        const isUp = cum[cum.length - 1] >= 0;
                        return (
                          <svg viewBox={`0 0 ${chartW} ${chartH + 10}`} className="w-full h-32" preserveAspectRatio="none">
                            <line x1={0} x2={chartW} y1={zeroY} y2={zeroY} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4" />
                            <path d={`M${pts.join(" L")} L${chartW},${chartH + 5} L0,${chartH + 5} Z`}
                              fill={isUp ? "#10b98120" : "#ef444420"} />
                            <path d={`M${pts.join(" L")}`} fill="none"
                              stroke={isUp ? "#10b981" : "#ef4444"} strokeWidth={2} />
                            <text x={2} y={12} className="text-[9px] fill-slate-400">${maxC.toFixed(2)}</text>
                            <text x={2} y={chartH + 8} className="text-[9px] fill-slate-400">${minC.toFixed(2)}</text>
                          </svg>
                        );
                      })()}
                    </div>
                  )}

                  {/* Trade-by-trade P&L bar chart */}
                  {backtestResult.trades.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3">Trade-by-Trade P&amp;L</h4>
                      <div className="flex items-end gap-[2px] h-32">
                        {backtestResult.trades.slice(0, 60).map((trade, i) => {
                          const pnl = (trade.pnl as number) ?? 0;
                          const maxAbs = Math.max(...backtestResult.trades.slice(0, 60).map((t) => Math.abs((t.pnl as number) ?? 0)), 1);
                          const height = Math.abs(pnl) / maxAbs * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col justify-end items-center min-w-[3px]">
                              <div
                                className={`w-full rounded-t-sm ${pnl >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                                style={{ height: `${Math.max(height, 2)}%` }}
                                title={`Trade ${i + 1}: $${pnl.toFixed(2)}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-slate-400">Trade 1</span>
                        <span className="text-[9px] text-slate-400">Trade {Math.min(backtestResult.trades.length, 60)}</span>
                      </div>
                    </div>
                  )}

                  {/* ── AI Suggestion Panel (when not profitable) ──── */}
                  {!isProfitable && (aiSuggestion || loadingAI) && (
                    <div className="rounded-xl border border-amber-200 overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Icon name="auto_awesome" className="text-xl text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">AI Strategy Advisor</h4>
                          <p className="text-[11px] text-white/80">Powered by Gemini — personalised suggestions to improve your strategy</p>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                        {loadingAI ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="w-10 h-10 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
                            <p className="text-sm font-medium text-amber-700">Analysing your backtest results…</p>
                            <p className="text-xs text-amber-500">This may take a few seconds</p>
                          </div>
                        ) : (() => {
                          // Parse the AI response into structured suggestion cards
                          const icons = ["tune", "shield", "filter_alt", "account_balance", "psychology"];
                          const colors = [
                            { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-600", num: "bg-violet-600" },
                            { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-600", num: "bg-rose-600" },
                            { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-600", num: "bg-sky-600" },
                            { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", num: "bg-emerald-600" },
                            { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", num: "bg-amber-600" },
                          ];

                          // Split into numbered items: "1. **Title** — desc" or "1. Title — desc"
                          const items: { title: string; body: string }[] = [];
                          let introText = "";
                          const lines = aiSuggestion.split("\n").filter((l) => l.trim());

                          for (const line of lines) {
                            const numbered = line.match(/^\d+\.\s*\*?\*?(.+?)\*?\*?\s*[—\-–:]\s*(.+)$/);
                            if (numbered) {
                              items.push({ title: numbered[1].replace(/\*+/g, "").trim(), body: numbered[2].trim() });
                            } else if (items.length === 0) {
                              introText += (introText ? " " : "") + line.trim();
                            } else {
                              // continuation line — append to last item body
                              items[items.length - 1].body += " " + line.trim();
                            }
                          }

                          return (
                            <div className="space-y-3">
                              {introText && (
                                <p className="text-sm text-amber-800 mb-2 leading-relaxed">{introText}</p>
                              )}
                              {items.map((item, idx) => {
                                const c = colors[idx % colors.length];
                                const icon = icons[idx % icons.length];
                                return (
                                  <div key={idx} className={`${c.bg} ${c.border} border rounded-xl p-4 flex gap-3 transition-all hover:shadow-sm`}>
                                    <div className="flex-shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                                      <span className={`${c.num} text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center`}>
                                        {idx + 1}
                                      </span>
                                      <Icon name={icon} className={`text-lg ${c.icon}`} />
                                    </div>
                                    <div className="min-w-0">
                                      <h5 className="font-semibold text-slate-900 text-[13px] mb-1 leading-tight">{item.title}</h5>
                                      <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                                    </div>
                                  </div>
                                );
                              })}
                              {items.length === 0 && (
                                <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Next step / actions */}
                  {isProfitable && !isDemo && (
                    <button onClick={() => { setPubName(jobName.replace("-finetune", "")); setPubAsset(backtestAsset); setStep(5); }}
                      className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2">
                      <Icon name="storefront" className="text-lg" /> Proceed to Publish
                    </button>
                  )}
                  {isProfitable && isDemo && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <Icon name="info" className="text-xl text-blue-600 mb-1" />
                      <p className="text-sm text-blue-800 font-medium">This is a demo strategy. Train your own model and run a real backtest to publish.</p>
                      <button onClick={() => { setBacktestResult(null); setIsDemo(false); }}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        Run My Model&apos;s Backtest
                      </button>
                    </div>
                  )}
                  {!isProfitable && (
                    <div className="flex gap-3">
                      <button onClick={() => setStep(2)}
                        className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                        ← Adjust Training
                      </button>
                      <button onClick={handleRunDemo} disabled={backtesting}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        <Icon name="auto_awesome" className="text-lg" /> Try Demo Strategy
                      </button>
                      <button onClick={handleRunBacktest} disabled={backtesting || !activeJob}
                        className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                        Re-run Backtest
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 5: Publish to Marketplace ───────────────────── */}
          {step === 5 && (
            <div className="max-w-xl mx-auto">
              <h2 className="text-xl font-bold mb-1">Step 5: Publish to Marketplace</h2>
              <p className="text-sm text-slate-500 mb-6">Your model passed backtesting! List it on the marketplace so subscribers can trade with it.</p>

              {/* Backtest proof banner */}
              {backtestResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="verified" className="text-xl text-emerald-600" />
                    <h4 className="font-semibold text-emerald-800">Backtest Verified</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-700">${(backtestResult.metrics.total_pnl ?? 0).toFixed(2)}</p>
                      <p className="text-[9px] text-emerald-600 uppercase">P&L</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{(backtestResult.metrics.sharpe_ratio ?? 0).toFixed(2)}</p>
                      <p className="text-[9px] text-emerald-600 uppercase">Sharpe</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{((backtestResult.metrics.win_rate ?? 0) * 100).toFixed(0)}%</p>
                      <p className="text-[9px] text-emerald-600 uppercase">Win Rate</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{backtestResult.metrics.num_trades ?? 0}</p>
                      <p className="text-[9px] text-emerald-600 uppercase">Trades</p>
                    </div>
                  </div>
                </div>
              )}

              {publishMsg && (
                <div className={`p-3 rounded-lg text-sm mb-4 ${
                  publishMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>{publishMsg}</div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Strategy Name</label>
                  <input value={pubName} onChange={(e) => setPubName(e.target.value)}
                    placeholder="AI Sentiment Alpha v1"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Description</label>
                  <textarea value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} rows={3}
                    placeholder="Describe what your model does and why it works..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Asset Class</label>
                  <select value={pubAsset} onChange={(e) => setPubAsset(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm">
                    <option value="stock">Stock</option>
                    <option value="forex">Forex</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <button onClick={handlePublish} disabled={publishing || !pubName}
                  className="w-full py-3.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Icon name="publish" className="text-lg" />
                  {publishing ? "Publishing..." : "Publish to Marketplace"}
                </button>
              </div>

              {publishMsg.startsWith("✓") && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-500 mb-3">🎉 Your model is live! Subscribers can now trade with it.</p>
                  <Link href="/marketplace" className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
                    <Icon name="storefront" className="text-lg" /> View on Marketplace
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
