import { describe, it, expect, vi } from "vitest";
import { applyParsedEvent, type IndexerDeps } from "../lib/indexer";

describe("applyParsedEvent", () => {
  const baseTx = {
    signature: "sig1",
    slot: 100,
    blockTime: 1_700_000_000,
    logs: [],
    err: null,
  };

  function makeDeps(): { deps: IndexerDeps; calls: Record<string, unknown[]> } {
    const calls: Record<string, unknown[]> = {
      upsertJar: [],
      contributeDelta: [],
      markStatus: [],
      applyContribution: [],
      markRefunded: [],
      insertEvent: [],
      incrementJarTotal: [],
    };
    const deps: IndexerDeps = {
      upsertJar: async (j) => {
        calls.upsertJar.push(j);
      },
      applyContributeDelta: async (...a) => {
        calls.contributeDelta.push(a);
      },
      markJarStatus: async (...a) => {
        calls.markStatus.push(a);
      },
      applyContribution: async (...a) => {
        calls.applyContribution.push(a);
        return { isNew: true };
      },
      markRefunded: async (...a) => {
        calls.markRefunded.push(a);
      },
      insertEventIfNew: async (r) => {
        calls.insertEvent.push(r);
        return true;
      },
      incrementJarTotal: async (...a) => {
        calls.incrementJarTotal.push(a);
      },
    };
    return { deps, calls };
  }

  it("CreateJarEvent upserts jar and inserts event", async () => {
    const { deps, calls } = makeDeps();
    await applyParsedEvent(
      deps,
      {
        name: "createJarEvent",
        data: {
          jar: "JarPda111",
          owner: "OwnerWallet",
          jarType: 0,
          asset: 0,
          goalAmount: "1000000000",
          unlockTimestamp: "0",
          metadataUri: "ipfs://x",
          metadataHash: new Array(32).fill(0),
          createdAt: "1700000000",
        },
      },
      baseTx,
    );
    expect(calls.upsertJar).toHaveLength(1);
    expect(calls.insertEvent).toHaveLength(1);
  });

  it("ContributeEvent updates jar totals and contribution row", async () => {
    const { deps, calls } = makeDeps();
    await applyParsedEvent(
      deps,
      {
        name: "contributeEvent",
        data: {
          jar: "JarPda111",
          donor: "DonorWallet",
          amountDelta: "500000000",
          totalAfter: "500000000",
          contributorsAfter: 1,
          isFirst: true,
          ts: "1700000000",
        },
      },
      baseTx,
    );
    expect(calls.contributeDelta).toHaveLength(1);
    expect(calls.applyContribution).toHaveLength(1);
    expect(calls.insertEvent).toHaveLength(1);
  });

  it("RefundEvent marks contribution refunded", async () => {
    const { deps, calls } = makeDeps();
    await applyParsedEvent(
      deps,
      {
        name: "refundEvent",
        data: {
          jar: "JarPda111",
          donor: "DonorWallet",
          amount: "500000000",
          ts: "1700000000",
        },
      },
      baseTx,
    );
    expect(calls.markRefunded).toHaveLength(1);
    expect(calls.insertEvent).toHaveLength(1);
  });

  it("unknown event kind is a no-op", async () => {
    const { deps, calls } = makeDeps();
    await applyParsedEvent(
      deps,
      { name: "someUnknownEvent", data: {} },
      baseTx,
    );
    expect(calls.insertEvent).toHaveLength(0);
  });
});

import { applyDirectContribution } from "../lib/indexer";
import type { DirectTransfer } from "../lib/direct-indexer";

describe("applyDirectContribution", () => {
  function makeDirectDeps() {
    const calls: Record<string, unknown[]> = {
      insertEvent: [],
      applyContribution: [],
      incrementJarTotal: [],
    };
    let nextInserted = true;
    let nextIsNew = true;
    const deps = {
      insertEventIfNew: async (r: unknown) => {
        calls.insertEvent.push(r);
        return nextInserted;
      },
      applyContribution: async (...a: unknown[]) => {
        calls.applyContribution.push(a);
        return { isNew: nextIsNew };
      },
      incrementJarTotal: async (...a: unknown[]) => {
        calls.incrementJarTotal.push(a);
      },
    };
    return {
      deps,
      calls,
      setInserted: (v: boolean) => { nextInserted = v; },
      setIsNew: (v: boolean) => { nextIsNew = v; },
    };
  }

  const jar = { jarPda: "JarA", asset: "sol" as const, lastDirectSig: null };
  const transfer: DirectTransfer = { delta: 1_000_000_000n, donor: "DonorX" };

  it("inserts event, applies contribution, increments with new-donor on first", async () => {
    const { deps, calls } = makeDirectDeps();
    await applyDirectContribution(deps as never, jar, "sig1", transfer, 1_700_000_000, 100);
    expect(calls.insertEvent).toHaveLength(1);
    expect(calls.applyContribution).toHaveLength(1);
    expect(calls.incrementJarTotal).toEqual([["JarA", "1000000000", 1, 100]]);
  });

  it("passes 0 new-donors when isNew false", async () => {
    const h = makeDirectDeps();
    h.setIsNew(false);
    await applyDirectContribution(h.deps as never, jar, "sig2", transfer, 1_700_000_000, 101);
    expect(h.calls.incrementJarTotal).toEqual([["JarA", "1000000000", 0, 101]]);
  });

  it("skips everything when event dedup rejects", async () => {
    const h = makeDirectDeps();
    h.setInserted(false);
    await applyDirectContribution(h.deps as never, jar, "sig3", transfer, 1_700_000_000, 102);
    expect(h.calls.insertEvent).toHaveLength(1);
    expect(h.calls.applyContribution).toHaveLength(0);
    expect(h.calls.incrementJarTotal).toHaveLength(0);
  });
});
