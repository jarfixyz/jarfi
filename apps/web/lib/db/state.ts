import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { indexerState } from "./schema";

const LAST_SIG_KEY = "last_processed_signature";
const LAST_SLOT_KEY = "last_processed_slot";

export async function getLastSignature(db: Db): Promise<string | null> {
  const row = await db
    .select()
    .from(indexerState)
    .where(eq(indexerState.key, LAST_SIG_KEY))
    .get();
  return row?.value ?? null;
}

export async function setLastSignature(db: Db, sig: string): Promise<void> {
  await db
    .insert(indexerState)
    .values({ key: LAST_SIG_KEY, value: sig })
    .onConflictDoUpdate({ target: indexerState.key, set: { value: sig } });
}

export async function setLastSlot(db: Db, slot: number): Promise<void> {
  await db
    .insert(indexerState)
    .values({ key: LAST_SLOT_KEY, value: String(slot) })
    .onConflictDoUpdate({
      target: indexerState.key,
      set: { value: String(slot) },
    });
}
