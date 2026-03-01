"use client";

import { useState, useEffect, useCallback } from "react";
import { training } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import type { TrainingJob, TrainingJobListItem } from "@/lib/types";

interface Props {
  refreshKey: number;
}

export default function JobMonitor({ refreshKey }: Props) {
  const [jobs, setJobs] = useState<TrainingJobListItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const list = await training.listJobs();
      setJobs(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [refreshKey, fetchJobs]);

  // Poll running jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "running" || j.status === "queued");
    if (!hasActive && !selectedJob) return;

    const interval = setInterval(async () => {
      await fetchJobs();
      if (selectedJob && (selectedJob.status === "running" || selectedJob.status === "queued")) {
        try {
          const updated = await training.getJob(selectedJob.id);
          setSelectedJob(updated);
        } catch {
          // ignore
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobs, selectedJob, fetchJobs]);

  const openJob = async (id: number) => {
    try {
      const job = await training.getJob(id);
      setSelectedJob(job);
    } catch {
      // ignore
    }
  };

  const cancelJob = async (id: number) => {
    try {
      await training.cancelJob(id);
      fetchJobs();
      if (selectedJob?.id === id) {
        const updated = await training.getJob(id);
        setSelectedJob(updated);
      }
    } catch {
      // ignore
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      queued: "bg-amber-100 text-amber-700 border-amber-200",
      running: "bg-blue-100 text-blue-700 border-blue-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      failed: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-slate-100 text-slate-500 border-slate-200",
    };
    return map[status] ?? "bg-slate-100 text-slate-500";
  };

  if (selectedJob) {
    return <JobDetail job={selectedJob} onBack={() => setSelectedJob(null)} onCancel={cancelJob} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Icon name="hourglass_empty" className="text-2xl animate-spin mr-2" />
        Loading jobs...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <Icon name="model_training" className="text-5xl text-slate-200 mb-3" />
        <h3 className="text-sm font-semibold text-slate-600 mb-1">No training jobs yet</h3>
        <p className="text-xs text-slate-400">
          Submit a fine-tuning job from the &ldquo;New Job&rdquo; tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => openJob(job.id)}
          className="w-full text-left border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all bg-white group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-800 group-hover:text-toll-blue transition-colors">
              {job.job_name}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(job.status)}`}>
              {job.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="font-mono">{job.base_model}</span>
            <span>•</span>
            <span>{new Date(job.created_at).toLocaleDateString()}</span>
          </div>
          {(job.status === "running" || job.status === "queued") && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-toll-blue rounded-full transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{job.progress}%</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Job Detail View ───────────────────────────────────────────── */

function JobDetail({
  job,
  onBack,
  onCancel,
}: {
  job: TrainingJob;
  onBack: () => void;
  onCancel: (id: number) => void;
}) {
  const lossHistory = job.metrics?.loss_history ?? [];
  const valLossHistory = job.metrics?.val_loss_history ?? [];

  return (
    <div className="space-y-5">
      {/* Back header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-toll-text-light hover:text-toll-blue transition-colors"
      >
        <Icon name="arrow_back" className="text-lg" />
        Back to jobs
      </button>

      {/* Job header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{job.job_name}</h2>
          <p className="text-xs text-slate-400 font-mono">{job.base_model}</p>
        </div>
        {(job.status === "running" || job.status === "queued") && (
          <button
            onClick={() => onCancel(job.id)}
            className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Progress</span>
          <span className="text-xs font-semibold text-slate-700">{job.progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === "failed" ? "bg-red-500" : job.status === "completed" ? "bg-green-500" : "bg-toll-blue"
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 mb-0.5">Current Loss</p>
          <p className="text-sm font-bold text-slate-800">
            {job.metrics?.current_loss?.toFixed(4) ?? "—"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 mb-0.5">Best Loss</p>
          <p className="text-sm font-bold text-green-600">
            {job.metrics?.best_loss?.toFixed(4) ?? "—"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 mb-0.5">Epoch</p>
          <p className="text-sm font-bold text-slate-800">
            {job.metrics?.epoch ?? "—"} / {job.config?.epochs ?? "?"}
          </p>
        </div>
      </div>

      {/* Loss chart */}
      {lossHistory.length > 1 && (
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Training Loss</h4>
          <LossChart loss={lossHistory} valLoss={valLossHistory} />
        </div>
      )}

      {/* Artifact */}
      {job.model_artifact_path && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <Icon name="check_circle" className="text-xl text-green-600" />
          <div>
            <p className="text-xs font-semibold text-green-800">Model artifact saved</p>
            <p className="text-[11px] text-green-600 font-mono">{job.model_artifact_path}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {job.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
          <pre className="text-[11px] text-red-600 whitespace-pre-wrap font-mono">{job.error_message}</pre>
        </div>
      )}

      {/* Logs */}
      {job.logs && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Logs</h4>
          <pre className="bg-slate-900 text-slate-300 text-[11px] font-mono p-3 rounded-lg overflow-auto max-h-48 leading-relaxed">
            {job.logs}
          </pre>
        </div>
      )}

      {/* Config */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 mb-2">Configuration</h4>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {Object.entries(job.config).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
              <span className="text-slate-500">{k.replace(/_/g, " ")}</span>
              <span className="font-mono text-slate-700">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Mini loss chart (SVG) ─────────────────────────────────────── */

function LossChart({ loss, valLoss }: { loss: number[]; valLoss: number[] }) {
  const W = 500;
  const H = 120;
  const pad = 4;

  const allVals = [...loss, ...valLoss];
  const maxVal = Math.max(...allVals) * 1.1;
  const minVal = Math.min(...allVals) * 0.9;
  const range = maxVal - minVal || 1;

  const toPath = (data: number[]) => {
    if (data.length < 2) return "";
    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (W - pad * 2);
        const y = pad + (1 - (v - minVal) / range) * (H - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      {loss.length > 1 && (
        <path d={toPath(loss)} fill="none" stroke="#3b82f6" strokeWidth="2" />
      )}
      {valLoss.length > 1 && (
        <path d={toPath(valLoss)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* Legend */}
      <circle cx="12" cy="10" r="3" fill="#3b82f6" />
      <text x="20" y="13" fontSize="10" fill="#64748b">Train</text>
      <circle cx="60" cy="10" r="3" fill="#f59e0b" />
      <text x="68" y="13" fontSize="10" fill="#64748b">Val</text>
    </svg>
  );
}
