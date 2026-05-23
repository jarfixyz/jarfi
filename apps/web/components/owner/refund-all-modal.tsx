"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bub } from "@/components/ui/bub";
import { ProgressBar } from "@/components/ui/progress";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { classifyError } from "@/lib/errors";
import type { JarPayload } from "@/lib/jar-fetch";

interface DonorRow {
  donor: string;
  amount: string;
}

export function RefundAllModal({
  open,
  onOpenChange,
  jar,
  shortId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jar: JarPayload;
  shortId: string | null;
}) {
  const client = useJarfiClient();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProgress(0);
    setLoadError(null);
    const lookup = shortId ?? jar.pda;
    fetch(`/api/jars/${lookup}/donors`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DonorRow[];
      })
      .then(setDonors)
      .catch((err: unknown) => {
        setDonors([]);
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      });
  }, [open, shortId, jar.pda]);

  const run = async () => {
    if (!client || !publicKey) return;
    setRunning(true);
    const jarPk = new PublicKey(jar.pda);
    for (let i = 0; i < donors.length; i++) {
      try {
        await client.refund(
          publicKey,
          jarPk,
          new PublicKey(donors[i].donor),
          { marinade: jar.stakeProtocol === 2 },
        );
      } catch (err) {
        const c = classifyError(err);
        if (c.kind === "user_rejected") {
          toast.error("Cancelled — stopped partway.");
          break;
        }
        if (c.kind === "already_processed") {
          // Silently treat as success for this donor.
        } else {
          toast.error(`${donors[i].donor.slice(0, 6)}…: ${c.message}`);
        }
      }
      setProgress(i + 1);
    }
    setRunning(false);
    if (progress === donors.length && donors.length > 0) {
      toast.success("All refunds sent.");
    }
    router.refresh();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Refund everyone">
      <Badge tone="sun" className="mb-4">
        ⚠️ Heads up
      </Badge>
      <div className="flex items-start gap-4">
        <Bub mood="thinking" size={64} />
        <p className="text-sm text-mute">
          One transaction per contributor, paid from your wallet.{" "}
          <span className="font-semibold text-ink">
            {donors.length} donors pending.
          </span>
        </p>
      </div>
      {loadError && (
        <p className="mt-3 text-sm font-semibold text-coral-deep">
          Couldn&rsquo;t load donors: {loadError}
        </p>
      )}
      <div className="mt-5">
        <ProgressBar
          value={progress}
          max={donors.length || 1}
          label={`${progress} / ${donors.length}`}
          showLabel
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Never mind
        </Button>
        <Button onClick={run} disabled={running || donors.length === 0}>
          {running ? "Sending…" : "Yes, refund everyone"}
        </Button>
      </div>
    </Modal>
  );
}
