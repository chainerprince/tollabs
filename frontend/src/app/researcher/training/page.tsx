"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ModelBrowser from "@/components/training/ModelBrowser";
import TrainingForm from "@/components/training/TrainingForm";
import JobMonitor from "@/components/training/JobMonitor";
import TrainingNotebook from "@/components/training/TrainingNotebook";
import Icon from "@/components/ui/Icon";
import type { BaseModelInfo } from "@/lib/types";

type Tab = "hub" | "jobs" | "new" | "code";

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>("hub");
  const [selectedModel, setSelectedModel] = useState<BaseModelInfo | null>(null);
  const [jobRefreshKey, setJobRefreshKey] = useState(0);

  const handleModelSelect = (model: BaseModelInfo) => {
    setSelectedModel(model);
    setTab("new");
  };

  const handleJobSubmitted = () => {
    setJobRefreshKey((k) => k + 1);
    setTab("jobs");
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "hub", label: "Model Hub", icon: "hub" },
    { key: "jobs", label: "My Jobs", icon: "list_alt" },
    { key: "new", label: "New Job", icon: "add_circle" },
    { key: "code", label: "Code Lab", icon: "code" },
  ];

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-900">Training Hub</h1>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full border border-purple-200">
              <Icon name="memory" className="text-sm" />
              <span className="text-xs font-semibold tracking-wide uppercase">GPU Fine-Tuning</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedModel && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icon name="smart_toy" className="text-base text-toll-blue" />
                <span className="font-mono">{selectedModel.model_id}</span>
              </div>
            )}
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-6">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "text-toll-blue border-toll-blue"
                    : "text-toll-text-light border-transparent hover:text-slate-900"
                }`}
              >
                <Icon name={t.icon} className="text-lg" />
                {t.label}
                {t.key === "code" && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold uppercase tracking-wider">
                    Dev
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "hub" && (
            <div>
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-1">Open-Source Model Hub</h2>
                <p className="text-sm text-slate-500">
                  Browse curated models optimized for financial applications. Download and fine-tune on your own datasets.
                </p>
              </div>
              <ModelBrowser onSelect={handleModelSelect} selectedModelId={selectedModel?.model_id} />
            </div>
          )}

          {tab === "jobs" && (
            <div>
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-1">Training Jobs</h2>
                <p className="text-sm text-slate-500">
                  Monitor your active and completed fine-tuning jobs. Click a job for detailed metrics and logs.
                </p>
              </div>
              <JobMonitor refreshKey={jobRefreshKey} />
            </div>
          )}

          {tab === "new" && (
            <div className="max-w-xl">
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-1">Submit Fine-Tuning Job</h2>
                <p className="text-sm text-slate-500">
                  Configure and launch a GPU training job. Your dataset must be uploaded via the Compute page first.
                </p>
              </div>
              <TrainingForm selectedModel={selectedModel} onSubmit={handleJobSubmitted} />
            </div>
          )}

          {tab === "code" && (
            <div>
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-1">Training Code Lab</h2>
                <p className="text-sm text-slate-500">
                  Write custom training scripts, experiment with model architectures, and build advanced fine-tuning
                  pipelines. For experienced developers who prefer code over the form-based workflow.
                </p>
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Icon name="info" className="text-amber-600 text-lg mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Code runs in your cloud compute session. Use templates for quick starts, or write
                    from scratch. Generated model artifacts can be deployed via the{" "}
                    <button onClick={() => setTab("jobs")} className="underline font-medium hover:text-amber-900">
                      Jobs tab
                    </button>.
                  </p>
                </div>
              </div>
              <TrainingNotebook />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
