"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { JarPayload } from "@/lib/jar-fetch";

export function RawTab({ jar }: { jar: JarPayload }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(jar.pda);
      setCopied(true);
      toast.success("Jar address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const assetLabel = jar.asset === "sol" ? "SOL" : "USDC";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute">
        Send {assetLabel} to the jar address from any wallet. It&rsquo;ll show
        up here once the network confirms it.
      </p>
      <div className="rounded-3xl border-2 border-line bg-cream p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">
          Jar address
        </p>
        <code className="block break-all font-mono text-xs text-ink">
          {jar.pda}
        </code>
      </div>
      <Button variant="secondary" onClick={copy}>
        {copied ? "Copied ✨" : "Copy address"}
      </Button>
    </div>
  );
}
