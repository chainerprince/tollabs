"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";

interface CodeCellProps {
  id: number;
  initialCode: string;
  output?: string;
  isRunning: boolean;
  onRun: (code: string) => void;
  onDelete: () => void;
}

export default function CodeCell({ id, initialCode, output, isRunning, onRun, onDelete }: CodeCellProps) {
  const [code, setCode] = useState(initialCode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize the textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [code]);

  /* Sync if initialCode changes (e.g. AI-generated insert) */
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const hasError = output?.includes("Error:") || output?.includes("Traceback");

  return (
    <div className="group border border-white/[0.04] rounded-lg overflow-hidden bg-[#0e0e18] hover:border-blue-500/20 transition-colors">
      {/* Cell header */}
      <div className="h-8 bg-white/[0.015] flex items-center justify-between px-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-600">
            [{isRunning ? "*" : id}]
          </span>
          <span className="text-[10px] text-purple-400/70 font-medium">Python</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onRun(code)}
            disabled={isRunning}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-green-400 hover:text-green-300 disabled:opacity-40"
            title="Run Cell (⌘⏎)"
          >
            <Icon name="play_arrow" className="text-sm" />
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-slate-600 hover:text-red-400"
            title="Delete Cell"
          >
            <Icon name="delete" className="text-xs" />
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="relative">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-white/[0.01] border-r border-white/[0.03] flex flex-col pt-3 text-right pr-2 text-[11px] leading-[20px] text-slate-700 font-mono select-none pointer-events-none">
          {code.split("\n").map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onRun(code);
            }
            // Tab → 4 spaces
            if (e.key === "Tab") {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newCode = code.substring(0, start) + "    " + code.substring(end);
              setCode(newCode);
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                }
              });
            }
          }}
          className="w-full bg-transparent text-green-300/90 font-mono text-[13px] leading-[20px] p-3 pl-12 resize-none focus:outline-none min-h-[60px] placeholder:text-slate-700"
          placeholder="# Write your Python code here..."
          spellCheck={false}
        />
      </div>

      {/* Output area */}
      {(output || isRunning) && (
        <div className={`border-t border-white/[0.04] p-3 pl-12 ${hasError ? "bg-red-950/20" : "bg-black/40"}`}>
          {isRunning ? (
            <div className="flex items-center gap-2 text-blue-400 text-xs">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>Executing...</span>
            </div>
          ) : (
            <pre className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${hasError ? "text-red-400" : "text-slate-300/90"}`}>
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
