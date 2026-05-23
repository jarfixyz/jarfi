import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { deriveJarPda } from "@jarfi/sdk";
import { buildChallenge, verifyWalletSignature } from "@/lib/signatures";
import { putMetadataJson, putCover } from "@/lib/r2/upload";
import { claimNonce } from "@/lib/kv/idempotency";
import { parseCoverUrl } from "./cover-url";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function PUT(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();

  const form = await request.formData();
  const jarPda = String(form.get("jarPda") ?? "");
  const wallet = String(form.get("wallet") ?? "");
  const signature = String(form.get("signature") ?? "");
  const nonce = String(form.get("nonce") ?? "");
  const jarCountRaw = String(form.get("jarCount") ?? "");
  const metadataField = form.get("metadata");
  const coverField = form.get("cover");

  if (
    !jarPda ||
    !wallet ||
    !signature ||
    !nonce ||
    !jarCountRaw ||
    !metadataField
  ) {
    return new Response("missing fields", { status: 400 });
  }
  if (typeof metadataField !== "string") {
    return new Response("metadata must be json string", { status: 400 });
  }

  const jarCount = Number(jarCountRaw);
  if (!Number.isInteger(jarCount) || jarCount < 0) {
    return new Response("invalid jarCount", { status: 400 });
  }

  let walletPk: PublicKey;
  let jarPk: PublicKey;
  let programPk: PublicKey;
  try {
    walletPk = new PublicKey(wallet);
    jarPk = new PublicKey(jarPda);
    programPk = new PublicKey(env.PROGRAM_ID);
  } catch {
    return new Response("invalid pubkey", { status: 400 });
  }

  // Derive the jar PDA from (wallet, jarCount). The on-chain program's seeds
  // guarantee that only `wallet` can ever create a Jar account at this PDA, so
  // if the derivation matches, `wallet` is the rightful owner regardless of
  // whether the jar has been created on-chain yet.
  const [expectedPda] = deriveJarPda(walletPk, new BN(jarCount), programPk);
  if (!expectedPda.equals(jarPk)) {
    return new Response("jarPda does not belong to wallet", { status: 403 });
  }

  const metadataBytes = new TextEncoder().encode(metadataField);
  const contentHash = await sha256Hex(metadataBytes.buffer as ArrayBuffer);
  const challenge = buildChallenge(jarPda, contentHash, jarCount);
  if (!verifyWalletSignature(challenge, signature, wallet)) {
    return new Response("invalid signature", { status: 401 });
  }

  const nonceOk = await claimNonce(env.KV, nonce);
  if (!nonceOk) return new Response("nonce reused", { status: 409 });

  let metadataJson: { coverUrl?: unknown } & Record<string, unknown>;
  try {
    metadataJson = JSON.parse(metadataField);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let coverResult: { key: string; size: number } | null = null;
  if (coverField && coverField instanceof File) {
    const parsed = parseCoverUrl(metadataJson.coverUrl);
    if (!parsed) {
      return new Response("coverUrl missing or malformed", { status: 400 });
    }
    if (parsed.jarPda !== jarPda) {
      return new Response("coverUrl pda mismatch", { status: 400 });
    }
    const expectedType = parsed.ext === "webp" ? "image/webp" : "image/jpeg";
    if (coverField.type !== expectedType) {
      return new Response("cover content-type mismatch", { status: 400 });
    }
    const buf = await coverField.arrayBuffer();
    if (buf.byteLength > 2 * 1024 * 1024) {
      return new Response("cover too large", { status: 400 });
    }
    const fullHash = await sha256Hex(buf);
    if (fullHash.slice(0, 16) !== parsed.hash16) {
      return new Response("cover hash mismatch", { status: 400 });
    }
    coverResult = await putCover(
      env.METADATA_BUCKET,
      jarPda,
      parsed.hash16,
      buf,
      coverField.type,
    );
  }

  const metaResult = await putMetadataJson(
    env.METADATA_BUCKET,
    jarPda,
    metadataJson,
  );

  const metadataUri = new URL(
    `/api/metadata/${jarPda}.json`,
    request.url,
  ).toString();

  return NextResponse.json({
    metadataUri,
    metadata: metaResult,
    cover: coverResult,
    contentHash,
  });
}
