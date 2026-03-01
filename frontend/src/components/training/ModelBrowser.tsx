"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { training, compute } from "@/lib/api";
import ModelCard from "./ModelCard";
import Icon from "@/components/ui/Icon";
import type { BaseModelInfo } from "@/lib/types";

interface Props {
  onSelect: (model: BaseModelInfo) => void;
  selectedModelId?: string;
}

export default function ModelBrowser({ onSelect, selectedModelId }: Props) {
  const router = useRouter();
  const [models, setModels] = useState<BaseModelInfo[]>([]);
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [openingInEditor, setOpeningInEditor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    training
      .listBaseModels(taskFilter || undefined)
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskFilter]);

  const filtered = search
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.model_id.toLowerCase().includes(search.toLowerCase()) ||
          m.tags.some((t) => t.includes(search.toLowerCase())),
      )
    : models;

  const tasks = [
    { key: "", label: "All" },
    { key: "time-series-forecasting", label: "Time-Series" },
    { key: "sentiment-analysis", label: "Sentiment" },
    { key: "text-generation", label: "Generation" },
    { key: "text-classification", label: "Classification" },
  ];

  const handleDownload = async (model: BaseModelInfo) => {
    setDownloading(model.model_id);
    try {
      const result = await training.downloadModel(model.model_id);
      setDownloadedModels((prev) => new Set(prev).add(model.model_id));
      setToast({ message: `${model.name} downloaded to ${result.path}`, type: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      setToast({ message: msg, type: "error" });
    } finally {
      setDownloading(null);
    }
  };

  const handleOpenInEditor = async (model: BaseModelInfo) => {
    setOpeningInEditor(model.model_id);
    try {
      const project = await compute.createProject({
        model_id: model.model_id,
        model_name: model.name,
        task: model.task,
        tags: model.tags,
        parameter_count: model.parameter_count,
        description: model.description,
      });
      router.push(`/compute?project=${project.slug}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create project";
      setToast({ message: msg, type: "error" });
      setOpeningInEditor(null);
    }
  };

  /* Auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <Icon name={toast.type === "success" ? "check_circle" : "error"} className="text-lg" />
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">
            <Icon name="close" className="text-sm" />
          </button>
        </div>
      )}

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"
          />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20 bg-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {tasks.map((t) => (
            <button
              key={t.key}
              onClick={() => setTaskFilter(t.key)}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                taskFilter === t.key
                  ? "bg-toll-blue text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Icon name="hourglass_empty" className="text-2xl animate-spin mr-2" />
          Loading models...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No models match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <ModelCard
              key={m.model_id}
              model={m}
              onSelect={onSelect}
              onDownload={handleDownload}
              onOpenInEditor={handleOpenInEditor}
              downloading={downloading === m.model_id}
              downloaded={downloadedModels.has(m.model_id)}
              selected={selectedModelId === m.model_id}
              openingInEditor={openingInEditor === m.model_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
