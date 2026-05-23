import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreakerRpc } from "../lib/rpc";

type Call = { url: string; ok: boolean };

function makeFetcher(plan: Call[]): typeof fetch {
  let i = 0;
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const call = plan[i++];
    if (!call) throw new Error("ran out of planned calls");
    if (call.url !== "*" && !url.includes(call.url)) {
      throw new Error(`expected ${call.url}, got ${url}`);
    }
    if (call.ok) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }), {
        status: 200,
      });
    }
    return new Response("boom", { status: 500 });
  }) as typeof fetch;
}

describe("CircuitBreakerRpc", () => {
  const primary = "https://primary.example";
  const fallback = "https://fallback.example";

  it("uses primary when healthy", async () => {
    const fetcher = makeFetcher([{ url: primary, ok: true }]);
    const rpc = new CircuitBreakerRpc(primary, fallback, { fetcher, nowMs: () => 0 });
    await rpc.call("getSlot", []);
    expect(rpc.state()).toEqual({ open: false, consecutiveErrors: 0 });
  });

  it("opens circuit after 5 consecutive primary errors and switches to fallback", async () => {
    const fetcher = makeFetcher([
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: fallback, ok: true },
    ]);
    const rpc = new CircuitBreakerRpc(primary, fallback, { fetcher, nowMs: () => 0 });
    for (let i = 0; i < 5; i++) {
      await expect(rpc.call("getSlot", [])).rejects.toThrow();
    }
    const result = await rpc.call("getSlot", []);
    expect(result).toBe("ok");
    expect(rpc.state().open).toBe(true);
  });

  it("retries primary after 60 seconds", async () => {
    const fetcher = makeFetcher([
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: primary, ok: false },
      { url: fallback, ok: true },
      { url: primary, ok: true },
    ]);
    let now = 0;
    const rpc = new CircuitBreakerRpc(primary, fallback, { fetcher, nowMs: () => now });
    for (let i = 0; i < 5; i++) {
      await expect(rpc.call("getSlot", [])).rejects.toThrow();
    }
    await rpc.call("getSlot", []);
    now = 60_001;
    const result = await rpc.call("getSlot", []);
    expect(result).toBe("ok");
  });
});
