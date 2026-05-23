"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-[24px] w-[44px] rounded-full transition-all"
        style={{
          background: checked
            ? "var(--h-accent, #C9F04A)"
            : "var(--h-bg-2, #E6E6E2)",
          border: checked
            ? "1px solid var(--h-accent-deep, #7CA61A)"
            : "1px solid var(--h-line, rgba(17,17,17,0.10))",
          boxShadow: checked
            ? "0 1px 0 rgba(255,255,255,.4) inset, 0 4px 10px -4px rgba(124,166,26,.4)"
            : undefined,
        }}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-transform"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(0,0,0,.15)",
            left: checked ? "22px" : "2px",
          }}
        />
      </button>
      {label && (
        <span
          className="text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--h-ink-3, #6B6B66)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
