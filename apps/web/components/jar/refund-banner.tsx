"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { classifyError } from "@/lib/errors";
import type { JarPayload } from "@/lib/jar-fetch";

export function RefundBanner({ jar }: { jar: JarPayload }) {
  const client = useJarfiClient();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<"idle" | "running">("idle");

  if (jar.status !== "cancelled" || !publicKey) return null;

  const claim = async () => {
    if (!client) return;
    setStatus("running");
    try {
      const jarPk = new PublicKey(jar.pda);
      const ownerPk = new PublicKey(jar.owner);
      await client.refund(ownerPk, jarPk, publicKey, {
        marinade: jar.stakeProtocol === 2,
      });
      toast.success("Refund sent.");
      router.refresh();
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "already_processed") {
        toast.success("Refund already landed.");
        router.refresh();
      } else if (c.kind !== "user_rejected") {
        toast.error(c.message);
      }
    } finally {
      setStatus("idle");
    }
  };

  return (
    <section className="container-wide pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-coral bg-coral-soft px-5 py-4">
        <p className="text-sm font-semibold text-coral-deep">
          <span aria-hidden className="mr-2">⚠️</span>
          This jar was cancelled. If you contributed, you can claim a refund.
        </p>
        <Button onClick={claim} disabled={status === "running"}>
          {status === "running" ? "Claiming…" : "Claim refund"}
        </Button>
      </div>
    </section>
  );
}
