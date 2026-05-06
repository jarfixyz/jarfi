"use client";

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "./program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

// Sign once → resend same bytes every 5s until confirmed or blockhash expires.
// Avoids multiple Phantom popups and "already in use" errors on retry.
async function sendAndConfirmRobust(
  connection: Connection,
  wallet: AnchorWallet,
  buildTx: () => Promise<Transaction>,
  extraSigners: Keypair[]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = await buildTx();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  for (const signer of extraSigners) tx.partialSign(signer);

  const signedTx = await wallet.signTransaction(tx);
  const rawTx = signedTx.serialize();

  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: true,
    maxRetries: 0,
  });

  const deadline = Date.now() + 90_000;
  let lastResend = Date.now();

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
      // Re-throw real tx errors; ignore transient RPC failures and keep polling
      if ((e as Error).message?.startsWith("Transaction failed:")) throw e;
    }

    // Resend same signed bytes every 5s — no new signing, no new Phantom popup
    if (Date.now() - lastResend > 5000) {
      connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
      lastResend = Date.now();
    }

    try {
      const blockHeight = await connection.getBlockHeight();
      if (blockHeight > lastValidBlockHeight) {
        throw new Error("blockhash expired — please try again");
      }
    } catch (e) {
      if ((e as Error).message?.includes("blockhash expired")) throw e;
      // Transient RPC error on getBlockHeight — keep polling
    }
  }

  throw new Error("Transaction timed out after 90s");
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
