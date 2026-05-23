import type { CircuitBreakerRpc } from "./rpc";
import type {
  ParsedInstruction,
  ParsedTransactionFull,
  TokenBalance,
} from "./direct-indexer";

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}

export interface ParsedTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  logs: string[];
  err: unknown;
}

const PAGE_LIMIT = 200;

export async function fetchNewSignatures(
  rpc: CircuitBreakerRpc,
  programId: string,
  until: string | null,
): Promise<SignatureInfo[]> {
  const all: SignatureInfo[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const params: [string, Record<string, unknown>] = [
      programId,
      { limit: PAGE_LIMIT, before, until: until ?? undefined },
    ];
    const page = (await rpc.call<SignatureInfo[]>(
      "getSignaturesForAddress",
      params,
    )) ?? [];
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_LIMIT) break;
    before = page[page.length - 1].signature;
  }

  return all.reverse();
}

export async function fetchTransaction(
  rpc: CircuitBreakerRpc,
  signature: string,
): Promise<ParsedTransaction | null> {
  const raw = await rpc.call<{
    slot: number;
    blockTime: number | null;
    meta: { err: unknown; logMessages: string[] | null };
  } | null>("getTransaction", [
    signature,
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  ]);
  if (!raw) return null;
  return {
    signature,
    slot: raw.slot,
    blockTime: raw.blockTime,
    logs: raw.meta.logMessages ?? [],
    err: raw.meta.err,
  };
}

interface RawParsedTx {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: { amount: string };
    }>;
    postTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: { amount: string };
    }>;
    innerInstructions?: Array<{ instructions: RawIx[] }>;
  };
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string } | string>;
      instructions: RawIx[];
    };
  };
}

interface RawIx {
  programId: string;
  accounts?: string[];
  parsed?: {
    type: string;
    info: Record<string, unknown>;
  };
}

function normalizeTokenBalance(b: {
  accountIndex: number;
  mint: string;
  owner: string;
  uiTokenAmount: { amount: string };
}): TokenBalance {
  return {
    accountIndex: b.accountIndex,
    mint: b.mint,
    owner: b.owner,
    amount: b.uiTokenAmount.amount,
  };
}

function normalizeIx(raw: RawIx): ParsedInstruction {
  const accounts = raw.accounts ?? [];
  const parsed = raw.parsed;
  if (!parsed) {
    return { programId: raw.programId, accounts, data: { type: "other" } };
  }
  const info = parsed.info as Record<string, unknown>;
  if (parsed.type === "transfer" && info.lamports !== undefined) {
    return {
      programId: raw.programId,
      accounts,
      data: { type: "transfer", lamports: String(info.lamports) },
    };
  }
  if (parsed.type === "transfer" && info.amount !== undefined) {
    return {
      programId: raw.programId,
      accounts,
      data: {
        type: "splTransfer",
        amount: String(info.amount),
        authority: info.authority as string | undefined,
      },
    };
  }
  if (parsed.type === "transferChecked") {
    const tokenAmount = info.tokenAmount as { amount: string } | undefined;
    return {
      programId: raw.programId,
      accounts,
      data: {
        type: "splTransferChecked",
        amount: tokenAmount?.amount ?? String(info.amount ?? "0"),
        mint: info.mint as string,
        authority: info.authority as string | undefined,
      },
    };
  }
  return { programId: raw.programId, accounts, data: { type: "other" } };
}

export async function fetchTransactionFull(
  rpc: CircuitBreakerRpc,
  signature: string,
): Promise<ParsedTransactionFull | null> {
  const raw = await rpc.call<RawParsedTx | null>("getTransaction", [
    signature,
    {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
      encoding: "jsonParsed",
    },
  ]);
  if (!raw) return null;

  const accountKeys = raw.transaction.message.accountKeys.map((k) =>
    typeof k === "string" ? k : k.pubkey,
  );

  const instructions = raw.transaction.message.instructions.map(normalizeIx);
  const innerInstructions =
    raw.meta.innerInstructions?.map((group) =>
      group.instructions.map(normalizeIx),
    ) ?? [];

  return {
    signature,
    slot: raw.slot,
    blockTime: raw.blockTime,
    err: raw.meta.err,
    accountKeys,
    preBalances: raw.meta.preBalances,
    postBalances: raw.meta.postBalances,
    preTokenBalances: (raw.meta.preTokenBalances ?? []).map(normalizeTokenBalance),
    postTokenBalances: (raw.meta.postTokenBalances ?? []).map(normalizeTokenBalance),
    instructions,
    innerInstructions,
  };
}
