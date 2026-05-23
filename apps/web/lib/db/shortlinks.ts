import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { shortLinks } from "./schema";

export async function createShortLink(
  db: Db,
  shortId: string,
  jarPda: string,
  ownerWallet: string,
): Promise<void> {
  await db.insert(shortLinks).values({
    shortId,
    jarPda,
    ownerWallet,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export async function getShortLinkByJar(db: Db, jarPda: string) {
  return db.select().from(shortLinks).where(eq(shortLinks.jarPda, jarPda)).get();
}

export async function getShortLinkById(db: Db, shortId: string) {
  return db.select().from(shortLinks).where(eq(shortLinks.shortId, shortId)).get();
}
