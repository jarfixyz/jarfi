"use client";

export interface PillTab {
  key: string;
  label: string;
  done?: boolean;
}

interface PillTabsProps {
  tabs: PillTab[];
  active: string;
  onSelect: (key: string) => void;
}

export function PillTabs({ tabs, active, onSelect }: PillTabsProps) {
  return (
    <div className="inline-flex gap-1 rounded-pill bg-bg-alt p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const isDone = tab.done && !isActive;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.key)}
            className={`rounded-pill px-4 py-[7px] text-[13px] font-semibold transition-colors ${
              isActive
                ? "bg-coral text-white"
                : isDone
                  ? "bg-forest-soft text-forest"
                  : "text-mute hover:text-ink"
            }`}
          >
            {isDone && <span aria-hidden>✓ </span>}{tab.label}
          </button>
        );
      })}
    </div>
  );
}
