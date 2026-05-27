import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createRpc } from "@/lib/rpc";

interface AccountInfoResult {
  value: { data: unknown; lamports: number; owner: string } | null;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pda = url.searchParams.get("pda");
  if (!pda) {
    return NextResponse.json({ exists: false, error: "missing pda" }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const rpc = createRpc({
    HELIUS_RPC: env.HELIUS_RPC,
    PUBLIC_RPC: env.PUBLIC_RPC,
    HELIUS_API_KEY: env.HELIUS_API_KEY,
  });

  try {
    const info = await rpc.call<AccountInfoResult>("getAccountInfo", [
      pda,
      { encoding: "base64", commitment: "confirmed" },
    ]);
    const exists =
      !!info?.value && info.value.owner === env.PROGRAM_ID;
    return NextResponse.json(
      { exists },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { exists: false },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
