"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BASE_APY, BASE_APY_PERCENT } from "@/lib/apy";

export interface TimeLockedForecastProps {
  unlockDate: Date;
  reminderFreq: "off" | "weekly" | "monthly";
  reminderAmount: number;
  apy?: number;
  height?: number;
}

interface Point {
  month: number;
  label: string;
  contributed: number;
  value: number;
}

function buildSeries(
  monthsTotal: number,
  monthlyDeposit: number,
  apy: number,
  startDate: Date,
): Point[] {
  const r = apy / 12;
  const points: Point[] = [];
  let value = 0;
  let contributed = 0;
  for (let m = 0; m <= monthsTotal; m++) {
    if (m > 0) {
      value = value * (1 + r) + monthlyDeposit;
      contributed += monthlyDeposit;
    }
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    points.push({
      month: m,
      label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
      contributed: Math.round(contributed),
      value: Math.round(value),
    });
  }
  return points;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

export function TimeLockedForecast({
  unlockDate,
  reminderFreq,
  reminderAmount,
  apy = BASE_APY,
  height = 200,
}: TimeLockedForecastProps) {
  const now = useMemo(() => new Date(), []);
  const monthsTotal = useMemo(() => {
    const ms = unlockDate.getTime() - now.getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.4375)));
  }, [now, unlockDate]);

  const monthlyDeposit = useMemo(() => {
    if (reminderFreq === "off" || !Number.isFinite(reminderAmount) || reminderAmount <= 0) return 0;
    return reminderFreq === "weekly" ? reminderAmount * (52 / 12) : reminderAmount;
  }, [reminderFreq, reminderAmount]);

  const data = useMemo(
    () => buildSeries(monthsTotal, monthlyDeposit, apy, now),
    [monthsTotal, monthlyDeposit, apy, now],
  );

  const final = data[data.length - 1]?.value ?? 0;
  const totalContributed = data[data.length - 1]?.contributed ?? 0;
  const yieldEarned = Math.max(0, final - totalContributed);

  if (monthlyDeposit <= 0) {
    return (
      <div
        className="rounded-[12px] px-5 py-6 text-center text-[13px]"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          color: "var(--h-ink-3)",
        }}
      >
        Turn on a top-up reminder on the previous step to see a forecast at
        unlock.
      </div>
    );
  }

  const unlockLabel = unlockDate.toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="rounded-[12px] p-5"
      style={{
        background: "var(--h-card)",
        border: "0.5px solid var(--h-line)",
      }}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--h-ink)",
            }}
          >
            At unlock
          </div>
          <div className="mt-0.5" style={{ fontSize: 12.5, color: "var(--h-ink-3)" }}>
            {unlockLabel} · {monthsTotal} mo · ~{BASE_APY_PERCENT}% APY
          </div>
        </div>
        <div className="text-right tabular-nums">
          <div style={{ fontSize: 11, color: "var(--h-ink-3)" }}>Projected</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "var(--h-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            ≈ {fmtUsd(final)}
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tlValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--h-accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--h-accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tlContribFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--h-ink-3)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--h-ink-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--h-line)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--h-ink-3)", fontSize: 11 }}
              axisLine={{ stroke: "var(--h-line)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: "var(--h-ink-3)", fontSize: 11 }}
              tickFormatter={(v) => fmtUsd(v as number)}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ stroke: "var(--h-line-2)", strokeDasharray: "2 4" }}
              contentStyle={{
                background: "var(--h-card)",
                border: "0.5px solid var(--h-line)",
                borderRadius: 8,
                fontSize: 12.5,
              }}
              formatter={(value, name) => [
                fmtUsd(Number(value)),
                name === "value" ? "With yield" : "Deposits only",
              ]}
            />
            <Area
              type="monotone"
              dataKey="contributed"
              stroke="var(--h-ink-3)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              fill="url(#tlContribFill)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--h-accent)"
              strokeWidth={2}
              fill="url(#tlValueFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
        <Stat label="You deposit" value={fmtUsd(totalContributed)} />
        <Stat label="Yield" value={`+${fmtUsd(yieldEarned)}`} accent />
        <Stat
          label={reminderFreq === "weekly" ? "Per week" : "Per month"}
          value={`${fmtUsd(reminderAmount)}`}
          muted
        />
      </div>

      <div className="mt-3 text-[11px]" style={{ color: "var(--h-ink-3)" }}>
        Assumes you top up on every reminder. APY floats with the market — this
        is a projection, not a promise.
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className="rounded-[8px] px-3 py-2"
      style={{
        background: "var(--h-bg)",
        border: "0.5px solid var(--h-line-2)",
      }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--h-ink-3)" }}>
        {label}
      </div>
      <div
        className="mt-0.5 tabular-nums"
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: accent ? "var(--h-accent)" : muted ? "var(--h-ink-2)" : "var(--h-ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
