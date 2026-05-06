"use client";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "./program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { USDC_MINT_DEVNET, USDC_MINT_MAINNET } from "./create-jar";

function usdcMint(): PublicKey {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
    ? USDC_MINT_MAINNET
    : USDC_MINT_DEVNET;
}

// Sign once → resend same bytes every 5s until confirmed or blockhash expires.
async function sendAndConfirmRobust(
  connection: Connection,
  wallet: AnchorWallet,
  buildTx: () => Promise<Transaction>
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = await buildTx();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

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
    }
  }

  throw new Error("Transaction timed out after 90s");
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

  return sendAndConfirmRobust(connection, wallet, () =>
    program.methods
      .emergencyWithdraw()
      .accounts({
        jar,
        owner: wallet.publicKey,
      } as never)
      .transaction()
  );
}

// ---------------------------------------------------------------------------
// USDC jar — withdraw_usdc(amount) (returns all USDC to owner ATA)
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

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jar.toBuffer()],
    PROGRAM_ID
  );
  const jarUsdcVault = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  const ownerUsdcAccount = await getAssociatedTokenAddress(mint, wallet.publicKey, false);

  return sendAndConfirmRobust(connection, wallet, () =>
    program.methods
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
      .transaction()
  );
}
