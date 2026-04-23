"use client";

import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram } from "./program";

export async function createJarOnChain(
  wallet: AnchorWallet,
  connection: Connection,
  params: {
    mode: number;
    unlockDate: number;
    goalAmount: number;
    childWallet: string;
  }
): Promise<string> {
  const { PublicKey } = await import("@solana/web3.js");
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
      jar: jarKeypair.publicKey,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([jarKeypair])
    .rpc();

  return txSignature;
}
