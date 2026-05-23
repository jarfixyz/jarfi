import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const CACHE_KEY = "marinade:msol_rate";
const TTL_S = 60; // 1 minute

export async function GET() {
  const { env } = getCloudflareContext();
  const cached = await env.KV.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json({ rate: Number(cached), cached: true });
  }
  const res = await fetch("https://api.marinade.finance/msol/price_sol");
  if (!res.ok) {
    return NextResponse.json(
      { error: "marinade api failed", status: res.status },
      { status: 502 },
    );
  }
  const raw = (await res.text()).trim();
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2.0) {
    return NextResponse.json({ error: "invalid rate", raw }, { status: 502 });
  }
  await env.KV.put(CACHE_KEY, String(rate), { expirationTtl: TTL_S });
  return NextResponse.json({ rate, cached: false });
}
