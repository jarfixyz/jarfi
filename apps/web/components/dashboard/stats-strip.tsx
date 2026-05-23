interface Stat {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
}

export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div
      className="mb-6 grid gap-px overflow-hidden rounded-[12px] grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1"
      style={{
        background: "var(--h-line)",
        border: "0.5px solid var(--h-line)",
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-5"
          style={{ background: "var(--h-card)" }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.06em]"
            style={{ color: "var(--h-ink-3)" }}
          >
            {stat.label}
          </div>
          <div
            className="mt-2 tabular-nums"
            style={{
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              color: "var(--h-ink)",
            }}
          >
            {stat.value}
            {stat.suffix && (
              <span
                className="ml-1.5 text-[12px]"
                style={{ color: "var(--h-ink-3)", fontWeight: 500 }}
              >
                {stat.suffix}
              </span>
            )}
          </div>
          {stat.hint && (
            <div
              className="mt-1 text-[12px]"
              style={{ color: "var(--h-ink-3)" }}
            >
              {stat.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
