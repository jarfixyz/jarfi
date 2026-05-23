import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

export type JarType = "flexible" | "timeLocked";
export type Asset = "sol" | "usdc";
export type JarStatus = "active" | "withdrawn" | "cancelled";

export interface JarAccount {
  version: number;
  owner: PublicKey;
  id: BN;
  jarType: JarType;
  asset: Asset;
  goalAmount: BN;
  unlockTimestamp: BN;
  totalContributed: BN;
  totalContributors: number;
  metadataUri: string;
  metadataHash: number[];
  status: JarStatus;
  createdAt: BN;
  bump: number;
  /** 0 = None, 1 = MarginFi, 2 = MarinadeSol */
  stakeProtocol: number;
  autoStake: boolean;
}

export interface ContributionAccount {
  version: number;
  jar: PublicKey;
  donor: PublicKey;
  amount: BN;
  firstContributedAt: BN;
  lastContributedAt: BN;
  refunded: boolean;
  bump: number;
}

export interface ConfigAccount {
  version: number;
  admin: PublicKey;
  pendingAdmin: PublicKey | null;
  treasuryBump: number;
  creationFeeLamports: BN;
  withdrawFeeBps: number;
  feeEnabled: boolean;
  paused: boolean;
  bump: number;
  autoStakeEnabled: boolean;
  minAutoStakeLockDays: number;
}

export interface UserStateAccount {
  version: number;
  owner: PublicKey;
  jarCount: BN;
  bump: number;
}

export interface CreateJarParams {
  jarType: JarType;
  asset: Asset;
  goalAmount: BN;
  unlockTimestamp: BN;
  metadataUri: string;
  metadataHash: Uint8Array;
  autoStake?: boolean;
}
