"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SendTransactionError } from "@solana/web3.js";
import { toast } from "sonner";
import { deriveJarPda } from "@jarfi/sdk";
import { useJarfiClient } from "@/lib/wallet/use-jarfi-client";
import { buildJarMetadata, hashMetadata } from "@/lib/metadata";
import { signMetadataUpload, uploadJarMetadata } from "@/lib/upload";
import { classifyError } from "@/lib/errors";
import { buildCoverUrl, type ProcessedCover } from "@/lib/cover";
import { USDC_MINT_DEVNET } from "@/lib/direct-indexer";

interface CreateArgs {
  jarType: "flexible" | "timeLocked";
  asset: "sol" | "usdc";
  goal: number;
  hasGoal: boolean;
  title: string;
  description: string;
  unlockDate: Date | null;
  cover: ProcessedCover | null;
  emoji: string | null;
  autoStake: boolean;
}

type CreateStatus = "idle" | "running" | "done" | "error";

async function requestShortlink(
  jarPda: string,
  signature: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/shortlink", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jarPda, signature }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { shortId: string };
    return body.shortId ?? null;
  } catch {
    return null;
  }
}

export function useCreateJar() {
  const client = useJarfiClient();
  const { publicKey, signMessage } = useWallet();
  const router = useRouter();
  const [status, setStatus] = useState<CreateStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (args: CreateArgs) => {
    if (!client || !publicKey || !signMessage) {
      setError("Connect a wallet first.");
      setStatus("error");
      return;
    }
    if (args.jarType === "timeLocked" && !args.unlockDate) {
      setError("Pick an unlock date.");
      setStatus("error");
      return;
    }
    if (args.hasGoal && (!Number.isFinite(args.goal) || args.goal <= 0)) {
      setError("Goal must be a positive number.");
      setStatus("error");
      return;
    }

    setStatus("running");
    setError(null);

    try {
      const nextId = await client.ensureUserState(publicKey);
      const [jarPda] = deriveJarPda(publicKey, nextId);

      const coverUrl = args.cover
        ? buildCoverUrl(jarPda.toBase58(), args.cover)
        : args.emoji
          ? `emoji:${args.emoji}`
          : null;
      const metadata = buildJarMetadata({
        title: args.title,
        description: args.description,
        coverUrl,
        disableContributors: false,
      });
      const hash = await hashMetadata(metadata);

      const nonce = crypto.randomUUID();
      const jarCount = nextId.toNumber();
      const { metadataJson, signature } = await signMetadataUpload({
        jarPda: jarPda.toBase58(),
        jarCount,
        metadata,
        signMessage,
      });

      const { metadataUri } = await uploadJarMetadata({
        jarPda: jarPda.toBase58(),
        wallet: publicKey.toBase58(),
        signature,
        nonce,
        jarCount,
        metadataJson,
        cover: args.cover?.blob ?? null,
      });

      const goalAmount = args.hasGoal
        ? new BN(
            Math.floor(
              args.goal *
                (args.asset === "sol" ? LAMPORTS_PER_SOL : 1_000_000),
            ),
          )
        : new BN(0);
      const unlockTs =
        args.jarType === "timeLocked" && args.unlockDate
          ? new BN(Math.floor(args.unlockDate.getTime() / 1000))
          : new BN(0);

      const vaultMint =
        args.asset === "usdc"
          ? new PublicKey(USDC_MINT_DEVNET)
          : undefined;

      let txSig: string;
      try {
        txSig = await client.createJar(
          publicKey,
          nextId,
          {
            jarType: args.jarType,
            asset: args.asset,
            goalAmount,
            unlockTimestamp: unlockTs,
            metadataUri,
            metadataHash: hash,
            autoStake: args.autoStake,
          },
          vaultMint,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isAlreadyProcessed = /already been processed/i.test(msg);
        if (!isAlreadyProcessed) throw e;
        const conn = client.provider.connection;
        const info = await conn.getAccountInfo(jarPda, "confirmed");
        if (!info) throw e;
        const sigs = await conn.getSignaturesForAddress(jarPda, { limit: 1 });
        const recovered = sigs[0]?.signature;
        if (!recovered) throw e;
        txSig = recovered;
      }

      const shortId = await requestShortlink(jarPda.toBase58(), txSig);
      setStatus("done");
      toast.success("Jar created.");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("jarfi:last-create:variant");
      }
      router.push(
        shortId ? `/j/${shortId}?created=1` : `/jar/${jarPda.toBase58()}?created=1`,
      );
    } catch (err) {
      if (err instanceof SendTransactionError) {
        try {
          const logs = await err.getLogs(client.provider.connection);
          console.error("createJar failed logs:", logs);
        } catch {}
      }
      const classified = classifyError(err);
      setError(classified.message);
      setStatus("error");
      if (classified.kind !== "user_rejected") {
        toast.error(classified.message);
      }
    }
  };

  return { submit, status, error };
}
