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
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { toast } from "sonner";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { classifyError } from "@/lib/errors";
import { USDC_MINT_DEVNET } from "@/lib/direct-indexer";
import type { JarPayload } from "@/lib/jar-fetch";

const USDC_DECIMALS = 6;

type ContributeStatus = "idle" | "running" | "error";

export function useContribute(
  jar: JarPayload,
  shortId: string | null,
  onShake: () => void,
  onDone: () => void,
) {
  const client = useJarfiClient();
  const { publicKey, signMessage } = useWallet();
  const router = useRouter();
  const [status, setStatus] = useState<ContributeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (amount: number, donorName?: string) => {
    if (!client || !publicKey) {
      setError("Connect a wallet first.");
      setStatus("error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be positive.");
      setStatus("error");
      return;
    }

    setStatus("running");
    setError(null);
    try {
      const jarPk = new PublicKey(jar.pda);
      if (jar.asset === "sol") {
        const lamports = new BN(Math.floor(amount * LAMPORTS_PER_SOL));
        await client.contributeSol(publicKey, jarPk, lamports, {
          marinade: jar.stakeProtocol === 2,
        });
      } else {
        const mint = new PublicKey(USDC_MINT_DEVNET);
        const donorAta = getAssociatedTokenAddressSync(mint, publicKey);
        const jarVault = getAssociatedTokenAddressSync(mint, jarPk, true);
        const connection = client.provider.connection;
        const donorAtaInfo = await connection.getAccountInfo(
          donorAta,
          "confirmed",
        );
        if (!donorAtaInfo) {
          const tx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              donorAta,
              publicKey,
              mint,
            ),
          );
          await client.provider.sendAndConfirm(tx);
        }
        const micro = new BN(
          Math.floor(amount * 10 ** USDC_DECIMALS),
        );
        await client.contributeSpl(
          publicKey,
          jarPk,
          donorAta,
          jarVault,
          micro,
        );
      }

      const lookupId = shortId ?? jar.pda;
      const trimmedName = donorName?.trim();
      if (trimmedName && signMessage) {
        try {
          const nonce = crypto.randomUUID();
          const donorWallet = publicKey.toBase58();
          const challenge = `jarfi:donor-name\njar=${jar.pda}\ndonor=${donorWallet}\nname=${trimmedName}\nnonce=${nonce}`;
          const sig = await signMessage(new TextEncoder().encode(challenge));
          await fetch(`/api/jars/${lookupId}/donor-name`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              donorWallet,
              name: trimmedName,
              signature: bs58.encode(sig),
              nonce,
            }),
          });
        } catch {
          // Name is best-effort — contribute already landed on-chain.
        }
      }

      onShake();
      toast.success("Contribution sent.");
      onDone();
      router.refresh();
      setStatus("idle");
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "already_processed") {
        onShake();
        toast.success("Contribution already landed.");
        onDone();
        router.refresh();
        setStatus("idle");
        return;
      }
      setError(c.message);
      setStatus("error");
      if (c.kind !== "user_rejected") toast.error(c.message);
    }
  };

  return { submit, status, error };
}
