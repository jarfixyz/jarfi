"use client";

import type { PillTab } from "@/components/ui/pill-tabs";

export type JarView = "grid" | "list";

interface FilterBarProps {
  tabs: PillTab[];
  activeTab: string;
  onTabSelect: (key: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  view: JarView;
  onViewChange: (view: JarView) => void;
}

export function FilterBar({
  tabs,
  activeTab,
  onTabSelect,
  search,
  onSearchChange,
  view,
  onViewChange,
}: FilterBarProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div
        className="inline-flex gap-1 rounded-full p-1"
        style={{
          background: "var(--h-card-warm)",
          border: "1px solid var(--h-line-2)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabSelect(tab.key)}
              className="rounded-full px-4 py-[7px] text-[13px] font-semibold transition-all"
              style={
                isActive
                  ? {
                      background: "var(--h-accent)",
                      color: "#F1F0EC",
                      border: "1px solid var(--h-accent)",
                    }
                  : {
                      color: "var(--h-ink-3)",
                      background: "transparent",
                      border: "1px solid transparent",
                    }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 max-sm:justify-between">
      <div
        className="inline-flex items-center rounded-[10px] p-[3px]"
        style={{
          background: "var(--h-card-warm)",
          border: "1px solid var(--h-line-2)",
        }}
        role="tablist"
        aria-label="View mode"
      >
        {(["grid", "list"] as const).map((mode) => {
          const isActive = view === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={mode === "grid" ? "Grid view" : "List view"}
              onClick={() => onViewChange(mode)}
              className="flex h-7 w-7 items-center justify-center rounded-[7px] transition-all"
              style={
                isActive
                  ? { background: "var(--h-card)", color: "var(--h-ink)", border: "1px solid var(--h-line-2)" }
                  : { background: "transparent", color: "var(--h-ink-3)", border: "1px solid transparent" }
              }
            >
              {mode === "grid" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.2" />
                  <rect x="14" y="3" width="7" height="7" rx="1.2" />
                  <rect x="3" y="14" width="7" height="7" rx="1.2" />
                  <rect x="14" y="14" width="7" height="7" rx="1.2" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: "var(--h-ink-3)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search jars..."
          className="w-[240px] rounded-[12px] py-2 pl-9 pr-3 text-[13px] outline-none transition-colors max-sm:w-full"
          style={{
            background: "var(--h-card)",
            border: "1px solid var(--h-line)",
            color: "var(--h-ink)",
          }}
        />
      </div>
      </div>
    </div>
  );
}
