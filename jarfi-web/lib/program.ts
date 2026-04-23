import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { JarfiContract } from "./jarfi_contract";
import IDL from "./idl.json";

export const PROGRAM_ID = new PublicKey(
  "HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW"
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("devnet");

export function getProgram(wallet: AnchorWallet, connection: Connection) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program<JarfiContract>(IDL, provider);
}

// ---------------------------------------------------------------------------
// Shape of a fetched Jar account (decoded from on-chain)
// ---------------------------------------------------------------------------

export type JarAccount = {
  pubkey: string;
  owner: string;
  mode: number;        // 0 = date, 1 = goal, 2 = either
  unlockDate: number;  // unix timestamp
  goalAmount: number;
  balance: number;
  stakingShares: number;
  createdAt: number;
  dailyLimit: number;
  weeklyLimit: number;
  childWallet: string;
  childSpendableBalance: number;
  unlocked: boolean;
};

export type ContributionAccount = {
  pubkey: string;
  contributor: string;
  amount: number;
  comment: string;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Fetch all jars owned by a wallet
// ---------------------------------------------------------------------------

export async function fetchJarsByOwner(
  connection: Connection,
  ownerPubkey: PublicKey,
  wallet: AnchorWallet
): Promise<JarAccount[]> {
  const program = getProgram(wallet, connection);

  const accounts = await program.account.jar.all([
    {
      memcmp: {
        offset: 8, // skip 8-byte discriminator
        bytes: ownerPubkey.toBase58(),
      },
    },
  ]);

  return accounts.map(({ publicKey, account }) => ({
    pubkey: publicKey.toBase58(),
    owner: account.owner.toBase58(),
    mode: account.mode,
    unlockDate: (account.unlockDate as BN).toNumber(),
    goalAmount: (account.goalAmount as BN).toNumber(),
    balance: (account.balance as BN).toNumber(),
    stakingShares: (account.stakingShares as BN).toNumber(),
    createdAt: (account.createdAt as BN).toNumber(),
    dailyLimit: (account.dailyLimit as BN).toNumber(),
    weeklyLimit: (account.weeklyLimit as BN).toNumber(),
    childWallet: account.childWallet.toBase58(),
    childSpendableBalance: (account.childSpendableBalance as BN).toNumber(),
    unlocked: account.unlocked as boolean,
  }));
}

// ---------------------------------------------------------------------------
// Fetch contributions for a specific jar
// ---------------------------------------------------------------------------

export async function fetchContributions(
  connection: Connection,
  jarPubkey: PublicKey,
  wallet: AnchorWallet
): Promise<ContributionAccount[]> {
  const program = getProgram(wallet, connection);

  const accounts = await program.account.contribution.all([
    {
      memcmp: {
        offset: 8,
        bytes: jarPubkey.toBase58(),
      },
    },
  ]);

  return accounts
    .map(({ publicKey, account }) => ({
      pubkey: publicKey.toBase58(),
      contributor: account.contributor.toBase58(),
      amount: (account.amount as BN).toNumber(),
      comment: account.comment as string,
      createdAt: (account.createdAt as BN).toNumber(),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
