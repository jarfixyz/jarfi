import { describe, it, expect, vi } from "vitest";
import { fetchTransactionFull } from "../lib/helius";
import type { CircuitBreakerRpc } from "../lib/rpc";

function rpcReturning(value: unknown): CircuitBreakerRpc {
  return {
    call: vi.fn().mockResolvedValue(value),
  } as unknown as CircuitBreakerRpc;
}

describe("fetchTransactionFull", () => {
  it("parses balances, token balances, and parsed instructions", async () => {
    const raw = {
      slot: 100,
      blockTime: 1_700_000_000,
      meta: {
        err: null,
        preBalances: [5_000_000_000, 0],
        postBalances: [4_000_000_000, 1_000_000_000],
        preTokenBalances: [],
        postTokenBalances: [],
        innerInstructions: [],
      },
      transaction: {
        message: {
          accountKeys: [{ pubkey: "Donor111" }, { pubkey: "Jar111" }],
          instructions: [
            {
              programId: "11111111111111111111111111111111",
              accounts: ["Donor111", "Jar111"],
              parsed: {
                type: "transfer",
                info: { source: "Donor111", destination: "Jar111", lamports: 1_000_000_000 },
              },
            },
          ],
        },
      },
    };
    const rpc = rpcReturning(raw);
    const tx = await fetchTransactionFull(rpc, "sig1");
    expect(tx).not.toBeNull();
    expect(tx!.accountKeys).toEqual(["Donor111", "Jar111"]);
    expect(tx!.preBalances[1]).toBe(0);
    expect(tx!.postBalances[1]).toBe(1_000_000_000);
    expect(tx!.instructions).toHaveLength(1);
    expect(tx!.instructions[0].programId).toBe("11111111111111111111111111111111");
    expect(tx!.instructions[0].data).toMatchObject({
      type: "transfer",
      lamports: "1000000000",
    });
  });

  it("returns null when raw is null", async () => {
    const rpc = rpcReturning(null);
    expect(await fetchTransactionFull(rpc, "sig")).toBeNull();
  });

  it("normalizes splTransferChecked instructions", async () => {
    const raw = {
      slot: 1,
      blockTime: 1,
      meta: {
        err: null,
        preBalances: [0],
        postBalances: [0],
        preTokenBalances: [{ accountIndex: 0, mint: "USDC", owner: "Own", uiTokenAmount: { amount: "0" } }],
        postTokenBalances: [{ accountIndex: 0, mint: "USDC", owner: "Own", uiTokenAmount: { amount: "100" } }],
        innerInstructions: [],
      },
      transaction: {
        message: {
          accountKeys: [{ pubkey: "Ata111" }],
          instructions: [
            {
              programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              accounts: ["Src", "USDC", "Ata111", "Auth"],
              parsed: {
                type: "transferChecked",
                info: { source: "Src", mint: "USDC", destination: "Ata111", authority: "Auth", tokenAmount: { amount: "100" } },
              },
            },
          ],
        },
      },
    };
    const rpc = rpcReturning(raw);
    const tx = await fetchTransactionFull(rpc, "sig");
    expect(tx!.instructions[0].data).toMatchObject({
      type: "splTransferChecked",
      amount: "100",
      mint: "USDC",
    });
    expect(tx!.preTokenBalances[0]).toEqual({
      accountIndex: 0,
      mint: "USDC",
      owner: "Own",
      amount: "0",
    });
    expect(tx!.postTokenBalances[0].amount).toBe("100");
  });
});
