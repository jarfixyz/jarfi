"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Qr } from "@/components/ui/qr";

const DEMO_URL = "jarfi.xyz/j/gift";

export function ShareDemo() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${DEMO_URL}`);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <section className="sd-section" id="contrib">
      <div className="sd-grid">
        <div className="sd-card">
          <span className="sd-label">Your jar link</span>
          <div className="sd-url">
            <code>{DEMO_URL}</code>
            <button type="button" onClick={copy} className="sd-copy">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="sd-split">
            <div className="sd-qr">
              <Qr value={`https://${DEMO_URL}`} size={96} />
            </div>
            <div className="sd-chips">
              <span className="sd-chip">
                <svg className="sd-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 12.4l-5-1.6c-1.1-.3-1.1-1 .2-1.5L20.3 2.9c.9-.3 1.7.2 1.4 1.4Z"/>
                </svg>
                Send via Telegram
              </span>
              <span className="sd-chip">
                <svg className="sd-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12c0 4.4-4 8-9 8-1.3 0-2.5-.2-3.6-.6L4 21l1.3-3.6C4.5 16.1 4 14.1 4 12c0-4.4 4-8 9-8s8 3.6 8 8Z"/>
                </svg>
                Send via iMessage
              </span>
              <span className="sd-chip">
                <svg className="sd-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.3 3h3l-6.6 7.5L22.5 21h-6.1l-4.8-6.3L6 21H3l7-8L2.5 3h6.2l4.4 5.8L18.3 3Zm-1 16.2h1.6L7 4.7H5.3l12 14.5Z"/>
                </svg>
                Share on X
              </span>
            </div>
          </div>
        </div>
        <div className="sd-text">
          <h2>One link. Everyone pitches in.</h2>
          <p>
            Share by text, Telegram, or email. They open the link, they pay
            with a card. No wallet, no signup.
          </p>
          <p>
            The jar updates in real time — every contributor shows up in the
            feed with a name and a note.
          </p>
        </div>
      </div>
    </section>
  );
}

