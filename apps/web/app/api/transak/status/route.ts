import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { getDepositById } from "@/lib/db/transak";

export async function GET(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createDb(env.DB);
  const dep = await getDepositById(db, id);
  if (!dep) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: dep.id,
    status: dep.status,
    contributeSignature: dep.contributeSignature,
    error: dep.error,
    walletAddress: dep.ephemeralPubkey,
  });
}
