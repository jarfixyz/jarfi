import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import {
  deriveConfigPda,
  deriveTreasuryPda,
  deriveUserStatePda,
  deriveJarPda,
  deriveContributionPda,
} from "./pdas";

describe("pdas", () => {
  it("derives deterministic config PDA", () => {
    const [a] = deriveConfigPda();
    const [b] = deriveConfigPda();
    expect(a.equals(b)).toBe(true);
  });

  it("derives deterministic treasury PDA distinct from config", () => {
    const [config] = deriveConfigPda();
    const [treasury] = deriveTreasuryPda();
    expect(treasury.equals(config)).toBe(false);
  });

  it("user state PDA depends on owner", () => {
    const o1 = Keypair.generate().publicKey;
    const o2 = Keypair.generate().publicKey;
    const [u1] = deriveUserStatePda(o1);
    const [u2] = deriveUserStatePda(o2);
    expect(u1.equals(u2)).toBe(false);
  });

  it("different owners with same jar id produce different jars", () => {
    const o1 = Keypair.generate().publicKey;
    const o2 = Keypair.generate().publicKey;
    const id = new BN(1);
    const [j1] = deriveJarPda(o1, id);
    const [j2] = deriveJarPda(o2, id);
    expect(j1.equals(j2)).toBe(false);
  });

  it("same owner with different jar ids produce different jars", () => {
    const owner = Keypair.generate().publicKey;
    const [j0] = deriveJarPda(owner, new BN(0));
    const [j1] = deriveJarPda(owner, new BN(1));
    expect(j0.equals(j1)).toBe(false);
  });

  it("contribution PDA depends on donor", () => {
    const jar = Keypair.generate().publicKey;
    const d1 = Keypair.generate().publicKey;
    const d2 = Keypair.generate().publicKey;
    const [c1] = deriveContributionPda(jar, d1);
    const [c2] = deriveContributionPda(jar, d2);
    expect(c1.equals(c2)).toBe(false);
  });
});
