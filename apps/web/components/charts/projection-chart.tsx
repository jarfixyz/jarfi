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
import { BASE_APY } from "@/lib/apy";

const DEFAULT_APY = BASE_APY;

export interface ProjectionChartProps {
  /** Current pot in display units (e.g. dollars) */
  principal: number;
  /** Annual yield as decimal, e.g. 0.054 = 5.4% */
  apy?: number;
  /** Horizon in years */
  years?: number;
  /** Chart height in px */
  height?: number;
  /** Y-axis / tooltip unit suffix */
  unit?: string;
  /** Optional title shown above the chart */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
}

function buildSeries(principal: number, apy: number, years: number) {
  const points: { year: number; value: number; bank: number }[] = [];
  for (let y = 0; y <= years; y++) {
    const value = principal * Math.pow(1 + apy, y);
    const bank = principal * Math.pow(1 + 0.005, y);
    points.push({ year: y, value, bank });
  }
  return points;
}

function fmtCurrency(n: number, unit: string) {
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000) body = (n / 1_000_000).toFixed(1) + "M";
  else if (abs >= 1_000) body = (n / 1_000).toFixed(1) + "k";
  else body = n.toFixed(0);
  return unit === "USD" ? "$" + body : body + " " + unit;
}

export function ProjectionChart({
  principal,
  apy = DEFAULT_APY,
  years = 18,
  height = 220,
  unit = "USD",
  title,
  subtitle,
}: ProjectionChartProps) {
  const data = useMemo(
    () => buildSeries(principal, apy, years),
    [principal, apy, years],
  );

  const final = data[data.length - 1]?.value ?? 0;
  const finalBank = data[data.length - 1]?.bank ?? 0;
  const delta = final - finalBank;

  if (principal <= 0) {
    return (
      <div
        className="rounded-[12px] px-5 py-8 text-center text-[13px]"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          color: "var(--h-ink-3)",
        }}
      >
        Add funds to see your projection.
      </div>
    );
  }

  return (
    <div
      className="rounded-[12px] p-5"
      style={{
        background: "var(--h-card)",
        border: "0.5px solid var(--h-line)",
      }}
    >
      {(title || subtitle) && (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            {title && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: "var(--h-ink)",
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                className="mt-0.5"
                style={{ fontSize: 12.5, color: "var(--h-ink-3)" }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <div className="text-right tabular-nums">
            <div style={{ fontSize: 11, color: "var(--h-ink-3)" }}>
              In {years}y
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "var(--h-ink)",
                letterSpacing: "-0.01em",
              }}
            >
              ≈ {fmtCurrency(final, unit)}
            </div>
          </div>
        </div>
      )}

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="jarfiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--h-accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--h-accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bankFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--h-ink-3)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--h-ink-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="var(--h-line)"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--h-ink-3)", fontSize: 11 }}
              tickFormatter={(v) => `${v}y`}
              axisLine={{ stroke: "var(--h-line)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "var(--h-ink-3)", fontSize: 11 }}
              tickFormatter={(v) => fmtCurrency(v as number, unit)}
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
              labelFormatter={(v) => `Year ${v}`}
              formatter={(value, name) => [
                fmtCurrency(Number(value), unit),
                name === "value" ? "jarfi" : "Bank (0.5%)",
              ]}
            />
            <Area
              type="monotone"
              dataKey="bank"
              stroke="var(--h-ink-3)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              fill="url(#bankFill)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--h-accent)"
              strokeWidth={2}
              fill="url(#jarfiFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-3 flex items-center justify-between text-[12px]"
        style={{ color: "var(--h-ink-3)" }}
      >
        <span>
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: "var(--h-accent)" }}
          />
          jarfi at {(apy * 100).toFixed(1)}% APY
        </span>
        <span>
          +{fmtCurrency(delta, unit)} vs bank
        </span>
      </div>

      <div
        className="mt-2 text-[11px]"
        style={{ color: "var(--h-ink-3)" }}
      >
        Projection at constant {(apy * 100).toFixed(1)}% APY. Yield floats with
        the market.
      </div>
    </div>
  );
}
