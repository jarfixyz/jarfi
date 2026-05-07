"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "./program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { USDC_MINT_DEVNET, USDC_MINT_MAINNET } from "./create-jar";
import { sendAndConfirmRobust } from "./send-tx";

function usdcMint(): PublicKey {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
    ? USDC_MINT_MAINNET
    : USDC_MINT_DEVNET;
}

// ---------------------------------------------------------------------------
// Direct USDC deposit from connected wallet into a jar vault.
// amountUsd — dollars (e.g. 100 → 100_000_000 micro-units on-chain).
// Returns the confirmed transaction signature.
// ---------------------------------------------------------------------------

export async function depositUsdcFromWallet(
  wallet: AnchorWallet,
  connection: Connection,
  jarPubkey: string,
  amountUsd: number,
): Promise<string> {
  const program = getProgram(wallet, connection);
  const jar = new PublicKey(jarPubkey);
  const mint = usdcMint();
  const amountMicro = Math.round(amountUsd * 1_000_000);

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jar.toBuffer()],
    PROGRAM_ID
  );
  const jarUsdcVault = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  const depositorUsdcAccount = await getAssociatedTokenAddress(mint, wallet.publicKey, false);

  const signature = await sendAndConfirmRobust(
    connection,
    wallet,
    async () => {
      const tx = await program.methods
        .depositUsdc(new BN(amountMicro))
        .accounts({
          jar,
          jarUsdcVault,
          vaultAuthority,
          depositorUsdcAccount,
          usdcMint: mint,
          depositor: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } as never)
        .transaction();
      // Ensure depositor's USDC ATA exists before sending
      tx.instructions.unshift(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          depositorUsdcAccount,
          wallet.publicKey,
          mint,
        )
      );
      return tx;
    },
    [],
    "deposit-usdc"
  );

  console.log("[deposit-usdc] tx:", signature);
  return signature;
}
