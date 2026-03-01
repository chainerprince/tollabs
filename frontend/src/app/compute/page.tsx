"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { compute } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import FileManager from "@/components/compute/FileManager";
import CodeCell from "@/components/compute/CodeCell";
import NotebookToolbar from "@/components/compute/NotebookToolbar";
import AiAssistPanel from "@/components/compute/AiAssistPanel";
import type { WorkspaceFile } from "@/lib/types";

/**
 * Split strategy Python code into logical notebook cells.
 * Splits on major comment section headers (lines starting with # ──, # ---,
 * # ===, or consecutive blank lines between code blocks).
 */
function splitStrategyIntoCells(code: string): string[] {
  const lines = code.split("\n");
  const cells: string[] = [];
  let current: string[] = [];

  const isSectionHeader = (line: string) =>
    /^#\s*(──|---|===|\*\*|##)/.test(line.trim()) ||
    /^#\s*(?:Step|Section|Part|Phase)\s*\d/i.test(line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start a new cell on a section header (if we already have content)
    if (isSectionHeader(line) && current.some((l) => l.trim() !== "" && !l.trim().startsWith("#"))) {
      cells.push(current.join("\n").trim());
      current = [line];
      continue;
    }

    // Split on double blank lines separating code blocks
    if (
      line.trim() === "" &&
      i + 1 < lines.length &&
      lines[i + 1].trim() === "" &&
      current.some((l) => l.trim() !== "" && !l.trim().startsWith("#"))
    ) {
      cells.push(current.join("\n").trim());
      current = [];
      i++; // skip the second blank line
      continue;
    }

    current.push(line);
  }

  if (current.some((l) => l.trim() !== "")) {
    cells.push(current.join("\n").trim());
  }

  // If nothing split, fall back to the whole code as one cell
  if (cells.length === 0) cells.push(code.trim());

  return cells.filter((c) => c.trim() !== "");
}

interface Cell {
  id: number;
  code: string;
  output?: string;
  running: boolean;
}

function ComputePageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── State ──────────────────────────────────────────────────── */
  const [cells, setCells] = useState<Cell[]>([
    { id: 1, code: "", running: false },
  ]);
  const [nextId, setNextId] = useState(2);
  const [gpuReady, setGpuReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [previewData, setPreviewData] = useState<{
    filename: string;
    content: string;
  } | null>(null);
  const [strategyBanner, setStrategyBanner] = useState<{
    summary: string;
    description: string;
  } | null>(null);

  /* ── Bootstrap ──────────────────────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setGpuReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  /* ── Load strategy code from Build tab if redirected ─────────── */
  useEffect(() => {
    if (searchParams.get("strategy") !== "1") return;

    const code = localStorage.getItem("tollabs_strategy_code");
    if (!code) return;

    const summary = localStorage.getItem("tollabs_strategy_summary") || "";
    const description = localStorage.getItem("tollabs_strategy_description") || "";

    // Clear so we don't re-load on refresh
    localStorage.removeItem("tollabs_strategy_code");
    localStorage.removeItem("tollabs_strategy_summary");
    localStorage.removeItem("tollabs_strategy_description");

    // Split the strategy code into logical cells
    const codeCells = splitStrategyIntoCells(code);

    // Build cells: header cell + strategy cells + empty trailing cell
    let id = 1;
    const headerCell: Cell = {
      id: id++,
      code: `# ━━━ Strategy from TOLLABS Builder ━━━\n# ${description.replace(/\n/g, "\n# ")}\n#\n# Edit any cell below, add new cells, or run all to test.\nprint("Strategy loaded into notebook ✓")`,
      running: false,
    };
    const strategyCells: Cell[] = codeCells.map((c) => ({
      id: id++,
      code: c,
      running: false,
    }));
    const trailingCell: Cell = {
      id: id++,
      code: "# Continue building your strategy here...\n",
      running: false,
    };

    setCells([headerCell, ...strategyCells, trailingCell]);
    setNextId(id);
    if (summary || description) {
      setStrategyBanner({ summary, description });
    }
  }, [searchParams]);

  const refreshFiles = useCallback(async () => {
    try {
      const res = await compute.listFiles();
      setFiles(res.files);
    } catch {
      /* user might not be logged in yet */
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  /* ── Cell execution ─────────────────────────────────────────── */
  const runCell = useCallback(
    async (cellId: number, code: string) => {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId ? { ...c, running: true, output: undefined } : c,
        ),
      );
      try {
        const result = await compute.runCell(code, sessionId);
        if (!sessionId) setSessionId(result.session_id);
        const output = [
          result.stdout,
          result.stderr ? `⚠ ${result.stderr}` : "",
          result.result && result.result !== "None" ? `→ ${result.result}` : "",
          result.error ? `\n${result.error}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId ? { ...c, running: false, output: output || "(no output)" } : c,
          ),
        );
        // Refresh files after execution (code might write files)
        refreshFiles();
      } catch (err) {
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? { ...c, running: false, output: `Error: ${String(err)}` }
              : c,
          ),
        );
      }
    },
    [sessionId, refreshFiles],
  );

  /* ── Cell CRUD ──────────────────────────────────────────────── */
  const addCell = (code = "") => {
    setCells((prev) => [...prev, { id: nextId, code, running: false }]);
    setNextId((n) => n + 1);
  };

  const deleteCell = (cellId: number) => {
    setCells((prev) => {
      const filtered = prev.filter((c) => c.id !== cellId);
      return filtered.length === 0
        ? [{ id: nextId, code: "", running: false }]
        : filtered;
    });
    if (cells.length <= 1) setNextId((n) => n + 1);
  };

  const runAll = async () => {
    for (const cell of cells) {
      await runCell(cell.id, cell.code);
    }
  };

  const resetSession = async () => {
    try {
      await compute.resetSession();
      setSessionId(undefined);
      setCells([{ id: nextId, code: "", running: false }]);
      setNextId((n) => n + 1);
    } catch {
      /* ignore */
    }
  };

  /* ── File preview ───────────────────────────────────────────── */
  const handlePreview = async (filename: string) => {
    try {
      const res = await compute.previewFile(filename);
      setPreviewData({ filename, content: res.preview });
    } catch {
      setPreviewData({ filename, content: "(unable to preview)" });
    }
  };

  /* ── Notebook context for AI ────────────────────────────────── */
  const notebookContext = cells.map((c) => c.code).join("\n\n");
  const fileNames = files.map((f) => f.name);

  return (
    <div className="bg-[#09090f] text-white h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="h-11 bg-[#0d0d14] border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-toll-blue/20 flex items-center justify-center">
              <Icon name="terminal" className="text-toll-blue text-base" />
            </div>
            <span className="text-sm font-bold text-white/90">TOLLABS</span>
            <span className="text-[10px] text-slate-600 font-mono">
              Cloud Notebook
            </span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <button
              onClick={() => router.push("/")}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => router.push("/marketplace")}
              className="hover:text-white transition-colors"
            >
              Marketplace
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/marketplace")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-toll-blue/10 hover:bg-toll-blue/20 text-toll-blue border border-toll-blue/20 rounded-lg text-[11px] font-medium transition-colors"
          >
            <Icon name="publish" className="text-sm" />
            Deploy
          </button>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">{user.email}</span>
              <div className="w-6 h-6 rounded-full bg-toll-blue/30 flex items-center justify-center text-[10px] text-toll-blue font-bold">
                {user.email[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Main body ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* File manager */}
        <FileManager
          files={files}
          onRefresh={refreshFiles}
          onPreview={handlePreview}
        />

        {/* Notebook area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#09090f]">
          <NotebookToolbar
            cellCount={cells.length}
            onAddCell={() => addCell()}
            onRunAll={runAll}
            onResetSession={resetSession}
            gpuReady={gpuReady}
            showAi={showAi}
            onToggleAi={() => setShowAi(!showAi)}
          />

          {/* File preview banner */}
          {previewData && (
            <div className="border-b border-white/[0.04] bg-[#0d0d14]">
              <div className="flex items-center justify-between px-4 py-1.5">
                <div className="flex items-center gap-2">
                  <Icon name="visibility" className="text-cyan-400 text-sm" />
                  <span className="text-[11px] text-slate-300 font-mono">
                    {previewData.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      addCell(
                        `import pandas as pd\ndf = pd.read_csv("${previewData.filename}")\ndf.head()`,
                      );
                      setPreviewData(null);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Load in cell →
                  </button>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="text-slate-600 hover:text-white transition-colors"
                  >
                    <Icon name="close" className="text-sm" />
                  </button>
                </div>
              </div>
              <pre className="px-4 pb-2 text-[11px] text-slate-400 font-mono max-h-32 overflow-y-auto custom-scrollbar whitespace-pre leading-relaxed">
                {previewData.content}
              </pre>
            </div>
          )}

          {/* Strategy import banner */}
          {strategyBanner && (
            <div className="border-b border-blue-500/10 bg-blue-500/[0.04]">
              <div className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Icon name="auto_awesome" className="text-blue-400 text-base" />
                  </div>
                  <div>
                    <p className="text-[12px] text-blue-300 font-semibold">
                      Strategy imported from NL Builder
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl truncate">
                      {strategyBanner.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push("/researcher/dashboard")}
                    className="text-[11px] text-slate-500 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <Icon name="arrow_back" className="text-sm" />
                    Back to Builder
                  </button>
                  <button
                    onClick={() => setStrategyBanner(null)}
                    className="text-slate-600 hover:text-white transition-colors"
                  >
                    <Icon name="close" className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cells */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {cells.map((cell) => (
              <CodeCell
                key={cell.id}
                id={cell.id}
                initialCode={cell.code}
                output={cell.output}
                isRunning={cell.running}
                onRun={(code) => runCell(cell.id, code)}
                onDelete={() => deleteCell(cell.id)}
              />
            ))}

            {/* Add cell button */}
            <button
              onClick={() => addCell()}
              className="w-full border border-dashed border-white/[0.06] hover:border-blue-500/20 rounded-lg py-3 text-slate-600 hover:text-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="add" className="text-sm" />
              Add Code Cell
            </button>
          </div>

          {/* Bottom status bar */}
          <div className="h-6 bg-[#0d0d14] border-t border-white/[0.04] flex items-center justify-between px-4 text-[10px] font-mono text-slate-600 shrink-0">
            <div className="flex items-center gap-4">
              <span className={gpuReady ? "text-green-500" : "text-yellow-500"}>
                ● {gpuReady ? "Connected" : "Booting"}
              </span>
              <span>Python 3.11</span>
              <span>{files.length} file{files.length !== 1 && "s"}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{cells.length} cell{cells.length !== 1 && "s"}</span>
              <span>⌘⏎ Run</span>
            </div>
          </div>
        </main>

        {/* AI assist panel */}
        {showAi && (
          <AiAssistPanel
            files={fileNames}
            notebookContext={notebookContext}
            onInsertCode={(code) => addCell(code)}
          />
        )}
      </div>
    </div>
  );
}

export default function ComputePage() {
  return (
    <Suspense fallback={<div className="bg-[#09090f] text-white h-screen flex items-center justify-center text-sm text-slate-500">Loading notebook…</div>}>
      <ComputePageInner />
    </Suspense>
  );
}
