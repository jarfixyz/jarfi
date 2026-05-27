import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { createRpc } from "@/lib/rpc";
import { runIndexerOnce } from "@/lib/indexer";
import { sweepFundedDeposits } from "@/lib/relay/sweep";


function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  if (!env.CRON_SECRET) {
    return new Response("cron secret not configured", { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!timingSafeEqual(auth, expected)) {
    return new Response("unauthorized", { status: 401 });
  }

  const db = createDb(env.DB);
  const rpc = createRpc({
    HELIUS_RPC: env.HELIUS_RPC,
    PUBLIC_RPC: env.PUBLIC_RPC,
    HELIUS_API_KEY: env.HELIUS_API_KEY,
  });
  const result = await runIndexerOnce(db, rpc, env.PROGRAM_ID);
  const sweep = await sweepFundedDeposits(env).catch((e) => ({
    attempted: 0,
    succeeded: 0,
    failed: 0,
    error: e instanceof Error ? e.message : String(e),
  }));
  return NextResponse.json({ ok: true, indexer: result, transak: sweep });
}
