import { describe, it, expect } from "vitest";
import {
  extractSolDirectTransfer,
  type ParsedTransactionFull,
} from "../lib/direct-indexer";

// @vitest-environment node

const JAR = "Jar11111111111111111111111111111111111111";
const DONOR = "Don11111111111111111111111111111111111111";
const DONOR2 = "Don22222222222222222222222222222222222222";
const SYSTEM = "11111111111111111111111111111111";

function makeTx(fields: Partial<ParsedTransactionFull>): ParsedTransactionFull {
  return {
    signature: "sig",
    slot: 1,
    blockTime: 1_700_000_000,
    err: null,
    accountKeys: [],
    preBalances: [],
    postBalances: [],
    preTokenBalances: [],
    postTokenBalances: [],
    instructions: [],
    innerInstructions: [],
    ...fields,
  };
}

describe("extractSolDirectTransfer", () => {
  it("extracts donor + delta from single System transfer", () => {
    const tx = makeTx({
      accountKeys: [DONOR, JAR, SYSTEM],
      preBalances: [5_000_000_000, 1_000_000, 1],
      postBalances: [4_000_000_000, 1_001_000_000, 1],
      instructions: [
        {
          programId: SYSTEM,
          accounts: [DONOR, JAR],
          data: { type: "transfer", lamports: "1000000000" },
        },
      ],
    });
    const result = extractSolDirectTransfer(tx, JAR);
    expect(result).toEqual({ delta: 1_000_000_000n, donor: DONOR });
  });

  it("returns null when jar not in accountKeys", () => {
    const tx = makeTx({
      accountKeys: [DONOR, SYSTEM],
      preBalances: [5_000_000_000, 1],
      postBalances: [4_000_000_000, 1],
    });
    expect(extractSolDirectTransfer(tx, JAR)).toBeNull();
  });

  it("returns null when delta <= 0", () => {
    const tx = makeTx({
      accountKeys: [DONOR, JAR],
      preBalances: [5_000_000_000, 1_000_000_000],
      postBalances: [5_000_000_000, 500_000_000],
    });
    expect(extractSolDirectTransfer(tx, JAR)).toBeNull();
  });

  it("returns null when Transfer sum != balance diff (ambiguous)", () => {
    const tx = makeTx({
      accountKeys: [DONOR, JAR, SYSTEM],
      preBalances: [5_000_000_000, 1_000_000, 1],
      postBalances: [4_500_000_000, 1_800_000_000, 1],
      instructions: [
        {
          programId: SYSTEM,
          accounts: [DONOR, JAR],
          data: { type: "transfer", lamports: "500000000" },
        },
      ],
    });
    expect(extractSolDirectTransfer(tx, JAR)).toBeNull();
  });

  it("multi transfer: donor = source of largest", () => {
    const tx = makeTx({
      accountKeys: [DONOR, DONOR2, JAR, SYSTEM],
      preBalances: [5_000_000_000, 5_000_000_000, 0, 1],
      postBalances: [4_000_000_000, 4_700_000_000, 1_300_000_000, 1],
      instructions: [
        {
          programId: SYSTEM,
          accounts: [DONOR, JAR],
          data: { type: "transfer", lamports: "1000000000" },
        },
        {
          programId: SYSTEM,
          accounts: [DONOR2, JAR],
          data: { type: "transfer", lamports: "300000000" },
        },
      ],
    });
    const result = extractSolDirectTransfer(tx, JAR);
    expect(result).toEqual({ delta: 1_300_000_000n, donor: DONOR });
  });

  it("returns null when no System transfer instruction present", () => {
    const tx = makeTx({
      accountKeys: [DONOR, JAR],
      preBalances: [5_000_000_000, 0],
      postBalances: [4_000_000_000, 1_000_000_000],
      instructions: [],
    });
    expect(extractSolDirectTransfer(tx, JAR)).toBeNull();
  });
});

import { extractUsdcDirectTransfer } from "../lib/direct-indexer";

const JAR_ATA = "Ata11111111111111111111111111111111111111";
const DONOR_ATA = "Ata22222222222222222222222222222222222222";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

