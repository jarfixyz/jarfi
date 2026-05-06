"use client";

import { Connection, Keypair, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

async function getOptimalPriorityFee(connection: Connection): Promise<number> {
  const isDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet";
  const floor = isDevnet ? 5_000_000 : 500_000;
  try {
    const fees = await connection.getRecentPrioritizationFees();
    if (fees.length === 0) return floor;
    const sorted = fees.map(f => f.prioritizationFee).sort((a, b) => b - a);
    const idx = isDevnet
      ? Math.floor(sorted.length * 0.25)
      : Math.floor(sorted.length * 0.10);
    const multiplier = isDevnet ? 2 : 1.5;
    return Math.max(Math.ceil((sorted[idx] ?? 0) * multiplier), floor);
  } catch {
    return floor;
  }
}

// Sign once → resend every 2s until confirmed or blockhash expires, retry up to MAX_ATTEMPTS.
export async function sendAndConfirmRobust(
  connection: Connection,
  wallet: AnchorWallet,
  buildTx: () => Promise<Transaction>,
  extraSigners: Keypair[] = [],
  label = "tx"
): Promise<string> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");

    const tx = await buildTx();
    const microLamports = await getOptimalPriorityFee(connection);
    tx.instructions.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    // Wallet signs first — compiles the message canonically.
    // Extra signers (e.g. jarKeypair) sign the same compiled bytes.
    const signedTx = await wallet.signTransaction(tx);
    for (const signer of extraSigners) signedTx.partialSign(signer);

    const rawTx = signedTx.serialize();

    let signature: string;
    try {
      signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 0,
      });
    } catch (sendErr) {
      const msg = (sendErr as Error).message ?? "";
      if (msg.toLowerCase().includes("blockhash") && attempt < MAX_ATTEMPTS) {
        console.warn(`[${label}] send failed (blockhash), retrying (${attempt}/${MAX_ATTEMPTS})…`);
        continue;
      }
      throw sendErr;
    }

    const deadline = Date.now() + 90_000;
    let lastResend = Date.now();
    let blockhashExpired = false;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));

      try {
        const { value: status } = await connection.getSignatureStatus(signature);
        if (status) {
          if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
          if (
            status.confirmationStatus === "processed" ||
            status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized"
          ) {
            return signature;
          }
        }
      } catch (e) {
        if ((e as Error).message?.startsWith("Transaction failed:")) throw e;
      }

      if (Date.now() - lastResend > 2000) {
        connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
        lastResend = Date.now();
      }

      try {
        const blockHeight = await connection.getBlockHeight();
        if (blockHeight > lastValidBlockHeight) {
          blockhashExpired = true;
          break;
        }
      } catch {
        // transient RPC error — keep polling
      }
    }

    if (blockhashExpired && attempt < MAX_ATTEMPTS) {
      console.warn(`[${label}] blockhash expired, retrying (${attempt}/${MAX_ATTEMPTS})…`);
      continue;
    }

    if (!blockhashExpired) throw new Error("Transaction timed out after 90s");
  }

  throw new Error("Transaction failed after 5 attempts — devnet congested, please retry");
}
