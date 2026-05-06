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

// Priority fee helps skip the devnet congestion queue.
// 200_000 microlamports ≈ $0.00003 on mainnet — negligible but effective on devnet.
const PRIORITY_FEE_MICROLAMPORTS = 200_000;

function addPriorityFee(tx: Transaction): Transaction {
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  );
  return tx;
}

// Sign once → resend same bytes every 5s until confirmed or blockhash expires.
// Avoids multiple Phantom popups and "already in use" errors on retry.
async function sendAndConfirmRobust(
  connection: Connection,
  wallet: AnchorWallet,
  buildTx: () => Promise<Transaction>,
  extraSigners: Keypair[]
): Promise<string> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = await buildTx();
    addPriorityFee(tx);
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    // Wallet (Phantom) signs FIRST — compiles the message canonically.
    // jarKeypair signs the same compiled bytes. Reversed order causes Phantom
    // to recompile, invalidating jarKeypair's sig.
    const signedTx = await wallet.signTransaction(tx);
    for (const signer of extraSigners) signedTx.partialSign(signer);

    const rawTx = signedTx.serialize();

    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 0,
    });

    const deadline = Date.now() + 90_000;
    let lastResend = Date.now();
    let blockhashExpired = false;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));

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

      // Resend same signed bytes every 5s — no new Phantom popup
      if (Date.now() - lastResend > 5000) {
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

    // Blockhash expired or timed out — retry with a fresh one (no new Phantom popup needed
    // because Phantom already signed; but we must re-sign with new blockhash)
    if (blockhashExpired && attempt < MAX_ATTEMPTS) {
      console.warn(`[create-jar] blockhash expired, retrying (${attempt}/${MAX_ATTEMPTS})…`);
      continue;
    }

    if (!blockhashExpired) throw new Error("Transaction timed out after 90s");
  }

  throw new Error("Transaction failed after 3 attempts — devnet may be congested, please retry");
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
