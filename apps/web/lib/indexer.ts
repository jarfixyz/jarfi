import { parseLogs, type ParsedEvent } from "@jarfi/sdk";
import type { ParsedTransaction } from "./helius";
import { fetchNewSignatures, fetchTransaction, fetchTransactionFull, type SignatureInfo } from "./helius";
import type { Db } from "./db/client";
import type { CircuitBreakerRpc } from "./rpc";
import { getLastSignature, setLastSignature, setLastSlot } from "./db/state";
import { insertEventIfNew } from "./db/events";
import type { EventRow } from "./db/events";
import {
  upsertJar,
  applyContributeDelta,
  markJarStatus,
  incrementJarTotal,
  selectActiveJars,
  setLastDirectSig,
  type ActiveJar,
} from "./db/jars";
import type { UpsertJar } from "./db/jars";
import { applyContribution, markRefunded } from "./db/contributions";
import type { DirectTransfer } from "./direct-indexer";
import {
  extractSolDirectTransfer,
  extractUsdcDirectTransfer,
  getUsdcAta,
} from "./direct-indexer";

const JAR_TYPE = ["flexible", "timeLocked"] as const;
const ASSET = ["sol", "usdc"] as const;

export interface IndexerDeps {
  upsertJar: (j: UpsertJar) => Promise<void>;
  applyContributeDelta: (
    jarPda: string,
    delta: string,
    total: string,
    contributorsAfter: number,
    slot: number,
  ) => Promise<void>;
  markJarStatus: (
    jarPda: string,
    status: "active" | "withdrawn" | "cancelled",
    slot: number,
  ) => Promise<void>;
  applyContribution: (
    jarPda: string,
    donor: string,
    amountDelta: string,
    ts: number,
  ) => Promise<{ isNew: boolean }>;
  markRefunded: (jarPda: string, donor: string) => Promise<void>;
  insertEventIfNew: (row: EventRow) => Promise<boolean>;
  incrementJarTotal: (
    jarPda: string,
    deltaAmount: string,
    newDonors: number,
    slot: number,
  ) => Promise<void>;
}

function asStr(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && "toString" in (x as object)) {
    return (x as { toString: () => string }).toString();
  }
  return String(x);
}
function asNum(x: unknown): number {
  return Number(asStr(x));
}

export async function applyParsedEvent(
  deps: IndexerDeps,
  ev: ParsedEvent,
  tx: ParsedTransaction,
): Promise<void> {
  const blockTime = tx.blockTime ?? 0;
  const baseRow = {
    signature: tx.signature,
    slot: tx.slot,
    blockTime,
  };

  switch (ev.name) {
    case "createJarEvent": {
      const d = ev.data;
      const jarPda = asStr(d.jar);
      const owner = asStr(d.owner);
      const jarTypeIdx = asNum(d.jarType);
      const assetIdx = asNum(d.asset);
      const row: EventRow = {
        ...baseRow,
        jarPda,
        kind: "create",
        actorWallet: owner,
        amount: asStr(d.goalAmount),
        metadataJson: JSON.stringify({
          metadataUri: asStr(d.metadataUri),
          metadataHash: d.metadataHash,
        }),
      };
      const inserted = await deps.insertEventIfNew(row);
      if (!inserted) return;
      await deps.upsertJar({
        jarPda,
        jarType: JAR_TYPE[jarTypeIdx] ?? "flexible",
        asset: ASSET[assetIdx] ?? "sol",
        ownerWallet: owner,
        goalAmount: asStr(d.goalAmount),
        unlockTimestamp: asNum(d.unlockTimestamp) || null,
        totalContributed: "0",
        totalContributors: 0,
        status: "active",
        metadataUri: asStr(d.metadataUri),
        metadataHash: JSON.stringify(d.metadataHash),
        lastOnchainSlot: tx.slot,
      });
      return;
    }
    case "contributeEvent": {
      const d = ev.data;
      const jarPda = asStr(d.jar);
      const donor = asStr(d.donor);
      const delta = asStr(d.amountDelta);
      const total = asStr(d.totalAfter);
      const count = asNum(d.contributorsAfter);
      const ts = asNum(d.ts);
      const row: EventRow = {
        ...baseRow,
        jarPda,
        kind: "contribute",
        actorWallet: donor,
        amount: delta,
        metadataJson: null,
      };
      const inserted = await deps.insertEventIfNew(row);
      if (!inserted) return;
      await deps.applyContributeDelta(jarPda, delta, total, count, tx.slot);
      // Phase 1 has authoritative contributorsAfter from the event; isNew unused.
      await deps.applyContribution(jarPda, donor, delta, ts);
      return;
    }
    case "withdrawEvent": {
      const d = ev.data;
      const jarPda = asStr(d.jar);
      const owner = asStr(d.owner);
      const row: EventRow = {
        ...baseRow,
        jarPda,
        kind: "withdraw",
        actorWallet: owner,
        amount: asStr(d.amount),
        metadataJson: JSON.stringify({ fee: asStr(d.fee) }),
      };
      const inserted = await deps.insertEventIfNew(row);
      if (!inserted) return;
      await deps.markJarStatus(jarPda, "withdrawn", tx.slot);
      return;
    }
    case "cancelEvent": {
      const d = ev.data;
      const jarPda = asStr(d.jar);
      const owner = asStr(d.owner);
      const row: EventRow = {
        ...baseRow,
        jarPda,
        kind: "cancel",
        actorWallet: owner,
        amount: null,
        metadataJson: null,
      };
      const inserted = await deps.insertEventIfNew(row);
      if (!inserted) return;
      await deps.markJarStatus(jarPda, "cancelled", tx.slot);
      return;
    }
    case "refundEvent": {
      const d = ev.data;
      const jarPda = asStr(d.jar);
      const donor = asStr(d.donor);
      const row: EventRow = {
        ...baseRow,
        jarPda,
        kind: "refund",
        actorWallet: donor,
        amount: asStr(d.amount),
        metadataJson: null,
      };
      const inserted = await deps.insertEventIfNew(row);
      if (!inserted) return;
      await deps.markRefunded(jarPda, donor);
      return;
    }
    case "metadataUpdatedEvent":
    case "closeJarEvent":
      return;
    default:
      return;
  }
}

