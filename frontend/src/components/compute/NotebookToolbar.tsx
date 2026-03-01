import Icon from "@/components/ui/Icon";

interface NotebookToolbarProps {
  cellCount: number;
  onAddCell: () => void;
  onRunAll: () => void;
  onResetSession: () => void;
  gpuReady: boolean;
  showAi: boolean;
  onToggleAi: () => void;
}

export default function NotebookToolbar({
  cellCount,
  onAddCell,
  onRunAll,
  onResetSession,
  gpuReady,
  showAi,
  onToggleAi,
}: NotebookToolbarProps) {
  return (
    <div className="h-10 bg-[#0d0d14] border-b border-white/[0.04] flex items-center justify-between px-4 shrink-0 z-10">
      <div className="flex items-center gap-2">
        <button
          onClick={onRunAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md text-xs font-medium transition-colors"
        >
          <Icon name="play_arrow" className="text-sm" />
          Run All
        </button>
        <button
          onClick={onAddCell}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-white rounded-md text-xs font-medium transition-colors"
        >
          <Icon name="add" className="text-sm" />
          Cell
        </button>
        <button
          onClick={onResetSession}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-orange-400 rounded-md text-xs font-medium transition-colors"
          title="Reset session (clear all variables)"
        >
          <Icon name="restart_alt" className="text-sm" />
          Reset
        </button>
        <div className="h-4 w-px bg-white/5 mx-1" />
        <span className="text-[10px] text-slate-600 font-mono">
          {cellCount} cell{cellCount !== 1 && "s"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleAi}
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
          {gpuReady ? "Connected" : "Booting"}
        </div>
      </div>
    </div>
  );
}
