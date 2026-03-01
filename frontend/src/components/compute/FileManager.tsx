"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { compute } from "@/lib/api";
import type { WorkspaceFile } from "@/lib/types";

interface FileManagerProps {
  files: WorkspaceFile[];
  onRefresh: () => void;
  onPreview: (filename: string) => void;
}

function fileIcon(name: string): { icon: string; color: string } {
  if (name.endsWith(".csv")) return { icon: "table_chart", color: "text-cyan-400" };
  if (name.endsWith(".json")) return { icon: "data_object", color: "text-orange-400" };
  if (name.endsWith(".py")) return { icon: "code", color: "text-green-400" };
  if (name.endsWith(".txt")) return { icon: "description", color: "text-slate-400" };
  if (name.endsWith(".parquet")) return { icon: "storage", color: "text-purple-400" };
  return { icon: "insert_drive_file", color: "text-slate-400" };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileManager({ files, onRefresh, onPreview }: FileManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlFilename, setUrlFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── Upload a single file ───────────────────────────────────── */
  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        await compute.uploadFile(file);
        onRefresh();
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [onRefresh],
  );

  /* ── Drag & drop ────────────────────────────────────────────── */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  /* ── URL import ─────────────────────────────────────────────── */
  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    setImporting(true);
    try {
      await compute.importUrl(urlInput.trim(), urlFilename.trim() || undefined);
      setUrlInput("");
      setUrlFilename("");
      setShowUrl(false);
      onRefresh();
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  /* ── Delete file ────────────────────────────────────────────── */
  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    try {
      await compute.deleteFile(filename);
      onRefresh();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <aside
      className="w-60 shrink-0 bg-[#0d0d14] border-r border-white/5 flex flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowUrl(!showUrl)}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-colors"
            title="Import from URL"
          >
            <Icon name="link" className="text-sm" />
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-green-400 transition-colors"
            title="Upload file"
          >
            <Icon name="upload_file" className="text-sm" />
          </button>
          <button
            onClick={onRefresh}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <Icon name="refresh" className="text-sm" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,.txt,.py,.parquet,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />

      {/* URL import panel */}
      {showUrl && (
        <div className="p-2 border-b border-white/5 space-y-1.5 bg-white/[0.02]">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/data.csv"
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
          />
          <input
            value={urlFilename}
            onChange={(e) => setUrlFilename(e.target.value)}
            placeholder="filename (optional)"
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
          />
          <button
            onClick={handleImportUrl}
            disabled={importing || !urlInput.trim()}
            className="w-full py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs font-medium rounded border border-cyan-500/20 disabled:opacity-40 transition-colors"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
        {uploading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-blue-400 animate-pulse">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        )}

        {files.length === 0 && !uploading && (
          <div className="px-3 py-8 text-center">
            <Icon name="cloud_upload" className="text-3xl text-slate-600 mb-2" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Drop files here or click{" "}
              <button onClick={() => inputRef.current?.click()} className="text-cyan-400 hover:underline">
                upload
              </button>
            </p>
          </div>
        )}

        {files.map((f) => {
          const { icon, color } = fileIcon(f.name);
          return (
            <div
              key={f.name}
              className="group flex items-center gap-2 py-1.5 px-3 hover:bg-white/5 cursor-pointer text-xs"
              onClick={() => onPreview(f.name)}
            >
              <Icon name={icon} className={`text-sm ${color} shrink-0`} />
              <span className="text-slate-300 group-hover:text-white truncate flex-1 min-w-0">
                {f.name}
              </span>
              <span className="text-[10px] text-slate-600 shrink-0">{formatSize(f.size)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(f.name);
                }}
                className="w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all shrink-0"
                title="Delete"
              >
                <Icon name="close" className="text-xs" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-cyan-500/10 border-2 border-dashed border-cyan-400/40 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Icon name="cloud_upload" className="text-4xl text-cyan-400 mb-2" />
            <p className="text-sm text-cyan-400 font-medium">Drop file to upload</p>
          </div>
        </div>
      )}
    </aside>
  );
}