export async function applyDirectContribution(
  deps: Pick<IndexerDeps, "insertEventIfNew" | "applyContribution" | "incrementJarTotal">,
  jar: ActiveJar,
  signature: string,
  transfer: DirectTransfer,
  blockTime: number,
  slot: number,
): Promise<void> {
  const inserted = await deps.insertEventIfNew({
    signature,
    slot,
    blockTime,
    jarPda: jar.jarPda,
    kind: "contribute",
    actorWallet: transfer.donor,
    amount: transfer.delta.toString(),
    metadataJson: JSON.stringify({ source: "direct" }),
  });
  if (!inserted) return;

  const { isNew } = await deps.applyContribution(
    jar.jarPda,
    transfer.donor,
    transfer.delta.toString(),
    blockTime,
  );
  await deps.incrementJarTotal(
    jar.jarPda,
    transfer.delta.toString(),
    isNew ? 1 : 0,
    slot,
  );
}

interface IndexerResult {
  signaturesProcessed: number;
  eventsApplied: number;
  lastSlot: number;
}

export async function runIndexerOnce(
  db: Db,
  rpc: CircuitBreakerRpc,
  programId: string,
): Promise<IndexerResult> {
  const deps: IndexerDeps = {
    upsertJar: (j) => upsertJar(db, j),
    applyContributeDelta: (jar, delta, total, count, slot) =>
      applyContributeDelta(db, jar, delta, total, count, slot),
    markJarStatus: (jar, status, slot) => markJarStatus(db, jar, status, slot),
    applyContribution: (jar, donor, delta, ts) =>
      applyContribution(db, jar, donor, delta, ts),
    markRefunded: (jar, donor) => markRefunded(db, jar, donor),
    insertEventIfNew: (row) => insertEventIfNew(db, row),
    incrementJarTotal: (jar, delta, newDonors, slot) =>
      incrementJarTotal(db, jar, delta, newDonors, slot),
  };

  const until = await getLastSignature(db);
  const sigs = await fetchNewSignatures(rpc, programId, until);

  let eventsApplied = 0;
  let lastSlot = 0;
  let lastSig: string | null = null;

  for (const s of sigs) {
    if (s.err) continue;
    const tx = await fetchTransaction(rpc, s.signature);
    if (!tx) continue;
    const parsed = parseLogs(tx.logs);
    for (const ev of parsed) {
      await applyParsedEvent(deps, ev, tx);
      eventsApplied += 1;
    }
    lastSlot = Math.max(lastSlot, s.slot);
    lastSig = s.signature;
  }

  if (lastSig) {
    await setLastSignature(db, lastSig);
    await setLastSlot(db, lastSlot);
  }

  // ---- phase 2 (direct transfers, per-jar scan) ----
  const activeJars = await selectActiveJars(db);
  for (const jar of activeJars) {
    const target =
      jar.asset === "sol" ? jar.jarPda : getUsdcAta(jar.jarPda);

    // On first sight of a jar, scan the full history of its target address
    // (jar PDA for SOL, jar ATA for USDC) so we never miss contributions made
    // between CreateJar confirmation and the first cron tick. For freshly
    // created jars the history is tiny (just the CreateJar tx itself).
    let jarSigs: SignatureInfo[];
    try {
      jarSigs = await fetchNewSignatures(rpc, target, jar.lastDirectSig);
    } catch (e) {
      console.warn("direct-phase: fetchNewSignatures failed", jar.jarPda, e);
      continue;
    }
    if (jarSigs.length === 0) continue;

    for (const s of jarSigs) {
      if (s.err) continue;
      const tx = await fetchTransactionFull(rpc, s.signature);
      if (!tx) continue;
      const result =
        jar.asset === "sol"
          ? extractSolDirectTransfer(tx, jar.jarPda)
          : extractUsdcDirectTransfer(tx, target);
      if (!result) {
        console.warn("direct-phase: skipped ambiguous tx", {
          signature: s.signature,
          jarPda: jar.jarPda,
        });
        continue;
      }
      await applyDirectContribution(
        deps,
        jar,
        s.signature,
        result,
        tx.blockTime ?? 0,
        tx.slot,
      );
      eventsApplied += 1;
      lastSlot = Math.max(lastSlot, tx.slot);
    }

    const lastJarSig = jarSigs[jarSigs.length - 1].signature;
    await setLastDirectSig(db, jar.jarPda, lastJarSig);
  }

  return { signaturesProcessed: sigs.length, eventsApplied, lastSlot };
}
