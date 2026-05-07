"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, getReadonlyProgram, PROGRAM_ID } from "./program";
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
// USDC jar — full break flow:
//   1. unlock_jar  (if jar.unlocked === false)
//   2. withdraw_usdc(amount)  (if usdcBalanceMicroUnits > 0)
//
// Contract requires jar.unlocked === true before withdraw_usdc can succeed.
// ---------------------------------------------------------------------------

export async function breakUsdcJarOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  jarPubkey: string,
  usdcBalanceMicroUnits: number
): Promise<string> {
  const program = getProgram(wallet, connection);
  const jar = new PublicKey(jarPubkey);
  const mint = usdcMint();

  // Fetch live jar state to check whether it's already unlocked
  const readProgram = getReadonlyProgram(connection);
  const jarAccount = await readProgram.account.jar.fetch(jar);
  const isAlreadyUnlocked = jarAccount.unlocked as boolean;

  let lastSignature = "";

  // Step 1: unlock_jar (only if not already unlocked)
  if (!isAlreadyUnlocked) {
    lastSignature = await sendAndConfirmRobust(
      connection,
      wallet,
      () => program.methods
        .unlockJar()
        .accounts({
          jar,
          owner: wallet.publicKey,
        } as never)
        .transaction(),
      [],
      "unlock-jar"
    );
  }

  // Step 2: withdraw_usdc (only if there's a balance to withdraw)
  if (usdcBalanceMicroUnits <= 0) {
    return lastSignature;
  }

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jar.toBuffer()],
    PROGRAM_ID
  );
  const jarUsdcVault = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  const ownerUsdcAccount = await getAssociatedTokenAddress(mint, wallet.publicKey, false);

  lastSignature = await sendAndConfirmRobust(
    connection,
    wallet,
    async () => {
      const tx = await program.methods
        .withdrawUsdc(new BN(usdcBalanceMicroUnits))
        .accounts({
          jar,
          jarUsdcVault,
          vaultAuthority,
          ownerUsdcAccount,
          usdcMint: mint,
          owner: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } as never)
        .transaction();
      // Prepend idempotent ATA creation — safe if ATA already exists, required if not
      tx.instructions.unshift(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          ownerUsdcAccount,
          wallet.publicKey,
          mint,
        )
      );
      return tx;
    },
    [],
    "withdraw-usdc"
  );

  return lastSignature;
}

// ---------------------------------------------------------------------------
// SOL jar — emergency_withdraw (returns all SOL to jar owner)
// ---------------------------------------------------------------------------

export async function breakSolJarOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  jarPubkey: string
): Promise<string> {
  const program = getProgram(wallet, connection);
  const jar = new PublicKey(jarPubkey);

  return sendAndConfirmRobust(
    connection,
    wallet,
    () => program.methods
      .emergencyWithdraw()
      .accounts({
        jar,
        owner: wallet.publicKey,
      } as never)
      .transaction(),
    [],
    "emergency-withdraw"
  );
}
