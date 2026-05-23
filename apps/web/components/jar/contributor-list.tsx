"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Contributor {
  name: string;
  wallet: string;
  amount: number;
  asset: string;
  timestamp: number;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function ContributorList({ contributors }: { contributors: Contributor[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? contributors : contributors.slice(0, 5);

  return (
    <div className="mb-7 border-t border-line pt-6">
      <h3 className="mb-4 text-base font-bold text-ink">
        Contributors ({contributors.length})
      </h3>

      {visible.map((c, i) => (
        <motion.div
          key={`${c.wallet}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`flex items-center gap-3 py-3 ${
            i < visible.length - 1 ? "border-b border-line" : ""
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-alt text-sm font-bold text-mute">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{c.name}</div>
            <div className="truncate font-mono text-[11px] text-mute">{c.wallet}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold text-ink">
              {c.amount} {c.asset}
            </div>
            <div className="text-[11px] text-mute">{timeAgo(c.timestamp)}</div>
          </div>
        </motion.div>
      ))}

      {contributors.length > 5 && !showAll && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[13px] font-semibold text-coral"
          >
            Show all {contributors.length} →
          </button>
        </div>
      )}
    </div>
  );
}
