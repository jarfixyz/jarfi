import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Keypair } from "@solana/web3.js";
import { nanoid } from "nanoid";
import { createDb } from "@/lib/db/client";
import { fetchJarByPda, fetchJarByShortId } from "@/lib/jar-fetch";
import { encryptSecret } from "@/lib/relay/crypto";
import { insertDeposit } from "@/lib/db/transak";
import { createTransakWidgetUrl } from "@/lib/relay/transak";

const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  if (!env.RELAY_ENC_KEY) {
    return NextResponse.json(
      { error: "relay not configured" },
      { status: 500 },
    );
  }

  let body: {
    shortId?: string;
    jarPda?: string;
    asset?: string;
    amountUi?: number;
    donorName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const shortId = body.shortId?.trim() || null;
  const jarPda = body.jarPda?.trim() || null;
  const asset = body.asset === "usdc" ? "usdc" : body.asset === "sol" ? "sol" : null;
  const amountUi = Number(body.amountUi);
  const donorName = body.donorName?.trim().slice(0, 40) || null;

  if (!shortId && !jarPda) {
    return NextResponse.json(
      { error: "shortId or jarPda required" },
      { status: 400 },
    );
  }
  if (!asset) {
    return NextResponse.json({ error: "asset required" }, { status: 400 });
  }
  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

  const jar = shortId
    ? await fetchJarByShortId(shortId)
    : await fetchJarByPda(jarPda!);
  if (!jar) {
    return NextResponse.json({ error: "jar not found" }, { status: 404 });
  }
  if (jar.status !== "active") {
    return NextResponse.json({ error: "jar not active" }, { status: 409 });
  }
  if (jar.asset !== asset) {
    return NextResponse.json(
      { error: `jar asset is ${jar.asset}` },
      { status: 400 },
    );
  }

  const decimals = asset === "sol" ? SOL_DECIMALS : USDC_DECIMALS;
  const amountUiu = BigInt(Math.round(amountUi * 10 ** decimals));

  const ephemeral = Keypair.generate();
  const enc = await encryptSecret(ephemeral.secretKey, env.RELAY_ENC_KEY);

  const id = nanoid(16);
  const db = createDb(env.DB);
  await insertDeposit(db, {
    id,
    jarPda: jar.pda,
    shortId,
    asset,
    amountUiu: amountUiu.toString(),
    donorName,
    ephemeralPubkey: ephemeral.publicKey.toBase58(),
    ephemeralSecretCt: enc.ct,
    ephemeralSecretIv: enc.iv,
  });

  let widgetUrl: string | null = null;
  let widgetError: string | null = null;
  try {
    const referrerDomain = new URL(request.url).host;
    widgetUrl = await createTransakWidgetUrl(env, {
      asset,
      walletAddress: ephemeral.publicKey.toBase58(),
      defaultCryptoAmount: amountUi,
      partnerOrderId: id,
      referrerDomain,
    });
  } catch (e) {
    widgetError = e instanceof Error ? e.message : "transak unavailable";
  }

  return NextResponse.json({
    depositId: id,
    walletAddress: ephemeral.publicKey.toBase58(),
    widgetUrl,
    widgetError,
  });
}
