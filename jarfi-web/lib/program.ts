import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js";
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

export const CURRENCY_USDC = 0;
export const CURRENCY_SOL  = 1;

export type JarAccount = {
  pubkey: string;
  owner: string;
  mode: number;        // 0 = date, 1 = goal, 2 = either
  unlockDate: number;
  goalAmount: number;
  balance: number;     // lamports (SOL mode)
  stakingShares: number;
  createdAt: number;
  dailyLimit: number;
  weeklyLimit: number;
  childWallet: string;
  childSpendableBalance: number;
  unlocked: boolean;
  jarCurrency: number; // 0 = USDC, 1 = SOL
  usdcBalance: number; // USDC micro-units (6 decimals)
  usdcVault: string;
};

export type ContributionAccount = {
  pubkey: string;
  contributor: string;
  amount: number;
  comment: string;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Read-only program instance (no wallet needed — for gift page / public reads)
// ---------------------------------------------------------------------------

const DUMMY_WALLET: AnchorWallet = {
  publicKey: new PublicKey("11111111111111111111111111111111"),
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise.resolve(tx),
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise.resolve(txs),
};

export function getReadonlyProgram(connection: Connection) {
  const provider = new AnchorProvider(connection, DUMMY_WALLET, {
    commitment: "confirmed",
  });
  return new Program<JarfiContract>(IDL, provider);
}

// ---------------------------------------------------------------------------
// Fetch a single jar by its on-chain pubkey (no wallet required)
// ---------------------------------------------------------------------------

export async function fetchJarByPubkey(
  connection: Connection,
  jarPubkey: PublicKey
): Promise<JarAccount | null> {
  try {
    const program = getReadonlyProgram(connection);
    const account = await program.account.jar.fetch(jarPubkey);
    return {
      pubkey: jarPubkey.toBase58(),
      owner: (account.owner as PublicKey).toBase58(),
      mode: account.mode as number,
      unlockDate: (account.unlockDate as BN).toNumber(),
      goalAmount: (account.goalAmount as BN).toNumber(),
      balance: (account.balance as BN).toNumber(),
      stakingShares: (account.stakingShares as BN).toNumber(),
      createdAt: (account.createdAt as BN).toNumber(),
      dailyLimit: (account.dailyLimit as BN).toNumber(),
      weeklyLimit: (account.weeklyLimit as BN).toNumber(),
      childWallet: (account.childWallet as PublicKey).toBase58(),
      childSpendableBalance: (account.childSpendableBalance as BN).toNumber(),
      unlocked: account.unlocked as boolean,
      jarCurrency: account.jarCurrency as number,
      usdcBalance: (account.usdcBalance as BN).toNumber(),
      usdcVault: (account.usdcVault as PublicKey).toBase58(),
    };
  } catch {
    return null;
  }
}

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
    jarCurrency: account.jarCurrency as number,
    usdcBalance: (account.usdcBalance as BN).toNumber(),
    usdcVault: (account.usdcVault as PublicKey).toBase58(),
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
