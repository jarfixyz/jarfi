"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

interface JarCardProps {
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

export function JarCard({
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
}: JarCardProps) {
  const pct = goalAmount ? Math.min((totalContributed / goalAmount) * 100, 100) : 0;
  const assetLabel = asset.toUpperCase();

  const emojiFromUrl = coverUrl?.startsWith("emoji:")
    ? coverUrl.slice("emoji:".length)
    : null;
  const resolvedEmoji = emojiFromUrl ?? emoji;
  const imageUrl = coverUrl && !emojiFromUrl ? coverUrl : null;

  const pill = statusPill(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/jar/${pda}`}
        className="group block overflow-hidden rounded-[12px] transition-all duration-200 hover:-translate-y-[2px]"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          boxShadow:
            "0 1px 2px rgba(20,21,26,0.02), 0 16px 40px -28px rgba(20,21,26,0.12)",
        }}
      >
        {/* Cover */}
        <div
          className="relative h-[110px] overflow-hidden"
          style={{
            background: imageUrl ? undefined : "var(--h-bg-2)",
            borderBottom: "0.5px solid var(--h-line)",
          }}
        >
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={400} height={110} sizes="(max-width: 640px) 100vw, 360px" className="h-full w-full object-cover object-top" unoptimized loading="lazy" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ fontSize: 40, color: "var(--h-ink-2)" }}
            >
              {resolvedEmoji ?? title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="absolute right-2.5 top-2.5">
            <StatusPill tone={pill.tone} label={pill.label} />
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3
            className="mb-2 truncate"
            style={{
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
              color: "var(--h-ink)",
            }}
          >
            {title}
          </h3>

          <p
            className="mb-3 text-[13px]"
            style={{ color: "var(--h-ink-3)" }}
          >
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--h-ink)" }}
            >
              {totalContributed.toFixed(2)}
            </span>
            {goalAmount ? ` / ${goalAmount} ${assetLabel}` : ` ${assetLabel}`}
          </p>

          {goalAmount != null && goalAmount > 0 && (
            <div
              className="mb-3 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--h-bg-2)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "var(--h-accent)",
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {stakingEnabled && <Tag>Staking</Tag>}
            {unlockTimestamp && (
              <Tag>
                Unlocks{" "}
                {new Date(unlockTimestamp * 1000).toLocaleDateString("en", {
                  month: "short",
                  year: "numeric",
                })}
              </Tag>
            )}
            {!stakingEnabled && !unlockTimestamp && <Tag>Flexible</Tag>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{
        background: "var(--h-card-warm)",
        border: "1px solid var(--h-line-2)",
        color: "var(--h-ink-3)",
      }}
    >
      {children}
    </span>
  );
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

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
      style={{ color: s.fg, background: s.bg }}
    >
      {s.dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {label}
    </span>
  );
}
