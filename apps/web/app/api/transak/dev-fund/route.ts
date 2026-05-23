import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { createDb } from "@/lib/db/client";
import { getDepositById, setDepositStatus } from "@/lib/db/transak";
import { loadTreasuryKeypair } from "@/lib/relay/treasury";
import { USDC_MINT_DEVNET } from "@/lib/direct-indexer";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function rpcUrl(env: CloudflareEnv): string {
  const key = env.HELIUS_API_KEY;
  if (key) return env.HELIUS_RPC.replace("REPLACE_LOCAL_DEV", key);
  return env.PUBLIC_RPC;
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET ?? ""}`;
  if (!env.CRON_SECRET || !timingSafeEqual(auth, expected)) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createDb(env.DB);
  const dep = await getDepositById(db, id);
  if (!dep) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (dep.status !== "pending") {
    return NextResponse.json({ ok: true, status: dep.status });
  }

  const treasury = loadTreasuryKeypair(env.RELAY_TREASURY_SECRET);
  const conn = new Connection(rpcUrl(env), "confirmed");
  const ephemeral = new PublicKey(dep.ephemeralPubkey);
  const amount = BigInt(dep.amountUiu);

  if (dep.asset === "sol") {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: ephemeral,
        lamports: Number(amount),
      }),
    );
    await sendAndConfirmTransaction(conn, tx, [treasury]);
  } else {
    const mint = new PublicKey(USDC_MINT_DEVNET);
    const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey);
    const donorAta = getAssociatedTokenAddressSync(mint, ephemeral);

    const tx = new Transaction();
    const donorAtaInfo = await conn
      .getAccountInfo(donorAta, "confirmed")
      .catch(() => null);
    if (!donorAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          treasury.publicKey,
          donorAta,
          ephemeral,
          mint,
        ),
      );
    }
    // Sanity-check treasury ATA exists.
    await getAccount(conn, treasuryAta, "confirmed");
    tx.add(
      createTransferInstruction(
        treasuryAta,
        donorAta,
        treasury.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    await sendAndConfirmTransaction(conn, tx, [treasury]);
  }

  await setDepositStatus(db, id, {
    status: "funded",
    transakOrderId: dep.transakOrderId ?? `dev-mock-${id}`,
  });

  return NextResponse.json({ ok: true });
}
