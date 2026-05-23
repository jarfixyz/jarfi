import type { Db } from "./client";
import { events } from "./schema";

export interface EventRow {
  jarPda: string;
  kind: string;
  actorWallet: string;
  amount: string | null;
  metadataJson: string | null;
  signature: string;
  slot: number;
  blockTime: number;
}

export async function insertEventIfNew(db: Db, row: EventRow): Promise<boolean> {
  try {
    await db.insert(events).values(row);
    return true;
  } catch (e) {
    const msg = String(e);
    if (msg.includes("UNIQUE") || msg.includes("constraint")) {
      return false;
    }
    throw e;
  }
}
