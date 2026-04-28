"use client";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "./program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

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

  const txSignature = await program.methods
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
    .signers([jarKeypair])
    .rpc();

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

  const txSignature = await program.methods
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
    .signers([jarKeypair])
    .rpc();

  return { jarPubkey: jarKeypair.publicKey.toBase58(), txSignature };
}
