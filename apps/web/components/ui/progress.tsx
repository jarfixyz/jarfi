import { cn } from "@/lib/cn";

function clamp(value: number, max: number): number {
  if (Number.isNaN(value) || value < 0) return 0;
  if (value > max) return max;
  return value;
}

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  label,
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clamped = clamp(value, max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="mb-2 flex items-baseline justify-between text-xs font-semibold text-mute">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        className="relative h-3 w-full overflow-hidden rounded-full bg-mint-soft"
      >
        <div
          className="relative h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--color-sol-purple), var(--color-sol-green))",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-full opacity-60 animate-shimmer"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  className?: string;
}

export function ProgressRing({
  value,
  max,
  size = 160,
  stroke = 6,
  className,
}: ProgressRingProps) {
  const clamped = clamp(value, max);
  const pct = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = max > 0 ? circumference - (clamped / max) * circumference : circumference;
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="sol-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-sol-purple)" />
            <stop offset="100%" stopColor="var(--color-sol-green)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-mint-soft)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#sol-ring)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </svg>
      <span className="absolute text-2xl font-bold tabular-nums text-ink">
        {pct}%
      </span>
    </div>
  );
}
