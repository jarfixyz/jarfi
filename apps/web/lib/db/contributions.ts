import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { contributionsCache } from "./schema";

export async function listContributorsForJar(
  db: Db,
  jarPda: string,
  limit = 50,
) {
  return db
    .select()
    .from(contributionsCache)
    .where(eq(contributionsCache.jarPda, jarPda))
    .orderBy(desc(contributionsCache.lastAt))
    .limit(limit)
    .all();
}

export async function setDonorName(
  db: Db,
  jarPda: string,
  donorWallet: string,
  name: string | null,
): Promise<void> {
  await db
    .update(contributionsCache)
    .set({ donorName: name })
    .where(
      and(
        eq(contributionsCache.jarPda, jarPda),
        eq(contributionsCache.donorWallet, donorWallet),
      ),
    );
}

export async function applyContribution(
  db: Db,
  jarPda: string,
  donorWallet: string,
  amountDelta: string,
  ts: number,
): Promise<{ isNew: boolean }> {
  const existing = await db
    .select()
    .from(contributionsCache)
    .where(
      and(
        eq(contributionsCache.jarPda, jarPda),
        eq(contributionsCache.donorWallet, donorWallet),
      ),
    )
    .get();

  if (!existing) {
    await db.insert(contributionsCache).values({
      jarPda,
      donorWallet,
      amount: amountDelta,
      firstAt: ts,
      lastAt: ts,
      refunded: 0,
    });
    return { isNew: true };
  }

  const newAmount = (BigInt(existing.amount) + BigInt(amountDelta)).toString();
  await db
    .update(contributionsCache)
    .set({ amount: newAmount, lastAt: ts, refunded: 0 })
    .where(
      and(
        eq(contributionsCache.jarPda, jarPda),
        eq(contributionsCache.donorWallet, donorWallet),
      ),
    );
  return { isNew: false };
}

export async function markRefunded(
  db: Db,
  jarPda: string,
  donorWallet: string,
): Promise<void> {
  await db
    .update(contributionsCache)
    .set({ refunded: 1 })
    .where(
      and(
        eq(contributionsCache.jarPda, jarPda),
        eq(contributionsCache.donorWallet, donorWallet),
      ),
    );
}
