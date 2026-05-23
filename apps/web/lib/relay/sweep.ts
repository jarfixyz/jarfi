import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/lib/db/client";
import { selectFundedDeposits, setDepositStatus } from "@/lib/db/transak";
import { contributionsCache } from "@/lib/db/schema";
import { decryptSecret } from "./crypto";
import { loadTreasuryKeypair } from "./treasury";
import { relayContribute } from "./contribute";
import { USDC_MINT_DEVNET } from "@/lib/direct-indexer";

function rpcUrl(env: CloudflareEnv): string {
  const key = env.HELIUS_API_KEY;
  if (key) return env.HELIUS_RPC.replace("REPLACE_LOCAL_DEV", key);
  return env.PUBLIC_RPC;
}

async function recordDonorName(
  db: Db,
  jarPda: string,
  donorWallet: string,
  amount: string,
  donorName: string | null,
): Promise<void> {
  if (!donorName) return;
  const now = Math.floor(Date.now() / 1000);
  // Insert a placeholder row so the name persists. If the indexer later sees
  // the on-chain contribute event it will UPDATE (not INSERT), preserving the
  // donorName we set here.
  try {
    await db.insert(contributionsCache).values({
      jarPda,
      donorWallet,
      amount,
      firstAt: now,
      lastAt: now,
      refunded: 0,
      donorName,
    });
  } catch {
    await db
      .update(contributionsCache)
      .set({ donorName })
      .where(eq(contributionsCache.donorWallet, donorWallet));
  }
}

export interface SweepResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function sweepFundedDeposits(
  env: CloudflareEnv,
): Promise<SweepResult> {
  if (!env.RELAY_ENC_KEY || !env.RELAY_TREASURY_SECRET) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }
  const db = createDb(env.DB);
  const rows = await selectFundedDeposits(db, 10);
  if (rows.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  const treasury = loadTreasuryKeypair(env.RELAY_TREASURY_SECRET);
  const conn = new Connection(rpcUrl(env), "confirmed");

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const secret = await decryptSecret(
        row.ephemeralSecretCt,
        row.ephemeralSecretIv,
        env.RELAY_ENC_KEY,
      );
      const ephemeral = Keypair.fromSecretKey(secret);
      const sig = await relayContribute({
        connection: conn,
        treasury,
        ephemeral,
        jarPda: new PublicKey(row.jarPda),
        asset: row.asset as "sol" | "usdc",
        amountUiu: BigInt(row.amountUiu),
        usdcMint: new PublicKey(USDC_MINT_DEVNET),
      });
      await setDepositStatus(db, row.id, {
        status: "contributed",
        contributeSignature: sig,
        bumpAttempts: true,
      });
      await recordDonorName(
        db,
        row.jarPda,
        row.ephemeralPubkey,
        row.amountUiu,
        row.donorName ?? null,
      );
      succeeded += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const newAttempts = row.attempts + 1;
      await setDepositStatus(db, row.id, {
        status: newAttempts >= 5 ? "failed" : "funded",
        bumpAttempts: true,
        error: msg.slice(0, 500),
      });
      failed += 1;
    }
  }
  return { attempted: rows.length, succeeded, failed };
}
