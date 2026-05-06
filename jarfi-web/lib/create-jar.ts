"use client";

import {
  Connection, Keypair, PublicKey, Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "./program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

// Devnet often returns all-zero fees, so floor is high enough to land even under congestion.
// Mainnet: p90 * 1.5 is used instead, with a lower floor since SOL has real cost.
async function getOptimalPriorityFee(connection: Connection): Promise<number> {
  const isDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet";
  const floor = isDevnet ? 5_000_000 : 500_000;
  try {
    const fees = await connection.getRecentPrioritizationFees();
    if (fees.length === 0) return floor;
    const sorted = fees.map(f => f.prioritizationFee).sort((a, b) => b - a);
    // p90 × 1.5 on mainnet; p75 × 2 on devnet (usually all zeros so floor wins)
    const idx = isDevnet ? Math.floor(sorted.length * 0.25) : Math.floor(sorted.length * 0.10);
    const multiplier = isDevnet ? 2 : 1.5;
    return Math.max(Math.ceil((sorted[idx] ?? 0) * multiplier), floor);
  } catch {
    return floor;
  }
}

async function addPriorityFee(connection: Connection, tx: Transaction): Promise<Transaction> {
  const microLamports = await getOptimalPriorityFee(connection);
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  );
  return tx;
}

// Sign once → resend every 2s until confirmed or blockhash expires, then retry up to 5×.
async function sendAndConfirmRobust(
  connection: Connection,
  wallet: AnchorWallet,
  buildTx: () => Promise<Transaction>,
  extraSigners: Keypair[]
): Promise<string> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");

    const tx = await buildTx();
    await addPriorityFee(connection, tx);
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    // Wallet (Phantom) signs FIRST — compiles the message canonically.
    // jarKeypair signs the same compiled bytes. Reversed order causes Phantom
    // to recompile, invalidating jarKeypair's sig.
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
      // "Blockhash not found" means it expired before even landing — retry immediately
      if (msg.toLowerCase().includes("blockhash") && attempt < MAX_ATTEMPTS) {
        console.warn(`[create-jar] send failed (blockhash), retrying (${attempt}/${MAX_ATTEMPTS})…`);
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
          if (status.confirmationStatus === "processed" ||
              status.confirmationStatus === "confirmed" ||
              status.confirmationStatus === "finalized") {
            return signature;
          }
        }
      } catch (e) {
        if ((e as Error).message?.startsWith("Transaction failed:")) throw e;
      }

      // Resend same signed bytes every 2s — no new Phantom popup
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
        // Transient RPC error — keep polling
      }
    }

    if (blockhashExpired && attempt < MAX_ATTEMPTS) {
      console.warn(`[create-jar] blockhash expired, retrying (${attempt}/${MAX_ATTEMPTS})…`);
      continue;
    }

    if (!blockhashExpired) throw new Error("Transaction timed out after 90s");
  }

  throw new Error("Transaction failed after 5 attempts — devnet congested, please retry");
}

export const USDC_MINT_DEVNET  = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const USDC_MINT_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

function usdcMint(): PublicKey {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
    ? USDC_MINT_MAINNET
    : USDC_MINT_DEVNET;
}

async function getVaultAuthority(jarPubkey: PublicKey): Promise<PublicKey> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jarPubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// ---------------------------------------------------------------------------
// USDC jar — createUsdcJar instruction (browser wallet signs)
// ---------------------------------------------------------------------------

export async function createUsdcJarOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  params: {
    mode: number;
    unlockDate: number;
    goalAmount: number; // in USDC micro-units (e.g. $100 = 100_000_000)
    childWallet: string;
  }
): Promise<{ jarPubkey: string; txSignature: string }> {
  const program = getProgram(wallet, connection);
  const jarKeypair = Keypair.generate();
  const childWalletPubkey = new PublicKey(params.childWallet);
  const mint = usdcMint();
  const vaultAuthority = await getVaultAuthority(jarKeypair.publicKey);
  const jarUsdcVault = await getAssociatedTokenAddress(mint, vaultAuthority, true);

  const txSignature = await sendAndConfirmRobust(
    connection,
    wallet,
    () => program.methods
      .createUsdcJar(
        params.mode,
        new BN(params.unlockDate),
        new BN(params.goalAmount),
        childWalletPubkey
      )
      .accounts({
        jar:                    jarKeypair.publicKey,
        vaultAuthority,
        jarUsdcVault,
        usdcMint:               mint,
        owner:                  wallet.publicKey,
        systemProgram:          new PublicKey("11111111111111111111111111111111"),
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      } as never)
      .transaction(),
    [jarKeypair]
  );

  return { jarPubkey: jarKeypair.publicKey.toBase58(), txSignature };
}

// ---------------------------------------------------------------------------
// SOL jar — original createJar instruction (backward compat)
// ---------------------------------------------------------------------------

export async function createJarOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  params: {
    mode: number;
    unlockDate: number;
    goalAmount: number;
    childWallet: string;
  }
): Promise<{ jarPubkey: string; txSignature: string }> {
  const program = getProgram(wallet, connection);
  const jarKeypair = Keypair.generate();
  const childWalletPubkey = new PublicKey(params.childWallet);

  const txSignature = await sendAndConfirmRobust(
    connection,
    wallet,
    () => program.methods
      .createJar(
        params.mode,
        new BN(params.unlockDate),
        new BN(params.goalAmount),
        childWalletPubkey
      )
      .accounts({
        jar:   jarKeypair.publicKey,
        owner: wallet.publicKey,
      } as never)
      .transaction(),
    [jarKeypair]
  );

  return { jarPubkey: jarKeypair.publicKey.toBase58(), txSignature };
}
