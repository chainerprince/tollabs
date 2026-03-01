"use client";

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = ["All Models", "Forex", "Stocks"];

export default function FilterBar({ activeFilter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
            activeFilter === f
              ? "bg-toll-blue text-white shadow-sm shadow-toll-blue/30"
              : "bg-white border border-slate-200 text-toll-text-light hover:text-toll-text hover:border-slate-300"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
