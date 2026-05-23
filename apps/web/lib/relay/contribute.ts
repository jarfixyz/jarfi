import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { JarfiClient } from "@jarfi/sdk";
import { makeKeypairWallet } from "./wallet";

const SOL_PREFUND_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

async function ensurePrefund(
  connection: Connection,
  treasury: Keypair,
  ephemeral: PublicKey,
  needLamports: number,
): Promise<void> {
  const balance = await connection.getBalance(ephemeral, "confirmed");
  if (balance >= needLamports) return;
  const topUp = needLamports - balance;
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: ephemeral,
      lamports: topUp,
    }),
  );
  await sendAndConfirmTransaction(connection, tx, [treasury], {
    commitment: "confirmed",
  });
}

export interface RelayContributeArgs {
  connection: Connection;
  treasury: Keypair;
  ephemeral: Keypair;
  jarPda: PublicKey;
  asset: "sol" | "usdc";
  amountUiu: bigint;
  usdcMint?: PublicKey;
}

export async function relayContribute(
  args: RelayContributeArgs,
): Promise<string> {
  const { connection, treasury, ephemeral, jarPda, asset, amountUiu } = args;

  if (asset === "sol") {
    const needed = Number(amountUiu) + SOL_PREFUND_LAMPORTS;
    await ensurePrefund(connection, treasury, ephemeral.publicKey, needed);
    const onchain = await connection.getBalance(ephemeral.publicKey, "confirmed");
    if (BigInt(onchain) < amountUiu + BigInt(5_000)) {
      throw new Error(
        `ephemeral SOL too low: have ${onchain}, need ${amountUiu + 5_000n}`,
      );
    }
    const client = new JarfiClient(connection, makeKeypairWallet(ephemeral));
    // Fetch jar to determine if Marinade auto-stake is active.
    const jarResult = await client.fetchJar(jarPda);
    const isMarinade = jarResult?.account.stakeProtocol === 2;
    return client.contributeSol(
      ephemeral.publicKey,
      jarPda,
      new BN(amountUiu.toString()),
      { marinade: isMarinade },
    );
  }

  const mint = args.usdcMint;
  if (!mint) throw new Error("usdcMint required for spl contribute");

  await ensurePrefund(connection, treasury, ephemeral.publicKey, SOL_PREFUND_LAMPORTS);

  const donorAta = getAssociatedTokenAddressSync(mint, ephemeral.publicKey);
  const jarVault = getAssociatedTokenAddressSync(mint, jarPda, true);

  let donorBalance = 0n;
  try {
    const acc = await getAccount(connection, donorAta, "confirmed");
    donorBalance = acc.amount;
  } catch {
    // ATA might not exist yet — Transak may have used a non-ATA path.
    // Create it from treasury, then we expect Transak to deposit.
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        treasury.publicKey,
        donorAta,
        ephemeral.publicKey,
        mint,
      ),
    );
    await sendAndConfirmTransaction(connection, tx, [treasury], {
      commitment: "confirmed",
    });
  }
  if (donorBalance < amountUiu) {
    throw new Error(
      `ephemeral USDC too low: have ${donorBalance}, need ${amountUiu}`,
    );
  }

  const client = new JarfiClient(connection, makeKeypairWallet(ephemeral));
  return client.contributeSpl(
    ephemeral.publicKey,
    jarPda,
    donorAta,
    jarVault,
    new BN(amountUiu.toString()),
  );
}
