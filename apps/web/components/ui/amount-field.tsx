"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { useAssetUsd } from "@/lib/price";

export function AmountField({
  label,
  value,
  onChange,
  asset,
  error,
  placeholder = "0.00",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  asset: "SOL" | "USDC";
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const price = useAssetUsd(asset);
  const num = Number(value);
  const usd =
    price != null && Number.isFinite(num) && num > 0 ? num * price : null;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-3xl border-2 bg-paper px-5 py-4",
          "transition-colors duration-[var(--duration-base)]",
          error
            ? "border-coral-deep focus-within:border-coral-deep"
            : "border-line focus-within:border-coral",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
          className="min-w-0 flex-1 bg-transparent text-4xl font-bold tabular-nums text-ink placeholder:text-line focus:outline-none"
        />
        <span className="rounded-full bg-coral-soft px-3 py-1 text-sm font-semibold text-coral-deep">
          {asset}
        </span>
      </div>
      <div className="flex items-center justify-between min-h-[1.25rem]">
        {usd != null && !error && (
          <span className="text-sm text-mute">≈ ${usd.toFixed(2)}</span>
        )}
        {error && (
          <span className="text-sm font-semibold text-coral-deep">{error}</span>
        )}
      </div>
    </div>
  );
}
