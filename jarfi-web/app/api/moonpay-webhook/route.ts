import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// ---------------------------------------------------------------------------
// MoonPay webhook handler — PLACEHOLDER
// ---------------------------------------------------------------------------
// In Stage 2 this will:
//   1. Verify MoonPay signature
//   2. Parse the settled transaction
//   3. Call `gift_deposit` on the JAR Anchor program with contributor comment
//   4. Trigger push notification to jar owner
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("[moonpay-webhook] received:", payload);

    // TODO: verify signature
    // TODO: extract { jarSlug, amount, message } from metadata
    // TODO: call program.methods.giftDeposit(...).rpc()

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[moonpay-webhook] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "MoonPay webhook endpoint — POST only",
  });
}
