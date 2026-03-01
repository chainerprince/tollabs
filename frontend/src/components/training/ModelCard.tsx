"use client";

import Icon from "@/components/ui/Icon";
import type { BaseModelInfo } from "@/lib/types";

const TASK_COLORS: Record<string, string> = {
  "time-series-forecasting": "bg-blue-100 text-blue-700 border-blue-200",
  "sentiment-analysis": "bg-amber-100 text-amber-700 border-amber-200",
  "text-generation": "bg-purple-100 text-purple-700 border-purple-200",
  "text-classification": "bg-green-100 text-green-700 border-green-200",
};

const TASK_ICONS: Record<string, string> = {
  "time-series-forecasting": "trending_up",
  "sentiment-analysis": "sentiment_satisfied",
  "text-generation": "auto_awesome",
  "text-classification": "label",
};

interface Props {
  model: BaseModelInfo;
  onSelect?: (model: BaseModelInfo) => void;
  onDownload?: (model: BaseModelInfo) => void;
  downloading?: boolean;
  downloaded?: boolean;
  selected?: boolean;
}

export default function ModelCard({ model, onSelect, onDownload, downloading, downloaded, selected }: Props) {
  const taskColor = TASK_COLORS[model.task] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const taskIcon = TASK_ICONS[model.task] ?? "smart_toy";

  return (
    <div
      className={`relative border rounded-xl p-5 transition-all cursor-pointer group ${
        selected
          ? "border-toll-blue bg-toll-blue-light ring-2 ring-toll-blue/30"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
      }`}
      onClick={() => onSelect?.(model)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${taskColor} border`}>
            <Icon name={taskIcon} className="text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">{model.name}</h3>
            <p className="text-[11px] text-slate-400 font-mono">{model.model_id}</p>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {model.parameter_count}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-2">{model.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {model.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-100">
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
        <a
          href={model.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-toll-text-light hover:text-toll-blue flex items-center gap-1 transition-colors"
        >
          <Icon name="open_in_new" className="text-sm" />
          HuggingFace
        </a>
        <div className="flex-1" />
        {onDownload && (
          downloaded ? (
            <span className="text-[11px] px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-lg font-medium flex items-center gap-1">
              <Icon name="check_circle" className="text-sm" />
              Downloaded
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(model);
              }}
              disabled={downloading}
              className="text-[11px] px-3 py-1.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Icon name={downloading ? "hourglass_empty" : "download"} className="text-sm" />
              {downloading ? "Downloading..." : "Download"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
