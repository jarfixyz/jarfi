"use client";

import { useEffect, useMemo, useState } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { encodeURL, findReference, FindReferenceError } from "@solana/pay";
import { useConnection } from "@solana/wallet-adapter-react";
import BigNumber from "bignumber.js";
import { toast } from "sonner";
import { AmountField } from "@/components/ui/amount-field";
import { Qr } from "@/components/ui/qr";
import { Button } from "@/components/ui/button";
import type { JarPayload } from "@/lib/jar-fetch";

export function QrTab({
  jar,
  onContributed,
}: {
  jar: JarPayload;
  shortId: string | null;
  onContributed: () => void;
}) {
  const { connection } = useConnection();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState<PublicKey | null>(null);

  const url = useMemo(() => {
    if (!reference || !amount || Number(amount) <= 0) return null;
    return encodeURL({
      recipient: new PublicKey(jar.pda),
      amount: new BigNumber(amount),
      reference,
      label: `jarfi: ${jar.metadata.title}`,
      message: "Contribution",
    }).toString();
  }, [jar.pda, jar.metadata.title, amount, reference]);

  useEffect(() => {
    if (!reference) return;
    let stopped = false;
    const tick = async () => {
      try {
        await findReference(connection, reference, { finality: "confirmed" });
        if (stopped) return;
        toast.success("Contribution detected.");
        onContributed();
      } catch (err) {
        if (!(err instanceof FindReferenceError)) {
          console.warn("findReference failed", err);
        }
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [reference, connection, onContributed]);

  const assetLabel = jar.asset === "sol" ? "SOL" : "USDC";

  return (
    <div className="flex flex-col gap-4">
      <AmountField
        label="How much?"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setReference(null);
        }}
        asset={assetLabel}
      />
      {url ? (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-3xl border-2 border-line bg-paper p-4">
            <Qr value={url} />
          </div>
          <p className="text-center text-sm text-mute">
            Scan this with your wallet app. We&rsquo;ll spot the payment
            automatically.
          </p>
        </div>
      ) : (
        <Button
          size="lg"
          onClick={() => setReference(Keypair.generate().publicKey)}
          disabled={!amount || Number(amount) <= 0}
        >
          Generate QR code
        </Button>
      )}
    </div>
  );
}
