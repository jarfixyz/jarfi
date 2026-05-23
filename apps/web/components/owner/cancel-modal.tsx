"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bub } from "@/components/ui/bub";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { classifyError } from "@/lib/errors";
import type { JarPayload } from "@/lib/jar-fetch";

export function CancelModal({
  open,
  onOpenChange,
  jar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jar: JarPayload;
}) {
  const client = useJarfiClient();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!client || !publicKey) {
      setError("Connect a wallet first.");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      await client.cancelJar(publicKey, new PublicKey(jar.pda));
      toast.success("Jar cancelled. Donors can now claim refunds.");
      onOpenChange(false);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "already_processed") {
        toast.success("Jar cancellation already landed.");
        onOpenChange(false);
        setStatus("idle");
        router.refresh();
        return;
      }
      setError(c.message);
      setStatus("error");
      if (c.kind !== "user_rejected") toast.error(c.message);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Cancel this jar">
      <Badge tone="sun" className="mb-4">
        ⚠️ Heads up
      </Badge>
      <div className="flex items-start gap-4">
        <Bub mood="thinking" size={64} />
        <p className="text-sm text-mute">
          This opens refunds for every contributor and you can no longer
          withdraw. It can&rsquo;t be undone.
        </p>
      </div>
      {error && (
        <p className="mt-3 text-sm font-semibold text-coral-deep">{error}</p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Never mind
        </Button>
        <Button onClick={submit} disabled={status === "running"}>
          {status === "running" ? "Signing…" : "Yes, cancel this jar"}
        </Button>
      </div>
    </Modal>
  );
}
