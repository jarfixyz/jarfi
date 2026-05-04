import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";
    const rawBody = await req.text();

    const forwardHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    const sig = req.headers.get("moonpay-signature-1");
    if (sig) forwardHeaders["moonpay-signature-1"] = sig;

    const resp = await fetch(`${backendUrl}/moonpay-webhook`, {
      method: "POST",
      headers: forwardHeaders,
      body: rawBody,
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error("[moonpay-webhook] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "MoonPay webhook — POST only" });
}
