import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../lib/kv/rate-limit";

function memoryKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string, _opts?: unknown) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
}

describe("checkRateLimit", () => {
  it("allows up to the limit and then blocks", async () => {
    const kv = memoryKv();
    for (let i = 0; i < 3; i++) {
      const ok = await checkRateLimit(kv as never, "1.2.3.4", 3, 60);
      expect(ok).toBe(true);
    }
    const blocked = await checkRateLimit(kv as never, "1.2.3.4", 3, 60);
    expect(blocked).toBe(false);
  });

  it("isolates buckets per key", async () => {
    const kv = memoryKv();
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(kv as never, "1.1.1.1", 3, 60);
    }
    const otherOk = await checkRateLimit(kv as never, "9.9.9.9", 3, 60);
    expect(otherOk).toBe(true);
  });
});
