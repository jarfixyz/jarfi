"use client";

import type { ProcessedCover } from "@/lib/cover";

interface PreviewCardProps {
  title: string;
  description: string;
  emoji: string | null;
  photo: ProcessedCover | null;
  asset: "sol" | "usdc";
  jarType: "flexible" | "timeLocked";
  goalAmount: string;
  goalEnabled: boolean;
  unlockDate: Date | null;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 20) || "my-jar"
  );
}

export function PreviewCard({
  title,
  description,
  emoji,
  photo,
  asset,
  jarType,
  goalAmount,
  goalEnabled,
  unlockDate,
}: PreviewCardProps) {
  const slug = slugify(title);
  const photoUrl = photo ? URL.createObjectURL(photo.blob) : null;
  const hasGoal = goalEnabled && !!goalAmount;

  return (
    <div
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--h-card)",
        border: "0.5px solid var(--h-line)",
        boxShadow:
          "0 1px 2px rgba(20,21,26,0.02), 0 16px 40px -24px rgba(20,21,26,0.12)",
      }}
    >
      {/* URL bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: "var(--h-bg)",
          borderBottom: "0.5px solid var(--h-line)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--h-ink-2)" }}
        />
        <span
          className="text-[11px]"
          style={{
            color: "var(--h-ink-3)",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          jarfi.xyz/{slug}
        </span>
      </div>

      {/* Cover */}
      <div
        className="flex h-[140px] items-center justify-center overflow-hidden"
        style={{
          background: photoUrl ? undefined : "var(--h-bg-2)",
          borderBottom: "0.5px solid var(--h-line)",
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <span style={{ fontSize: 52 }}>{emoji ?? "🫙"}</span>
        )}
      </div>

      {/* Header */}
      <div
        className="px-4 py-3.5"
        style={{ borderBottom: "0.5px solid var(--h-line)" }}
      >
        <p
          className="text-[15px]"
          style={{
            fontFamily:
              "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            color: "var(--h-ink)",
            lineHeight: 1.25,
          }}
        >
          {title || "Your jar name"}
        </p>
        <p
          className="mt-1 text-[12px]"
          style={{ color: "var(--h-ink-3)" }}
        >
          {asset === "sol" ? "Marinade 6.2% APY" : "USDC · stable"}
          {jarType === "timeLocked" &&
            unlockDate &&
            ` · Locks ${unlockDate.toLocaleDateString("en", {
              month: "short",
              year: "numeric",
            })}`}
        </p>
      </div>

      {/* Progress / goal */}
      {hasGoal && (
        <div
          className="px-4 py-3.5"
          style={{ borderBottom: "0.5px solid var(--h-line)" }}
        >
          <div
            className="mb-2 h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--h-bg)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: "0%", background: "var(--h-accent)" }}
            />
          </div>
          <div
            className="flex justify-between text-[11.5px]"
            style={{
              color: "var(--h-ink-3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>
              <b style={{ color: "var(--h-ink)", fontWeight: 500 }}>0</b>{" "}
              collected
            </span>
            <span>
              {goalAmount} {asset.toUpperCase()} goal
            </span>
          </div>
        </div>
      )}

      {/* Meta rows */}
      <div className="px-4 py-1">
        <PreviewRow label="Asset" value={asset.toUpperCase()} />
        <PreviewRow
          label="Type"
          value={jarType === "flexible" ? "Flexible" : "Locked"}
        />
        {description && (
          <PreviewRow label="Note" value={description} multiline />
        )}
      </div>

      {/* CTA preview */}
      <div className="p-4" style={{ borderTop: "0.5px solid var(--h-line)" }}>
        <button
          type="button"
          disabled
          className="w-full rounded-[8px] py-2.5 text-[13px] font-medium"
          style={{
            background: "var(--h-accent)",
            color: "#F1F0EC",
            border: "0.5px solid var(--h-accent-deep)",
            opacity: 0.9,
          }}
        >
          Contribute
        </button>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 py-2.5"
      style={{ borderBottom: "0.5px solid var(--h-line)" }}
    >
      <span
        className="text-[11px]"
        style={{ color: "var(--h-ink-3)" }}
      >
        {label}
      </span>
      <span
        className={`text-right text-[12.5px] ${multiline ? "" : "whitespace-nowrap"}`}
        style={{
          color: "var(--h-ink)",
          fontWeight: 500,
          maxWidth: multiline ? "70%" : undefined,
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </div>
  );
}
