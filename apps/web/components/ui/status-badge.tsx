type JarStatus = "active" | "locked" | "completed" | "cancelled" | "withdrawn";

const config: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-forest-soft text-forest" },
  locked: { label: "🔒 Locked", className: "bg-forest-soft text-forest" },
  completed: { label: "✓ Completed", className: "bg-bg-alt text-mute" },
  cancelled: { label: "Cancelled", className: "bg-bg-alt text-mute" },
  withdrawn: { label: "Withdrawn", className: "bg-bg-alt text-mute" },
};

export function StatusBadge({ status }: { status: JarStatus }) {
  const { label, className } = config[status] ?? config.active;
  return (
    <span className={`rounded-pill px-2 py-[3px] text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}
