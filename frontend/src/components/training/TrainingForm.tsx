"use client";

import { useState, useEffect } from "react";
import { training, compute } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import type { BaseModelInfo, WorkspaceFile } from "@/lib/types";

interface Props {
  selectedModel?: BaseModelInfo | null;
  onSubmit: () => void;
}

export default function TrainingForm({ selectedModel, onSubmit }: Props) {
  const [jobName, setJobName] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [dataset, setDataset] = useState("");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);

  // Hyperparams
  const [epochs, setEpochs] = useState(5);
  const [lr, setLr] = useState(0.00002);
  const [batchSize, setBatchSize] = useState(16);
  const [loraRank, setLoraRank] = useState(8);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    compute.listFiles().then((r) => setFiles(r.files)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedModel) {
      setBaseModel(selectedModel.model_id);
      if (!jobName) {
        setJobName(`${selectedModel.name.replace(/\s+/g, "-").toLowerCase()}-finetune`);
      }
    }
  }, [selectedModel]);

  const dataFiles = files.filter(
    (f) => f.name.endsWith(".csv") || f.name.endsWith(".json") || f.name.endsWith(".jsonl"),
  );

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!baseModel) {
      setError("Select a base model from the Model Hub tab");
      return;
    }
    if (!dataset) {
      setError("Select a dataset file");
      return;
    }
    if (!jobName.trim()) {
      setError("Enter a job name");
      return;
    }

    setSubmitting(true);
    try {
      await training.submitJob({
        job_name: jobName.trim(),
        base_model: baseModel,
        dataset_filename: dataset,
        config: {
          epochs,
          learning_rate: lr,
          batch_size: batchSize,
          lora_rank: loraRank,
        },
      });
      setSuccess("Training job submitted! Check the My Jobs tab for progress.");
      onSubmit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Job name */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Job Name</label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="my-forex-model-v1"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
        />
      </div>

      {/* Base model */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Base Model</label>
        <div className={`px-3 py-2.5 rounded-lg border text-sm ${
          baseModel
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : "bg-slate-50 border-slate-200 text-slate-400"
        }`}>
          {baseModel ? (
            <span className="flex items-center gap-2">
              <Icon name="smart_toy" className="text-base" />
              {baseModel}
            </span>
          ) : (
            "Select a model from the Model Hub tab →"
          )}
        </div>
      </div>

      {/* Dataset */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Dataset File
          <span className="text-slate-400 font-normal ml-1">(upload via Compute → File Manager)</span>
        </label>
        {dataFiles.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {dataFiles.map((f) => (
              <label
                key={f.name}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  dataset === f.name
                    ? "border-toll-blue bg-toll-blue-light"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="dataset"
                  value={f.name}
                  checked={dataset === f.name}
                  onChange={() => setDataset(f.name)}
                  className="text-toll-blue"
                />
                <Icon name="description" className="text-slate-400 text-base" />
                <span className="text-sm text-slate-700 flex-1">{f.name}</span>
                <span className="text-[10px] text-slate-400">
                  {f.size > 1024 * 1024
                    ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
                    : `${(f.size / 1024).toFixed(1)} KB`}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Icon name="cloud_upload" className="text-3xl text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">
              No data files found. Upload a CSV or JSON file via the Compute page first.
            </p>
          </div>
        )}
      </div>

      {/* Hyperparameters */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Icon name="tune" className="text-slate-400 text-base" />
          Hyperparameters
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Epochs</label>
            <input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Learning Rate</label>
            <input
              type="number"
              value={lr}
              onChange={(e) => setLr(Number(e.target.value))}
              step={0.00001}
              min={0.000001}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Batch Size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              min={1}
              max={256}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">LoRA Rank</label>
            <select
              value={loraRank}
              onChange={(e) => setLoraRank(Number(e.target.value))}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:border-toll-blue focus:ring focus:ring-toll-blue/20 bg-white"
            >
              <option value={0}>Full Fine-Tune</option>
              <option value={4}>4 (Minimal)</option>
              <option value={8}>8 (Default)</option>
              <option value={16}>16 (More)</option>
              <option value={32}>32 (High)</option>
              <option value={64}>64 (Very High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Errors / Success */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Icon name="error" className="text-base" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Icon name="check_circle" className="text-base" />
          {success}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !baseModel || !dataset || !jobName.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg text-sm font-semibold transition-colors shadow-sm shadow-toll-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name={submitting ? "hourglass_empty" : "rocket_launch"} className="text-lg" />
        {submitting ? "Submitting..." : "Start Training"}
      </button>
    </div>
  );
}
