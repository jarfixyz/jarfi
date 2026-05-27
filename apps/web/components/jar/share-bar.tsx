"use client";

import { useEffect, useState } from "react";
import { Qr } from "@/components/ui/qr";

interface ShareBarProps {
  shortId: string;
  isActive: boolean;
  title?: string;
}

export function ShareBar({ shortId, isActive, title }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState("jarfi.xyz");

  useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.host);
  }, []);

  const path = `${host}/j/${shortId}`;
  const fullUrl = `https://${path}`;
  const shareText = title ? `Chip in to "${title}"` : "Chip in to my jar";

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(shareText)}`;
  const smsHref = `sms:&body=${encodeURIComponent(`${shareText} ${fullUrl}`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`;

  return (
    <div
      className="rounded-[14px] p-6"
      style={{
        background: "var(--h-card)",
        border: "0.5px solid var(--h-line)",
        boxShadow: "var(--h-shadow-warm, 0 1px 0 rgba(20,21,26,0.04))",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: isActive ? "#2E8B64" : "var(--h-ink-3)" }}
        />
        <span
          className="text-[11px] uppercase tracking-[0.06em]"
          style={{ color: "var(--h-ink-3)" }}
        >
          Your jar link
        </span>
      </div>

      <div
        className="flex items-center gap-2 rounded-[10px] mb-4"
        style={{
          background: "var(--h-card-warm)",
          border: "1px solid var(--h-ink)",
          padding: "10px 12px",
          boxShadow: "2px 3px 0 var(--h-ink)",
        }}
      >
        <code
          className="flex-1 truncate font-mono text-[12.5px]"
          style={{ color: "var(--h-ink)" }}
        >
          {path}
        </code>
        <button
          type="button"
          onClick={copy}
          className="text-[11.5px] font-medium transition-colors"
          style={{
            background: "#2E8B64",
            color: "#FAFAF7",
            padding: "7px 14px",
            borderRadius: 999,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#256C4E";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#2E8B64";
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div
        className="grid items-center gap-[18px]"
        style={{ gridTemplateColumns: "108px 1fr" }}
      >
        <div
          className="rounded-[10px] p-1.5"
          style={{
            border: "0.5px solid var(--h-line)",
            background: "#fff",
            lineHeight: 0,
          }}
        >
          <Qr value={fullUrl} size={96} />
        </div>
        <div className="flex flex-col gap-1.5">
          <ShareChip
            href={telegramHref}
            label="Send via Telegram"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 12.4l-5-1.6c-1.1-.3-1.1-1 .2-1.5L20.3 2.9c.9-.3 1.7.2 1.4 1.4Z" />
              </svg>
            }
          />
          <ShareChip
            href={smsHref}
            label="Send via iMessage"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12c0 4.4-4 8-9 8-1.3 0-2.5-.2-3.6-.6L4 21l1.3-3.6C4.5 16.1 4 14.1 4 12c0-4.4 4-8 9-8s8 3.6 8 8Z" />
              </svg>
            }
          />
          <ShareChip
            href={xHref}
            label="Share on X"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.3 3h3l-6.6 7.5L22.5 21h-6.1l-4.8-6.3L6 21H3l7-8L2.5 3h6.2l4.4 5.8L18.3 3Zm-1 16.2h1.6L7 4.7H5.3l12 14.5Z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

function ShareChip({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[12.5px] transition-colors"
      style={{
        padding: "8px 12px",
        border: "0.5px solid var(--h-line)",
        borderRadius: 10,
        background: "var(--h-card-warm)",
        color: "var(--h-ink-3)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--h-bg-2)";
        e.currentTarget.style.color = "var(--h-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--h-card-warm)";
        e.currentTarget.style.color = "var(--h-ink-3)";
      }}
    >
      <span style={{ flexShrink: 0, display: "inline-flex" }}>{icon}</span>
      {label}
    </a>
  );
}