describe("extractUsdcDirectTransfer", () => {
  it("extracts delta + donor from SPL Transfer", () => {
    const tx = makeTx({
      accountKeys: [DONOR, DONOR_ATA, JAR_ATA, TOKEN],
      preBalances: [5_000_000_000, 2_000_000, 2_000_000, 1],
      postBalances: [5_000_000_000, 2_000_000, 2_000_000, 1],
      preTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "50000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "1000000" },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "40000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "11000000" },
      ],
      instructions: [
        {
          programId: TOKEN,
          accounts: [DONOR_ATA, JAR_ATA, DONOR],
          data: { type: "splTransfer", amount: "10000000" },
        },
      ],
    });
    const result = extractUsdcDirectTransfer(tx, JAR_ATA);
    expect(result).toEqual({ delta: 10_000_000n, donor: DONOR });
  });

  it("handles TransferChecked", () => {
    const tx = makeTx({
      accountKeys: [DONOR, DONOR_ATA, JAR_ATA, TOKEN],
      preBalances: [0, 0, 0, 0],
      postBalances: [0, 0, 0, 0],
      preTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "20000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "0" },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "15000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "5000000" },
      ],
      instructions: [
        {
          programId: TOKEN,
          accounts: [DONOR_ATA, USDC, JAR_ATA, DONOR],
          data: { type: "splTransferChecked", amount: "5000000", mint: USDC },
        },
      ],
    });
    const result = extractUsdcDirectTransfer(tx, JAR_ATA);
    expect(result).toEqual({ delta: 5_000_000n, donor: DONOR });
  });

  it("handles ATA created in same tx (no pre balance)", () => {
    const tx = makeTx({
      accountKeys: [DONOR, DONOR_ATA, JAR_ATA, TOKEN],
      preBalances: [0, 0, 0, 0],
      postBalances: [0, 0, 0, 0],
      preTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "10000000" },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "3000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "7000000" },
      ],
      instructions: [
        {
          programId: TOKEN,
          accounts: [DONOR_ATA, JAR_ATA, DONOR],
          data: { type: "splTransfer", amount: "7000000" },
        },
      ],
    });
    const result = extractUsdcDirectTransfer(tx, JAR_ATA);
    expect(result).toEqual({ delta: 7_000_000n, donor: DONOR });
  });

  it("returns null on delta <= 0", () => {
    const tx = makeTx({
      accountKeys: [JAR_ATA, TOKEN],
      preTokenBalances: [
        { accountIndex: 0, mint: USDC, owner: JAR, amount: "10000000" },
      ],
      postTokenBalances: [
        { accountIndex: 0, mint: USDC, owner: JAR, amount: "3000000" },
      ],
    });
    expect(extractUsdcDirectTransfer(tx, JAR_ATA)).toBeNull();
  });

  it("returns null on mismatch between token delta and SPL transfer sum", () => {
    const tx = makeTx({
      accountKeys: [DONOR, DONOR_ATA, JAR_ATA, TOKEN],
      preTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "20000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "0" },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: USDC, owner: DONOR, amount: "10000000" },
        { accountIndex: 2, mint: USDC, owner: JAR, amount: "8000000" },
      ],
      instructions: [
        {
          programId: TOKEN,
          accounts: [DONOR_ATA, JAR_ATA, DONOR],
          data: { type: "splTransfer", amount: "5000000" },
        },
      ],
    });
    expect(extractUsdcDirectTransfer(tx, JAR_ATA)).toBeNull();
  });

  it("returns null when no SPL Transfer instruction present", () => {
    const tx = makeTx({
      accountKeys: [JAR_ATA, TOKEN],
      preTokenBalances: [
        { accountIndex: 0, mint: USDC, owner: JAR, amount: "0" },
      ],
      postTokenBalances: [
        { accountIndex: 0, mint: USDC, owner: JAR, amount: "1000000" },
      ],
      instructions: [],
    });
    expect(extractUsdcDirectTransfer(tx, JAR_ATA)).toBeNull();
  });
});

import { getUsdcAta } from "../lib/direct-indexer";

describe("getUsdcAta", () => {
  it("matches @solana/spl-token derivation for devnet USDC", () => {
    const jarKey = "4CcKDtU1JNGi8U4D8Rv9CHzfmF7xzaxEAPFA54eQjRHF";
    const expectedAta = "7XobcNamajqHAJGof2svvz47ewdPrRtVnBix3J6rCbtM";
    expect(getUsdcAta(jarKey)).toBe(expectedAta);
  });
});
