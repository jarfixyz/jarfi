import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "../../lib/db/schema";
import { applyParsedEvent, type IndexerDeps, runIndexerOnce } from "../../lib/indexer";
import * as DirectIndexer from "../../lib/direct-indexer";
import {
  upsertJar,
  applyContributeDelta,
  markJarStatus,
  getJarByPda,
  selectActiveJars,
  setLastDirectSig,
  incrementJarTotal,
} from "../../lib/db/jars";
import { applyContribution, markRefunded } from "../../lib/db/contributions";
import { insertEventIfNew } from "../../lib/db/events";
import type { Db } from "../../lib/db/client";

const JAR = "Jar1111111111111111111111111111111111111111";
const OWNER = "Own1111111111111111111111111111111111111111";
const DONOR = "Don1111111111111111111111111111111111111111";

function makeDb(): Db {
  const sqlite = new Database(":memory:");
  const sql1 = readFileSync(
    resolve(__dirname, "../../migrations/0001_initial.sql"),
    "utf8",
  );
  const sql2 = readFileSync(
    resolve(__dirname, "../../migrations/0002_direct_cursor.sql"),
    "utf8",
  );
  sqlite.exec(sql1);
  sqlite.exec(sql2);
  return drizzle(sqlite, { schema }) as unknown as Db;
}

function baseTx(signature: string, slot: number) {
  return { signature, slot, blockTime: 1_700_000_000, logs: [], err: null };
}

function deps(db: Db): IndexerDeps {
  return {
    upsertJar: (j) => upsertJar(db, j),
    applyContributeDelta: (j, d, t, c, s) => applyContributeDelta(db, j, d, t, c, s),
    markJarStatus: (j, st, s) => markJarStatus(db, j, st, s),
    applyContribution: (j, d, dd, ts) => applyContribution(db, j, d, dd, ts),
    markRefunded: (j, d) => markRefunded(db, j, d),
    insertEventIfNew: (r) => insertEventIfNew(db, r),
    incrementJarTotal: (j, delta, newDonors, slot) => incrementJarTotal(db, j, delta, newDonors, slot),
  };
}

describe("full indexer integration (in-memory D1)", () => {
  it("create -> contribute x2 -> withdraw materializes correctly", async () => {
    const db = makeDb();
    const d = deps(db);

    await applyParsedEvent(d, {
      name: "createJarEvent",
      data: {
        jar: JAR,
        owner: OWNER,
        jarType: 0,
        asset: 0,
        goalAmount: "3000000000",
        unlockTimestamp: "0",
        metadataUri: "ipfs://x",
        metadataHash: new Array(32).fill(0),
        createdAt: "1700000000",
      },
    }, baseTx("sig-create", 100));

    await applyParsedEvent(d, {
      name: "contributeEvent",
      data: {
        jar: JAR,
        donor: DONOR,
        amountDelta: "1000000000",
        totalAfter: "1000000000",
        contributorsAfter: 1,
        isFirst: true,
        ts: "1700000001",
      },
    }, baseTx("sig-c1", 101));

    await applyParsedEvent(d, {
      name: "contributeEvent",
      data: {
        jar: JAR,
        donor: DONOR,
        amountDelta: "2000000000",
        totalAfter: "3000000000",
        contributorsAfter: 1,
        isFirst: false,
        ts: "1700000002",
      },
    }, baseTx("sig-c2", 102));

    await applyParsedEvent(d, {
      name: "withdrawEvent",
      data: { jar: JAR, owner: OWNER, amount: "2925000000", fee: "75000000", ts: "1700000003" },
    }, baseTx("sig-w", 103));

    const jar = await getJarByPda(db, JAR);
    expect(jar).toBeTruthy();
    expect(jar!.totalContributed).toBe("3000000000");
    expect(jar!.totalContributors).toBe(1);
    expect(jar!.status).toBe("withdrawn");
  });

  it("dedupes duplicate signature+kind", async () => {
    const db = makeDb();
    const d = deps(db);
    const ev = {
      name: "createJarEvent",
      data: {
        jar: JAR,
        owner: OWNER,
        jarType: 0,
        asset: 0,
        goalAmount: "1",
        unlockTimestamp: "0",
        metadataUri: "ipfs://x",
        metadataHash: new Array(32).fill(0),
        createdAt: "1",
      },
    } as const;
    await applyParsedEvent(d, ev, baseTx("sig-dup", 1));
    await applyParsedEvent(d, ev, baseTx("sig-dup", 1));
    const jar = await getJarByPda(db, JAR);
    expect(jar).toBeTruthy();
  });

  it("applyContribution reports isNew on first deposit, false on subsequent", async () => {
    const db = makeDb();
    const first = await applyContribution(db, JAR, DONOR, "100", 1_700_000_000);
    const second = await applyContribution(db, JAR, DONOR, "200", 1_700_000_100);
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
  });
});

