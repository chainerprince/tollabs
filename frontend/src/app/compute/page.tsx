"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { compute, auth as authApi } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import CodeCell from "@/components/compute/CodeCell";
import AiAssistPanel from "@/components/compute/AiAssistPanel";
import type { WorkspaceFile, ProjectSummary, ProjectDetail, GpuTier } from "@/lib/types";

/* ── Types ────────────────────────────────────────────────────── */
interface Cell {
  id: number;
  code: string;
  title?: string;
  output?: string;
  running: boolean;
}

/* ── Main page wrapper ────────────────────────────────────────── */
export default function ComputePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#09090f] text-white h-screen flex items-center justify-center text-sm text-slate-500">
          Loading editor…
        </div>
      }
    >
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── State ──────────────────────────────────────────────────── */
  // Projects
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // File preview
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  // Notebook cells
  const [cells, setCells] = useState<Cell[]>([
    { id: 1, code: "# Select or create a project to get started\n", running: false },
  ]);
  const [nextId, setNextId] = useState(2);

  // Compute
  const [gpuTiers, setGpuTiers] = useState<GpuTier[]>([]);
  const [selectedGpu, setSelectedGpu] = useState("t4");
  const [gpuReady, setGpuReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [showAi, setShowAi] = useState(false);
  const [hasModalCreds, setHasModalCreds] = useState<boolean | null>(null);

  // Workspace files
  const [files, setFiles] = useState<WorkspaceFile[]>([]);

  /* ── Boot ───────────────────────────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setGpuReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check Modal credentials — always call API for fresh status
  useEffect(() => {
    authApi
      .getModalCredentials()
      .then((r) => setHasModalCreds(r.has_credentials))
      .catch(() => setHasModalCreds(false));
  }, []);

  // Load projects
  useEffect(() => {
    setProjectsLoading(true);
    compute
      .listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, []);

  // Load GPU tiers
  useEffect(() => {
    compute.gpuTiers().then(setGpuTiers).catch(() => {});
  }, []);

  // Load workspace files
  const refreshFiles = useCallback(async () => {
    try {
      const res = await compute.listFiles();
      setFiles(res.files);
    } catch { /* user might not be logged in */ }
  }, []);
  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  /* ── Auto-open project from query params ────────────────────── */
  useEffect(() => {
    const slug = searchParams.get("project");
    if (!slug) return;

    compute
      .getProject(slug)
      .then((proj) => {
        openProjectFromDetail(proj);
      })
      .catch(() => {});
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Project actions ────────────────────────────────────────── */
  const openProject = async (slug: string) => {
    try {
      const proj = await compute.getProject(slug);
      openProjectFromDetail(proj);
    } catch { /* ignore */ }
  };

  const openProjectFromDetail = (proj: ProjectDetail) => {
    setActiveProject(proj);
    setExpandedProject(proj.slug);
    setSelectedGpu(proj.gpu_tier || "t4");
    setPreviewFile(null);

    // Load cells from project
    if (proj.cells && proj.cells.length > 0) {
      let id = 1;
      const newCells: Cell[] = proj.cells.map((c) => ({
        id: id++,
        code: c.code,
        title: c.title,
        running: false,
      }));
      newCells.push({ id: id++, code: "# Continue building here...\n", running: false });
      setCells(newCells);
      setNextId(id);
    }
  };

  const handleFileClick = async (slug: string, filename: string) => {
    try {
      const res = await compute.getProjectFile(slug, filename);
      setPreviewFile({ name: filename, content: res.content });
    } catch { /* ignore */ }
  };

  /* ── GPU change ─────────────────────────────────────────────── */
  const handleGpuChange = (gpuId: string) => {
    setSelectedGpu(gpuId);
    if (activeProject) {
      compute.updateGpu(activeProject.slug, gpuId).catch(() => {});
    }
  };

  /* ── Cell execution ─────────────────────────────────────────── */
  const runCell = useCallback(
    async (cellId: number, code: string) => {
      setCells((prev) =>
        prev.map((c) => (c.id === cellId ? { ...c, running: true, output: undefined } : c))
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
            c.id === cellId ? { ...c, running: false, output: output || "(no output)" } : c
          )
        );
        refreshFiles();
      } catch (err) {
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId ? { ...c, running: false, output: `Error: ${String(err)}` } : c
          )
        );
      }
    },
    [sessionId, refreshFiles]
  );

  /* ── Cell CRUD ──────────────────────────────────────────────── */
  const addCell = (code = "") => {
    setCells((prev) => [...prev, { id: nextId, code, running: false }]);
    setNextId((n) => n + 1);
  };

  const deleteCell = (cellId: number) => {
    setCells((prev) => {
      const filtered = prev.filter((c) => c.id !== cellId);
      return filtered.length === 0 ? [{ id: nextId, code: "", running: false }] : filtered;
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
    } catch { /* ignore */ }
  };

  /* ── Save & Publish ─────────────────────────────────────────── */
  const handleSaveAndPublish = async () => {
    if (!activeProject) return;
    const cellData = cells.map((c) => ({ title: c.title || "", code: c.code }));
    await compute.saveCells(activeProject.slug, cellData).catch(() => {});
    router.push("/researcher/dashboard");
  };

  /* ── Notebook context for AI ────────────────────────────────── */
  const notebookContext = cells.map((c) => c.code).join("\n\n");
  const fileNames = files.map((f) => f.name);

  const currentGpu = gpuTiers.find((g) => g.id === selectedGpu);

  return (
    <div className="bg-[#09090f] text-white h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="h-11 bg-[#0d0d14] border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-toll-blue/20 flex items-center justify-center">
              <Icon name="code" className="text-toll-blue text-base" />
            </div>
            <span className="text-sm font-bold text-white/90">TOLLABS</span>
            <span className="text-[10px] text-slate-600 font-mono">Research Editor</span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <button onClick={() => router.push("/")} className="hover:text-white transition-colors">
              Home
            </button>
            <button onClick={() => router.push("/researcher/training")} className="hover:text-white transition-colors">
              Model Hub
            </button>
            <button onClick={() => router.push("/marketplace")} className="hover:text-white transition-colors">
              Marketplace
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeProject && (
            <button
              onClick={handleSaveAndPublish}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-medium transition-colors"
            >
              <Icon name="publish" className="text-sm" />
              Save &amp; Publish
            </button>
          )}
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
        {/* ── Left sidebar: Projects ─────────────────────────── */}
        <aside className="w-64 shrink-0 bg-[#0d0d14] border-r border-white/5 flex flex-col overflow-hidden">
          {/* Projects header */}
          <div className="h-10 border-b border-white/5 flex items-center justify-between px-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => router.push("/researcher/training")}
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-green-400 transition-colors"
              title="New project from Model Hub"
            >
              <Icon name="add" className="text-sm" />
            </button>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
            {projectsLoading && (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                Loading projects…
              </div>
            )}

            {!projectsLoading && projects.length === 0 && (
              <div className="px-3 py-8 text-center">
                <Icon name="folder_open" className="text-3xl text-slate-700 mb-2" />
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  No projects yet. Pick a model from the Hub to start.
                </p>
                <button
                  onClick={() => router.push("/researcher/training")}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  → Open Model Hub
                </button>
              </div>
            )}

            {projects.map((p) => {
              const isActive = activeProject?.slug === p.slug;
              const isExpanded = expandedProject === p.slug;
              return (
                <div key={p.slug}>
                  {/* Project folder row */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition-colors ${
                      isActive
                        ? "bg-toll-blue/10 text-toll-blue"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedProject(null);
                      } else {
                        setExpandedProject(p.slug);
                        openProject(p.slug);
                      }
                    }}
                  >
                    <Icon
                      name={isExpanded ? "folder_open" : "folder"}
                      className={`text-sm ${isActive ? "text-toll-blue" : "text-amber-400/80"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.model_name}</p>
                      <p className="text-[9px] text-slate-500 font-mono truncate">{p.model_id}</p>
                    </div>
                    <span className="text-[9px] text-slate-600">{p.file_count}f</span>
                  </div>

                  {/* Expanded file tree */}
                  {isExpanded && activeProject?.slug === p.slug && activeProject.files && (
                    <div className="bg-white/[0.02] border-b border-white/5">
                      {activeProject.files.map((f) => {
                        const ext = f.name.split(".").pop() || "";
                        const iconMap: Record<string, { i: string; c: string }> = {
                          py: { i: "code", c: "text-green-400" },
                          md: { i: "description", c: "text-blue-400" },
                          txt: { i: "text_snippet", c: "text-slate-400" },
                          json: { i: "data_object", c: "text-orange-400" },
                        };
                        const fi = iconMap[ext] || { i: "insert_drive_file", c: "text-slate-500" };
                        return (
                          <div
                            key={f.name}
                            className="flex items-center gap-2 px-3 pl-8 py-1.5 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white cursor-pointer transition-colors"
                            onClick={() => handleFileClick(p.slug, f.name)}
                          >
                            <Icon name={fi.i} className={`text-xs ${fi.c}`} />
                            <span className="truncate font-mono">{f.name}</span>
                            <span className="text-[9px] text-slate-600 ml-auto">
                              {f.size < 1024
                                ? `${f.size}B`
                                : `${(f.size / 1024).toFixed(1)}K`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* GPU selector at bottom of sidebar */}
          <div className="border-t border-white/5 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="memory" className="text-sm text-purple-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GPU Runtime
              </span>
            </div>
            <select
              value={selectedGpu}
              onChange={(e) => handleGpuChange(e.target.value)}
              className="w-full bg-[#12121c] border border-white/10 rounded-lg px-2.5 py-2 text-[11px] text-white focus:border-purple-500/40 focus:outline-none appearance-none"
            >
              {gpuTiers.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.vram} {g.price_hr > 0 ? `($${g.price_hr}/hr)` : "(free)"}
                </option>
              ))}
            </select>
            {currentGpu && (
              <p className="text-[9px] text-slate-500 leading-relaxed">{currentGpu.desc}</p>
            )}
          </div>
        </aside>

        {/* ── Notebook area ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#09090f]">
          {/* Toolbar */}
          <div className="h-10 bg-[#0d0d14] border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={runAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md text-xs font-medium transition-colors"
              >
                <Icon name="play_arrow" className="text-sm" />
                Run All
              </button>
              <button
                onClick={() => addCell()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-white rounded-md text-xs font-medium transition-colors"
              >
                <Icon name="add" className="text-sm" />
                Cell
              </button>
              <button
                onClick={resetSession}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-orange-400 rounded-md text-xs font-medium transition-colors"
                title="Reset session (clear all variables)"
              >
                <Icon name="restart_alt" className="text-sm" />
                Reset
              </button>
              <div className="h-4 w-px bg-white/5 mx-1" />
              <span className="text-[10px] text-slate-600 font-mono">
                {cells.length} cell{cells.length !== 1 && "s"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {activeProject && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] rounded-md text-[10px] text-slate-400 font-mono">
                  <Icon name="smart_toy" className="text-xs text-amber-400" />
                  {activeProject.model_id.length > 35
                    ? "..." + activeProject.model_id.slice(-32)
                    : activeProject.model_id}
                </div>
              )}
              <button
                onClick={() => setShowAi(!showAi)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showAi
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/20"
                    : "bg-white/[0.03] hover:bg-purple-500/10 text-slate-400 hover:text-purple-300"
                }`}
              >
                <Icon name="auto_awesome" className="text-sm" />
                AI Assist
              </button>
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                  gpuReady
                    ? "bg-green-500/10 text-green-400"
                    : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    gpuReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"
                  }`}
                />
                {currentGpu?.name || "GPU"} {gpuReady ? "Ready" : "Booting"}
              </div>
            </div>
          </div>

          {/* Cells */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {/* File preview banner */}
            {previewFile && (
              <div className="rounded-lg border border-white/[0.04] bg-[#0d0d14] -mt-2 mb-3">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <Icon name="visibility" className="text-cyan-400 text-sm" />
                    <span className="text-[11px] text-slate-300 font-mono">
                      {previewFile.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        addCell(previewFile.content);
                        setPreviewFile(null);
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Load in cell →
                    </button>
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="text-slate-600 hover:text-white transition-colors"
                    >
                      <Icon name="close" className="text-sm" />
                    </button>
                  </div>
                </div>
                <pre className="px-4 pb-2 text-[11px] text-slate-400 font-mono max-h-40 overflow-y-auto custom-scrollbar whitespace-pre leading-relaxed">
                  {previewFile.content}
                </pre>
              </div>
            )}

            {/* Active project banner */}
            {activeProject && (
              <div className="rounded-lg border border-purple-500/10 bg-purple-500/[0.04] -mt-2 mb-3">
              <div className="flex items-center justify-between px-5 py-2">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Icon name="psychology" className="text-purple-400 text-base" />
                  </div>
                  <div>
                    <p className="text-[12px] text-purple-300 font-semibold">
                      {activeProject.model_name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {activeProject.task} · {activeProject.parameter_count} params ·{" "}
                      {activeProject.cells?.length || 0} cells
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://huggingface.co/${activeProject.model_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-500 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    <Icon name="open_in_new" className="text-xs" />
                    HuggingFace
                  </a>
                  <button
                    onClick={handleSaveAndPublish}
                    className="text-[10px] px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-md font-medium hover:bg-emerald-500/25 transition-colors flex items-center gap-1"
                  >
                    <Icon name="publish" className="text-xs" />
                    Save &amp; Publish →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal credentials warning */}
          {hasModalCreds === false && (
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.04] mb-3">
              <div className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Icon name="vpn_key" className="text-amber-400 text-base" />
                  </div>
                  <div>
                    <p className="text-[12px] text-amber-300 font-semibold">
                      Modal GPU credentials not set
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Add your Modal Token ID &amp; Secret in Settings to run GPU workloads.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/settings")}
                  className="text-[11px] px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/20 rounded-lg font-medium hover:bg-amber-500/25 transition-colors flex items-center gap-1"
                >
                  <Icon name="settings" className="text-sm" />
                  Go to Settings
                </button>
              </div>
            </div>
          )}

            {/* Welcome screen when no project loaded */}
            {!activeProject && projects.length === 0 && !projectsLoading && (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/5">
                    <Icon name="biotech" className="text-3xl text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    Research Editor
                  </h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Pick an open-source model from the Hub to start a project.
                    We&apos;ll generate Python code to load, evaluate, and
                    fine-tune the model — like working in Colab.
                  </p>
                  <button
                    onClick={() => router.push("/researcher/training")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-toll-blue hover:bg-toll-blue/80 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Icon name="hub" className="text-lg" />
                    Open Model Hub
                  </button>
                </div>
              </div>
            )}

            {/* Cells */}
            {(activeProject || cells.some((c) => c.code.trim())) &&
              cells.map((cell, idx) => (
                <div key={cell.id}>
                  {/* Cell title badge */}
                  {cell.title && (
                    <div className="flex items-center gap-2 mb-1 ml-1">
                      <span className="text-[9px] font-bold text-purple-400/70 uppercase tracking-wider">
                        {idx + 1}. {cell.title}
                      </span>
                    </div>
                  )}
                  <CodeCell
                    id={cell.id}
                    initialCode={cell.code}
                    output={cell.output}
                    isRunning={cell.running}
                    onRun={(code) => runCell(cell.id, code)}
                    onDelete={() => deleteCell(cell.id)}
                  />
                </div>
              ))}

            {/* Add cell button */}
            {(activeProject || cells.some((c) => c.code.trim())) && (
              <button
                onClick={() => addCell()}
                className="w-full border border-dashed border-white/[0.06] hover:border-blue-500/20 rounded-lg py-3 text-slate-600 hover:text-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Icon name="add" className="text-sm" />
                Add Code Cell
              </button>
            )}
          </div>

          {/* Bottom status bar */}
          <div className="h-6 bg-[#0d0d14] border-t border-white/[0.04] flex items-center justify-between px-4 text-[10px] font-mono text-slate-600 shrink-0">
            <div className="flex items-center gap-4">
              <span className={gpuReady ? "text-green-500" : "text-yellow-500"}>
                ● {gpuReady ? "Connected" : "Booting"}
              </span>
              <span>Python 3.11</span>
              <span>{currentGpu?.name || "CPU"} · {currentGpu?.vram || "—"}</span>
              {activeProject && (
                <span className="text-purple-400/60">{activeProject.model_id}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span>
                {cells.length} cell{cells.length !== 1 && "s"}
              </span>
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
