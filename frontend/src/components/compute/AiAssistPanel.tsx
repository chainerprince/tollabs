"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { ai } from "@/lib/api";

interface AiAssistPanelProps {
  /** List of workspace filenames for context */
  files: string[];
  /** Current code from all cells, concatenated */
  notebookContext: string;
  /** Called with generated code to insert a new cell */
  onInsertCode: (code: string) => void;
}

const QUICK_PROMPTS = [
  "Load the CSV file and show first 5 rows",
  "Plot closing prices over time",
  "Calculate daily returns and show statistics",
  "Train a simple linear regression model",
  "Compute correlation matrix and visualize it",
  "Detect outliers in the data",
];

export default function AiAssistPanel({ files, notebookContext, onInsertCode }: AiAssistPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerate = async (text?: string) => {
    const p = text ?? prompt.trim();
    if (!p) return;
    setLoading(true);
    setError(null);
    setGeneratedCode(null);
    try {
      const res = await ai.codeAssist(p, notebookContext, files);
      setGeneratedCode(res.code);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (generatedCode) {
      onInsertCode(generatedCode);
      setGeneratedCode(null);
      setPrompt("");
    }
  };

  return (
    <div className="w-80 shrink-0 bg-[#0d0d14] border-l border-white/5 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-white/5 flex items-center gap-2 px-3">
        <Icon name="auto_awesome" className="text-purple-400 text-sm" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          AI Assistant
        </span>
      </div>

      {/* Quick prompts */}
      <div className="p-2 border-b border-white/5 space-y-1">
        <p className="text-[10px] text-slate-500 px-1 mb-1">Quick actions</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setPrompt(q);
                handleGenerate(q);
              }}
              disabled={loading}
              className="px-2 py-1 bg-white/[0.03] hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 rounded text-[10px] text-slate-400 hover:text-purple-300 transition-colors disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <div className="p-2 border-b border-white/5">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Describe what you want to do..."
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-purple-500/40 focus:outline-none resize-none"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 flex items-center justify-center text-purple-300 disabled:opacity-30 transition-colors"
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="send" className="text-sm" />
            )}
          </button>
        </div>
      </div>

      {/* Generated code / result */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading && (
          <div className="flex items-center gap-2 text-purple-400 text-xs py-4 justify-center">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Generating code...
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {generatedCode && (
          <div className="space-y-2">
            <div className="bg-black/40 border border-white/10 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                <span className="text-[10px] text-slate-500">Generated Python</span>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedCode)}
                  className="text-slate-500 hover:text-white transition-colors"
                  title="Copy"
                >
                  <Icon name="content_copy" className="text-xs" />
                </button>
              </div>
              <pre className="p-3 text-[11px] text-green-300 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                {generatedCode}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInsert}
                className="flex-1 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium rounded-lg border border-purple-500/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="add" className="text-sm" />
                Insert as Cell
              </button>
              <button
                onClick={() => setGeneratedCode(null)}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-lg border border-white/5 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !generatedCode && (
          <div className="py-8 text-center">
            <Icon name="auto_awesome" className="text-3xl text-slate-700 mb-2" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Describe what you want in plain English and AI will generate Python code for you.
            </p>
          </div>
        )}
      </div>

      {/* Files context */}
      {files.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2">
          <p className="text-[10px] text-slate-500 mb-1">Files in workspace</p>
          <div className="flex flex-wrap gap-1">
            {files.map((f) => (
              <span
                key={f}
                className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-slate-400 font-mono"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
