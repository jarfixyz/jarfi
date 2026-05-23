"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { deriveTreasuryPda } from "@jarfi/sdk";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AmountField } from "@/components/ui/amount-field";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { classifyError } from "@/lib/errors";
import { USDC_MINT_DEVNET } from "@/lib/direct-indexer";
import type { JarPayload } from "@/lib/jar-fetch";

const USDC_DECIMALS = 6;

export function WithdrawModal({
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
  const [amount, setAmount] = useState("");
  const [all, setAll] = useState(true);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const partialAllowed = jar.jarType === "flexible";
  const assetLabel = jar.asset === "sol" ? "SOL" : "USDC";

  const submit = async () => {
    if (!client || !publicKey) {
      setError("Connect a wallet first.");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const jarPk = new PublicKey(jar.pda);
      let amt: BN | null = null;
      if (!all && partialAllowed) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Amount must be positive.");
          setStatus("error");
          return;
        }
        const unit =
          jar.asset === "sol" ? LAMPORTS_PER_SOL : 10 ** USDC_DECIMALS;
        amt = new BN(Math.floor(n * unit));
      }

      if (jar.asset === "usdc") {
        const mint = new PublicKey(USDC_MINT_DEVNET);
        const [treasuryPk] = deriveTreasuryPda();
        const jarVault = getAssociatedTokenAddressSync(mint, jarPk, true);
        const ownerTokenAccount = getAssociatedTokenAddressSync(
          mint,
          publicKey,
        );
        const treasuryTokenAccount = getAssociatedTokenAddressSync(
          mint,
          treasuryPk,
          true,
        );
        const connection = client.provider.connection;
        const [ownerInfo, treasuryInfo] = await Promise.all([
          connection.getAccountInfo(ownerTokenAccount, "confirmed"),
          connection.getAccountInfo(treasuryTokenAccount, "confirmed"),
        ]);
        const setup = new Transaction();
        if (!ownerInfo) {
          setup.add(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey,
              ownerTokenAccount,
              publicKey,
              mint,
            ),
          );
        }
        if (!treasuryInfo) {
          setup.add(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey,
              treasuryTokenAccount,
              treasuryPk,
              mint,
            ),
          );
        }
        if (setup.instructions.length > 0) {
          await client.provider.sendAndConfirm(setup);
        }
        await client.withdraw(publicKey, jarPk, amt, {
          jarVault,
          ownerTokenAccount,
          treasuryTokenAccount,
          vaultMint: mint,
        });
      } else {
        await client.withdraw(publicKey, jarPk, amt, undefined, {
          marinade: jar.stakeProtocol === 2,
        });
      }
      toast.success("Withdrawal sent.");
      onOpenChange(false);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "already_processed") {
        toast.success("Withdrawal already landed.");
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
    <Modal open={open} onOpenChange={onOpenChange} title="Withdraw your jar">
      <p className="text-sm text-mute">
        A 1% fee is taken out. You keep the rest.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        {partialAllowed ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-coral)]"
            />
            Take everything
          </label>
        ) : (
          <p className="text-sm font-semibold text-mute">
            Time-locked jars withdraw the full balance.
          </p>
        )}
        {!all && partialAllowed && (
          <AmountField
            label="How much?"
            value={amount}
            onChange={setAmount}
            asset={assetLabel}
          />
        )}
        {error && (
          <p className="text-sm font-semibold text-coral-deep">{error}</p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Never mind
        </Button>
        <Button onClick={submit} disabled={status === "running"}>
          {status === "running"
            ? "Signing…"
            : all
              ? `Yes, withdraw all`
              : `Yes, withdraw ${amount || "0"} ${assetLabel}`}
        </Button>
      </div>
    </Modal>
  );
}
