import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db/client";
import { getDepositById, setDepositStatus } from "@/lib/db/transak";

interface TransakOrder {
  id?: string;
  partnerOrderId?: string;
  status?: string;
  walletAddress?: string;
  cryptoAmount?: number;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHs256Jwt(
  jwt: string,
  secret: string,
): Promise<unknown | null> {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = b64urlToBytes(sigB64);
  const sigBuf = new ArrayBuffer(sigBytes.byteLength);
  new Uint8Array(sigBuf).set(sigBytes);
  const dataBuf = new ArrayBuffer(data.byteLength);
  new Uint8Array(dataBuf).set(data);
  const ok = await crypto.subtle.verify("HMAC", key, sigBuf, dataBuf);
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const raw = await request.text();
  let outer: { data?: string; webhookData?: { data?: string } };
  try {
    outer = JSON.parse(raw) as typeof outer;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const jwt = outer.data ?? outer.webhookData?.data;
  if (!jwt || typeof jwt !== "string") {
    return NextResponse.json(
      { ok: false, error: "no signed data" },
      { status: 400 },
    );
  }

  const secret = env.TRANSAK_WEBHOOK_SECRET;
  let payload: unknown = null;
  if (secret) {
    payload = await verifyHs256Jwt(jwt, secret);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "bad signature" },
        { status: 401 },
      );
    }
  } else {
    // Devnet fallback: accept unsigned for local testing.
    try {
      const parts = jwt.split(".");
      const decoded = parts.length === 3 ? parts[1] : jwt;
      payload = JSON.parse(
        new TextDecoder().decode(b64urlToBytes(decoded)),
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "cannot decode" },
        { status: 400 },
      );
    }
  }

  const order =
    ((payload as { webhookData?: TransakOrder }).webhookData ??
      (payload as TransakOrder)) || {};
  const partnerOrderId = order.partnerOrderId;
  const status = order.status?.toUpperCase();

  if (!partnerOrderId) {
    return NextResponse.json({ ok: true, ignored: "no partnerOrderId" });
  }

  const db = createDb(env.DB);
  const dep = await getDepositById(db, partnerOrderId);
  if (!dep) {
    return NextResponse.json({ ok: true, ignored: "unknown deposit" });
  }

  if (status === "ORDER_COMPLETED" || status === "COMPLETED") {
    await setDepositStatus(db, dep.id, {
      status: dep.status === "contributed" ? "contributed" : "funded",
      transakOrderId: order.id ?? dep.transakOrderId ?? null,
    });
  } else if (status === "ORDER_FAILED" || status === "FAILED") {
    await setDepositStatus(db, dep.id, {
      status: "failed",
      transakOrderId: order.id ?? dep.transakOrderId ?? null,
      error: "transak reported failure",
    });
  } else {
    await setDepositStatus(db, dep.id, {
      transakOrderId: order.id ?? dep.transakOrderId ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
