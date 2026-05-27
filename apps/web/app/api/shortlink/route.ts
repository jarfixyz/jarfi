import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { createRpc } from "@/lib/rpc";
import { checkRateLimit } from "@/lib/kv/rate-limit";
import { generateShortId, randomSuffix, slugifyTitle } from "@/lib/shortid";
import {
  createShortLink,
  getShortLinkByJar,
  getShortLinkById,
} from "@/lib/db/shortlinks";


interface Body {
  jarPda: string;
  signature: string;
  title?: string;
}

async function allocateSlug(
  db: ReturnType<typeof createDb>,
  title: string | undefined,
): Promise<string> {
  const base = title ? slugifyTitle(title) : "jar";
  // Try the bare slug first.
  const taken = await getShortLinkById(db, base);
  if (!taken) return base;
  // Then base-NNN, with up to 6 attempts before falling back to a random id.
  for (let i = 0; i < 6; i++) {
    const candidate = `${base}-${randomSuffix()}`;
    const exists = await getShortLinkById(db, candidate);
    if (!exists) return candidate;
  }
  return generateShortId();
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";

  const allowed = await checkRateLimit(env.KV, `shortlink:${ip}`, 10, 60);
  if (!allowed) {
    return new Response("rate limited", { status: 429 });
  }

  const body = (await request.json()) as Body;
  if (!body?.jarPda || !body?.signature) {
    return new Response("missing fields", { status: 400 });
  }

  const db = createDb(env.DB);
  const existing = await getShortLinkByJar(db, body.jarPda);
  if (existing) {
    return NextResponse.json({ shortId: existing.shortId });
  }

  const rpc = createRpc({
    HELIUS_RPC: env.HELIUS_RPC,
    PUBLIC_RPC: env.PUBLIC_RPC,
    HELIUS_API_KEY: env.HELIUS_API_KEY,
  });
  const tx = await rpc.call<{
    meta: { err: unknown; logMessages: string[] | null } | null;
    transaction: {
      message: { accountKeys: string[] };
    };
  } | null>("getTransaction", [
    body.signature,
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  ]);

  if (!tx || tx.meta?.err) {
    return new Response("tx not found or failed", { status: 400 });
  }

  const accountKeys = tx.transaction?.message?.accountKeys ?? [];
  if (!accountKeys.includes(env.PROGRAM_ID)) {
    return new Response("tx does not target jarfi program", { status: 400 });
  }
  if (!accountKeys.includes(body.jarPda)) {
    return new Response("tx does not reference jar", { status: 400 });
  }

  const logs = tx.meta?.logMessages ?? [];
  const hasCreateJar = logs.some((l) => l.includes("Instruction: CreateJar"));
  if (!hasCreateJar) {
    return new Response("signature is not a CreateJar tx", { status: 400 });
  }

  const shortId = await allocateSlug(db, body.title);
  await createShortLink(db, shortId, body.jarPda, "unknown");

  return NextResponse.json({ shortId });
}
