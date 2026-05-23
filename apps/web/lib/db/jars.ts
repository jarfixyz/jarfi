import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { jarsCache } from "./schema";

export interface UpsertJar {
  jarPda: string;
  jarType: "flexible" | "timeLocked";
  asset: "sol" | "usdc";
  ownerWallet: string;
  goalAmount: string;
  unlockTimestamp: number | null;
  totalContributed: string;
  totalContributors: number;
  status: "active" | "withdrawn" | "cancelled";
  metadataUri: string;
  metadataHash: string;
  lastOnchainSlot: number;
}

export async function upsertJar(db: Db, j: UpsertJar): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(jarsCache)
    .values({ ...j, cachedAt: now })
    .onConflictDoUpdate({
      target: jarsCache.jarPda,
      set: {
        totalContributed: j.totalContributed,
        totalContributors: j.totalContributors,
        status: j.status,
        metadataUri: j.metadataUri,
        metadataHash: j.metadataHash,
        cachedAt: now,
        lastOnchainSlot: j.lastOnchainSlot,
      },
    });
}

export async function applyContributeDelta(
  db: Db,
  jarPda: string,
  deltaAmount: string,
  newTotal: string,
  contributorsAfter: number,
  slot: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jarsCache)
    .set({
      totalContributed: newTotal,
      totalContributors: contributorsAfter,
      cachedAt: now,
      lastOnchainSlot: slot,
    })
    .where(eq(jarsCache.jarPda, jarPda));
}

export async function markJarStatus(
  db: Db,
  jarPda: string,
  status: "active" | "withdrawn" | "cancelled",
  slot: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jarsCache)
    .set({ status, cachedAt: now, lastOnchainSlot: slot })
    .where(eq(jarsCache.jarPda, jarPda));
}

export async function getJarByPda(db: Db, jarPda: string) {
  return db.select().from(jarsCache).where(eq(jarsCache.jarPda, jarPda)).get();
}

export async function getJarsByOwner(db: Db, ownerWallet: string) {
  return db
    .select()
    .from(jarsCache)
    .where(eq(jarsCache.ownerWallet, ownerWallet))
    .all();
}

export interface ActiveJar {
  jarPda: string;
  asset: "sol" | "usdc";
  lastDirectSig: string | null;
}

export async function selectActiveJars(db: Db): Promise<ActiveJar[]> {
  const rows = await db
    .select({
      jarPda: jarsCache.jarPda,
      asset: jarsCache.asset,
      lastDirectSig: jarsCache.lastDirectSig,
    })
    .from(jarsCache)
    .where(eq(jarsCache.status, "active"))
    .all();
  return rows.map((r) => ({
    jarPda: r.jarPda,
    asset: r.asset as "sol" | "usdc",
    lastDirectSig: r.lastDirectSig,
  }));
}

export async function setLastDirectSig(
  db: Db,
  jarPda: string,
  signature: string,
): Promise<void> {
  await db
    .update(jarsCache)
    .set({ lastDirectSig: signature })
    .where(eq(jarsCache.jarPda, jarPda));
}

export async function incrementJarTotal(
  db: Db,
  jarPda: string,
  deltaAmount: string,
  newDonors: number,
  slot: number,
): Promise<void> {
  const existing = await getJarByPda(db, jarPda);
  if (!existing) return;
  const newTotal = (
    BigInt(existing.totalContributed) + BigInt(deltaAmount)
  ).toString();
  const newContributors = existing.totalContributors + newDonors;
  const newSlot = Math.max(existing.lastOnchainSlot, slot);
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jarsCache)
    .set({
      totalContributed: newTotal,
      totalContributors: newContributors,
      lastOnchainSlot: newSlot,
      cachedAt: now,
    })
    .where(eq(jarsCache.jarPda, jarPda));
}
