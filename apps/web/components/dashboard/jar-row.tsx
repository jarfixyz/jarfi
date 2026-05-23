"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

interface JarRowProps {
  pda: string;
  title: string;
  emoji?: string;
  coverUrl?: string | null;
  asset: string;
  totalContributed: number;
  goalAmount?: number | null;
  status: string;
  stakingEnabled?: boolean;
  unlockTimestamp?: number | null;
  index?: number;
}

type PillTone = "active" | "locked" | "done" | "cancelled";

function statusPill(status: string): { label: string; tone: PillTone } {
  if (status === "locked") return { label: "Locked", tone: "locked" };
  if (status === "active") return { label: "Active", tone: "active" };
  if (status === "completed" || status === "withdrawn")
    return { label: "Done", tone: "done" };
  if (status === "cancelled") return { label: "Cancelled", tone: "cancelled" };
  return { label: "Active", tone: "active" };
}

const TONE_STYLES: Record<
  PillTone,
  { fg: string; bg: string; dot: string | null }
> = {
  active: { fg: "#1F6B4E", bg: "#E3F1EA", dot: "#2E8B64" },
  locked: { fg: "#2F4A78", bg: "#E6ECF6", dot: "#4869A3" },
  done: { fg: "#3A3A3A", bg: "#E8E7E2", dot: null },
  cancelled: { fg: "#8A3A32", bg: "#F5E4E1", dot: null },
};

export function JarRow({
  pda,
  title,
  emoji,
  coverUrl,
  asset,
  totalContributed,
  goalAmount,
  status,
  stakingEnabled,
  unlockTimestamp,
  index = 0,
}: JarRowProps) {
  const pct = goalAmount ? Math.min((totalContributed / goalAmount) * 100, 100) : 0;
  const assetLabel = asset.toUpperCase();

  const emojiFromUrl = coverUrl?.startsWith("emoji:")
    ? coverUrl.slice("emoji:".length)
    : null;
  const resolvedEmoji = emojiFromUrl ?? emoji;
  const imageUrl = coverUrl && !emojiFromUrl ? coverUrl : null;

  const pill = statusPill(status);
  const tone = TONE_STYLES[pill.tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/jar/${pda}`}
        className="group grid items-center gap-4 rounded-[12px] px-4 py-3 transition-colors"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          gridTemplateColumns:
            "48px minmax(0, 1fr) 220px 160px 96px 16px",
        }}
      >
        {/* Thumb */}
        <div
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px]"
          style={{
            background: "var(--h-bg-2)",
            border: "0.5px solid var(--h-line)",
          }}
        >
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={48} height={48} sizes="48px" className="h-full w-full object-cover" unoptimized loading="lazy" />
          ) : (
            <span style={{ fontSize: 22, color: "var(--h-ink-2)" }}>
              {resolvedEmoji ?? title.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* Title + meta */}
        <div className="min-w-0">
          <h3
            className="truncate"
            style={{
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              color: "var(--h-ink)",
            }}
          >
            {title}
          </h3>
          <div
            className="mt-0.5 truncate text-[12px]"
            style={{ color: "var(--h-ink-3)" }}
          >
            {metaLine(stakingEnabled, unlockTimestamp)}
          </div>
        </div>

        {/* Progress */}
        <div className="min-w-0">
          {goalAmount != null && goalAmount > 0 ? (
            <div className="flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--h-bg-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "var(--h-accent)" }}
                />
              </div>
              <span
                className="w-9 shrink-0 text-right tabular-nums text-[12px]"
                style={{ color: "var(--h-ink-3)" }}
              >
                {pct.toFixed(0)}%
              </span>
            </div>
          ) : (
            <span className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>
              No goal
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="text-right tabular-nums">
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--h-ink)" }}>
            {totalContributed.toFixed(2)} {assetLabel}
          </div>
          {goalAmount ? (
            <div className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>
              of {goalAmount} {assetLabel}
            </div>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>
              &nbsp;
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-start">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
            style={{ color: tone.fg, background: tone.bg }}
          >
            {tone.dot && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tone.dot }}
              />
            )}
            {pill.label}
          </span>
        </div>

        {/* Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--h-ink-3)" }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </motion.div>
  );
}

function metaLine(
  stakingEnabled: boolean | undefined,
  unlockTimestamp: number | null | undefined,
): string {
  const parts: string[] = [];
  if (stakingEnabled) parts.push("Staking");
  if (unlockTimestamp) {
    parts.push(
      `Unlocks ${new Date(unlockTimestamp * 1000).toLocaleDateString("en", {
        month: "short",
        year: "numeric",
      })}`,
    );
  }
  if (parts.length === 0) parts.push("Flexible");
  return parts.join(" · ");
}
