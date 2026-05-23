"use client";

import { type ReactNode } from "react";

interface RadioCardProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
}

export function RadioCard({
  title,
  description,
  descriptionClassName,
  icon,
  selected,
  onSelect,
}: RadioCardProps) {
  return (
    <button
      type="button"
      data-selected={selected}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-all"
      style={{
        background: selected
          ? "var(--h-card-warm, #F7F7F3)"
          : "var(--h-card, #FFFFFF)",
        border: selected
          ? "1px solid var(--h-ink, #111)"
          : "0.5px solid var(--h-line, rgba(17,17,17,0.10))",
      }}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={{
          border: selected
            ? "1.5px solid var(--h-ink, #111)"
            : "1.5px solid var(--h-line-2, rgba(17,17,17,0.15))",
        }}
      >
        {selected && (
          <span
            className="h-[9px] w-[9px] rounded-full"
            style={{ background: "var(--h-ink, #111)" }}
          />
        )}
      </span>

      {icon && <span className="shrink-0">{icon}</span>}

      <span>
        <span
          className="block text-sm font-semibold"
          style={{ color: "var(--h-ink, #111)" }}
        >
          {title}
        </span>
        {description && (
          <span
            className={`block text-xs ${descriptionClassName ?? ""}`}
            style={
              descriptionClassName
                ? undefined
                : { color: "var(--h-ink-3, #6B6B66)" }
            }
          >
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