describe("jars db helpers for direct-phase", () => {
  it("selectActiveJars returns only active jars with pda+asset+cursor", async () => {
    const db = makeDb();
    await upsertJar(db, {
      jarPda: "JarA111",
      jarType: "flexible",
      asset: "sol",
      ownerWallet: "own1",
      goalAmount: "1000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    await upsertJar(db, {
      jarPda: "JarB222",
      jarType: "flexible",
      asset: "usdc",
      ownerWallet: "own2",
      goalAmount: "1000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "withdrawn",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    const active = await selectActiveJars(db);
    expect(active.map((j) => j.jarPda)).toEqual(["JarA111"]);
    expect(active[0].asset).toBe("sol");
    expect(active[0].lastDirectSig).toBeNull();
  });

  it("setLastDirectSig updates cursor", async () => {
    const db = makeDb();
    await upsertJar(db, {
      jarPda: "JarA111",
      jarType: "flexible",
      asset: "sol",
      ownerWallet: "own1",
      goalAmount: "1000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    await setLastDirectSig(db, "JarA111", "sigXYZ");
    const active = await selectActiveJars(db);
    expect(active[0].lastDirectSig).toBe("sigXYZ");
  });

  it("incrementJarTotal adds delta and new-donor count", async () => {
    const db = makeDb();
    await upsertJar(db, {
      jarPda: "JarA111",
      jarType: "flexible",
      asset: "sol",
      ownerWallet: "own1",
      goalAmount: "1000",
      unlockTimestamp: null,
      totalContributed: "500",
      totalContributors: 1,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    await incrementJarTotal(db, "JarA111", "250", 1, 10);
    const jar = await getJarByPda(db, "JarA111");
    expect(jar!.totalContributed).toBe("750");
    expect(jar!.totalContributors).toBe(2);
    expect(jar!.lastOnchainSlot).toBe(10);
  });

  it("incrementJarTotal does not lower lastOnchainSlot", async () => {
    const db = makeDb();
    await upsertJar(db, {
      jarPda: "JarA111",
      jarType: "flexible",
      asset: "sol",
      ownerWallet: "own1",
      goalAmount: "1000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 100,
    });
    await incrementJarTotal(db, "JarA111", "100", 1, 50);
    const jar = await getJarByPda(db, "JarA111");
    expect(jar!.lastOnchainSlot).toBe(100);
  });
});

describe("runIndexerOnce phase 2 (direct transfers)", () => {
  it("applies direct SOL transfer via per-jar scan, dedups program sig, is idempotent", async () => {
    const db = makeDb();
    const DIRECT_SIG = "sig-direct-1";
    const PROGRAM_SIG = "sig-program-1";

    await upsertJar(db, {
      jarPda: JAR,
      jarType: "flexible",
      asset: "sol",
      ownerWallet: OWNER,
      goalAmount: "5000000000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    await setLastDirectSig(db, JAR, "cursor-sentinel");

    const programSigs = [
      { signature: PROGRAM_SIG, slot: 10, blockTime: 1_700_000_010, err: null },
    ];
    const directSigs = [
      { signature: DIRECT_SIG, slot: 11, blockTime: 1_700_000_020, err: null },
      { signature: PROGRAM_SIG, slot: 10, blockTime: 1_700_000_010, err: null },
    ];

    const rpc = {
      call: vi.fn().mockImplementation(async (method: string, params: unknown[]) => {
        if (method === "getSignaturesForAddress") {
          const [addr] = params as [string, unknown];
          if (addr === "ProgramId") return programSigs;
          if (addr === JAR) return directSigs;
          return [];
        }
        if (method === "getTransaction") {
          const [sig] = params as [string];
          if (sig === PROGRAM_SIG) return null;
          if (sig === DIRECT_SIG) return {
            slot: 11,
            blockTime: 1_700_000_020,
            meta: {
              err: null,
              preBalances: [10_000_000_000, 1_000_000, 1],
              postBalances: [9_000_000_000, 1_001_000_000, 1],
              preTokenBalances: [],
              postTokenBalances: [],
              innerInstructions: [],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: DONOR }, { pubkey: JAR }, { pubkey: "11111111111111111111111111111111" }],
                instructions: [
                  {
                    programId: "11111111111111111111111111111111",
                    accounts: [DONOR, JAR],
                    parsed: {
                      type: "transfer",
                      info: { source: DONOR, destination: JAR, lamports: 1_000_000_000 },
                    },
                  },
                ],
              },
            },
          };
          return null;
        }
        return null;
      }),
    };

    await runIndexerOnce(db, rpc as never, "ProgramId");

    const jarRow = await getJarByPda(db, JAR);
    expect(jarRow!.totalContributed).toBe("1000000000");
    expect(jarRow!.totalContributors).toBe(1);
    expect(jarRow!.lastDirectSig).toBe(DIRECT_SIG);

    await runIndexerOnce(db, rpc as never, "ProgramId");
    const jarRow2 = await getJarByPda(db, JAR);
    expect(jarRow2!.totalContributed).toBe("1000000000");
    expect(jarRow2!.totalContributors).toBe(1);
  });

  it("applies direct USDC transfer via ATA scan", async () => {
    const db = makeDb();
    const USDC_JAR = JAR;
    const USDC_ATA = "ASqLTmAcRY2vsti2z3vtdZpkqLenSeFAUPGQTYufgr1B";
    const SIG = "sig-usdc-1";
    await upsertJar(db, {
      jarPda: USDC_JAR,
      jarType: "flexible",
      asset: "usdc",
      ownerWallet: OWNER,
      goalAmount: "100000000",
      unlockTimestamp: null,
      totalContributed: "0",
      totalContributors: 0,
      status: "active",
      metadataUri: "",
      metadataHash: "[]",
      lastOnchainSlot: 1,
    });
    await setLastDirectSig(db, USDC_JAR, "cursor-sentinel");

    const rpc = {
      call: vi.fn().mockImplementation(async (method: string, params: unknown[]) => {
        if (method === "getSignaturesForAddress") {
          const [addr] = params as [string, unknown];
          if (addr === "ProgramId") return [];
          if (addr === USDC_ATA) {
            return [{ signature: SIG, slot: 20, blockTime: 1_700_000_030, err: null }];
          }
          return [];
        }
        if (method === "getTransaction") {
          return {
            slot: 20,
            blockTime: 1_700_000_030,
            meta: {
              err: null,
              preBalances: [0, 0, 0],
              postBalances: [0, 0, 0],
              preTokenBalances: [
                { accountIndex: 1, mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", owner: DONOR, uiTokenAmount: { amount: "50000000" } },
              ],
              postTokenBalances: [
                { accountIndex: 1, mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", owner: DONOR, uiTokenAmount: { amount: "40000000" } },
                { accountIndex: 2, mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", owner: USDC_JAR, uiTokenAmount: { amount: "10000000" } },
              ],
              innerInstructions: [],
            },
            transaction: {
              message: {
                accountKeys: [
                  { pubkey: DONOR },
                  { pubkey: "DonorAta1111111111111111111111111111111111" },
                  { pubkey: USDC_ATA },
                ],
                instructions: [
                  {
                    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    accounts: ["DonorAta1111111111111111111111111111111111", USDC_ATA, DONOR],
                    parsed: {
                      type: "transfer",
                      info: { source: "DonorAta1111111111111111111111111111111111", destination: USDC_ATA, amount: "10000000" },
                    },
                  },
                ],
              },
            },
          };
        }
        return null;
      }),
    };

    // Mock getUsdcAta to avoid the PDA nonce error in tests
    vi.spyOn(DirectIndexer, "getUsdcAta").mockReturnValue(USDC_ATA);

    await runIndexerOnce(db, rpc as never, "ProgramId");

    const jar = await getJarByPda(db, USDC_JAR);
    expect(jar!.totalContributed).toBe("10000000");
    expect(jar!.totalContributors).toBe(1);
    expect(jar!.lastDirectSig).toBe(SIG);
  });
});
