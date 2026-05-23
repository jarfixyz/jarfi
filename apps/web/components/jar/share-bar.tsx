"use client";

import { useState } from "react";

interface ShareBarProps {
  shortId: string;
  isActive: boolean;
}

export function ShareBar({ shortId, isActive }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const url = `jarfi.app/j/${shortId}`;

  function handleCopy() {
    navigator.clipboard.writeText(`https://${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 transition-colors"
      style={{
        background: "var(--h-card-warm)",
        border: "0.5px solid var(--h-line)",
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: isActive ? "#2E8B64" : "var(--h-ink-3)",
        }}
      />
      <span
        className="truncate font-mono text-[12px]"
        style={{ color: "var(--h-ink-3)" }}
      >
        {url}
      </span>
      <span
        className="ml-auto text-[11px]"
        style={{ color: "var(--h-ink)", fontWeight: 500 }}
      >
        {copied ? "Copied" : "Copy link"}
      </span>
    </button>
  );
}
