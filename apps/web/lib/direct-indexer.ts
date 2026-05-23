import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const USDC_MINT_DEVNET = "F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd";

export interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner: string;
  amount: string;
}

export interface ParsedInstruction {
  programId: string;
  accounts: string[];
  data:
    | { type: "transfer"; lamports: string }
    | { type: "splTransfer"; amount: string; authority?: string }
    | { type: "splTransferChecked"; amount: string; mint: string; authority?: string }
    | { type: "other"; raw?: unknown };
}

export interface ParsedTransactionFull {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  accountKeys: string[];
  preBalances: number[];
  postBalances: number[];
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  instructions: ParsedInstruction[];
  innerInstructions: ParsedInstruction[][];
}

export interface DirectTransfer {
  delta: bigint;
  donor: string;
}

function allInstructions(tx: ParsedTransactionFull): ParsedInstruction[] {
  const out: ParsedInstruction[] = [];
  for (const ix of tx.instructions) out.push(ix);
  for (const group of tx.innerInstructions) {
    for (const ix of group) out.push(ix);
  }
  return out;
}

export function extractSolDirectTransfer(
  tx: ParsedTransactionFull,
  jarPda: string,
): DirectTransfer | null {
  const idx = tx.accountKeys.indexOf(jarPda);
  if (idx < 0) return null;

  const pre = BigInt(tx.preBalances[idx] ?? 0);
  const post = BigInt(tx.postBalances[idx] ?? 0);
  const delta = post - pre;
  if (delta <= 0n) return null;

  let transferSum = 0n;
  let largestAmount = 0n;
  let largestSource: string | null = null;

  for (const ix of allInstructions(tx)) {
    if (ix.programId !== SYSTEM_PROGRAM_ID) continue;
    if (ix.data.type !== "transfer") continue;
    const [source, dest] = ix.accounts;
    if (dest !== jarPda) continue;
    const lamports = BigInt(ix.data.lamports);
    transferSum += lamports;
    if (lamports > largestAmount) {
      largestAmount = lamports;
      largestSource = source;
    }
  }

  if (largestSource === null) return null;
  if (transferSum !== delta) return null;

  return { delta, donor: largestSource };
}

export function extractUsdcDirectTransfer(
  tx: ParsedTransactionFull,
  jarAta: string,
): DirectTransfer | null {
  const idx = tx.accountKeys.indexOf(jarAta);
  if (idx < 0) return null;

  const pre = tx.preTokenBalances.find((b) => b.accountIndex === idx);
  const post = tx.postTokenBalances.find((b) => b.accountIndex === idx);
  if (!post) return null;

  const preAmt = pre ? BigInt(pre.amount) : 0n;
  const postAmt = BigInt(post.amount);
  const delta = postAmt - preAmt;
  if (delta <= 0n) return null;

  let transferSum = 0n;
  let largestAmount = 0n;
  let largestSourceAta: string | null = null;

  for (const ix of allInstructions(tx)) {
    if (ix.programId !== TOKEN_PROGRAM_ID) continue;

    let amount: bigint;
    let sourceAta: string;
    let destAta: string;

    if (ix.data.type === "splTransfer") {
      amount = BigInt(ix.data.amount);
      sourceAta = ix.accounts[0];
      destAta = ix.accounts[1];
    } else if (ix.data.type === "splTransferChecked") {
      amount = BigInt(ix.data.amount);
      sourceAta = ix.accounts[0];
      destAta = ix.accounts[2];
    } else {
      continue;
    }

    if (destAta !== jarAta) continue;
    transferSum += amount;
    if (amount > largestAmount) {
      largestAmount = amount;
      largestSourceAta = sourceAta;
    }
  }

  if (largestSourceAta === null) return null;
  if (transferSum !== delta) return null;

  const srcIdx = tx.accountKeys.indexOf(largestSourceAta);
  const srcTokenBalance =
    tx.preTokenBalances.find((b) => b.accountIndex === srcIdx) ??
    tx.postTokenBalances.find((b) => b.accountIndex === srcIdx);
  if (!srcTokenBalance) return null;

  return { delta, donor: srcTokenBalance.owner };
}

export function getUsdcAta(jarPda: string): string {
  return getAssociatedTokenAddressSync(
    new PublicKey(USDC_MINT_DEVNET),
    new PublicKey(jarPda),
    true,
  ).toBase58();
}
