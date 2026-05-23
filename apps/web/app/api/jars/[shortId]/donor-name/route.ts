import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublicKey } from "@solana/web3.js";
import { createDb } from "@/lib/db/client";
import { getShortLinkById } from "@/lib/db/shortlinks";
import { getJarByPda } from "@/lib/db/jars";
import { setDonorName } from "@/lib/db/contributions";
import {
  buildDonorNameChallenge,
  verifyWalletSignature,
} from "@/lib/signatures";
import { claimNonce } from "@/lib/kv/idempotency";

interface Params {
  params: Promise<{ shortId: string }>;
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { shortId } = await params;
  const body = (await req.json().catch(() => null)) as {
    donorWallet?: string;
    name?: string;
    signature?: string;
    nonce?: string;
  } | null;
  if (
    !body ||
    typeof body.donorWallet !== "string" ||
    typeof body.signature !== "string" ||
    typeof body.nonce !== "string"
  ) {
    return new Response("bad request", { status: 400 });
  }

  try {
    new PublicKey(body.donorWallet);
  } catch {
    return new Response("invalid pubkey", { status: 400 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";

  const { env } = getCloudflareContext();
  const db = createDb(env.DB);

  const link = await getShortLinkById(db, shortId);
  let jarPda = link?.jarPda ?? null;
  if (!jarPda) {
    const viaPda = await getJarByPda(db, shortId);
    if (viaPda) jarPda = viaPda.jarPda;
  }
  if (!jarPda) return new Response("not found", { status: 404 });

  const challenge = buildDonorNameChallenge(
    jarPda,
    body.donorWallet,
    name,
    body.nonce,
  );
  if (!verifyWalletSignature(challenge, body.signature, body.donorWallet)) {
    return new Response("invalid signature", { status: 401 });
  }

  const nonceOk = await claimNonce(env.KV, `donor-name:${body.nonce}`);
  if (!nonceOk) return new Response("nonce reused", { status: 409 });

  await setDonorName(db, jarPda, body.donorWallet, name || null);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
