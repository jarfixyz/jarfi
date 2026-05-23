import { and, eq, lt } from "drizzle-orm";
import type { Db } from "./client";
import { transakDeposits } from "./schema";

export type DepositStatus =
  | "pending"
  | "funded"
  | "contributed"
  | "failed";

export interface InsertDeposit {
  id: string;
  jarPda: string;
  shortId: string | null;
  asset: "sol" | "usdc";
  amountUiu: string;
  donorName: string | null;
  ephemeralPubkey: string;
  ephemeralSecretCt: string;
  ephemeralSecretIv: string;
}

export async function insertDeposit(db: Db, d: InsertDeposit): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(transakDeposits).values({
    ...d,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getDepositById(db: Db, id: string) {
  return db
    .select()
    .from(transakDeposits)
    .where(eq(transakDeposits.id, id))
    .get();
}

export async function setDepositStatus(
  db: Db,
  id: string,
  patch: {
    status?: DepositStatus;
    transakOrderId?: string | null;
    contributeSignature?: string | null;
    error?: string | null;
    bumpAttempts?: boolean;
  },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await getDepositById(db, id);
  if (!existing) return;
  await db
    .update(transakDeposits)
    .set({
      status: patch.status ?? existing.status,
      transakOrderId:
        patch.transakOrderId !== undefined
          ? patch.transakOrderId
          : existing.transakOrderId,
      contributeSignature:
        patch.contributeSignature !== undefined
          ? patch.contributeSignature
          : existing.contributeSignature,
      error: patch.error !== undefined ? patch.error : existing.error,
      attempts: patch.bumpAttempts ? existing.attempts + 1 : existing.attempts,
      updatedAt: now,
    })
    .where(eq(transakDeposits.id, id));
}

export async function selectFundedDeposits(db: Db, max = 20) {
  return db
    .select()
    .from(transakDeposits)
    .where(
      and(
        eq(transakDeposits.status, "funded"),
        lt(transakDeposits.attempts, 5),
      ),
    )
    .limit(max)
    .all();
}
