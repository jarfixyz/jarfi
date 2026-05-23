// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyWalletSignature, buildChallenge } from "../lib/signatures";

describe("verifyWalletSignature", () => {
  it("accepts a valid signature", () => {
    const kp = Keypair.generate();
    const challenge = buildChallenge("JarPda111", "deadbeef", 0);
    const msg = new TextEncoder().encode(challenge);
    const sig = nacl.sign.detached(msg, kp.secretKey);
    const ok = verifyWalletSignature(
      challenge,
      bs58.encode(sig),
      kp.publicKey.toBase58(),
    );
    expect(ok).toBe(true);
  });

  it("rejects a signature from a different key", () => {
    const kp = Keypair.generate();
    const wrong = Keypair.generate();
    const challenge = buildChallenge("JarPda111", "deadbeef", 0);
    const msg = new TextEncoder().encode(challenge);
    const sig = nacl.sign.detached(msg, wrong.secretKey);
    const ok = verifyWalletSignature(
      challenge,
      bs58.encode(sig),
      kp.publicKey.toBase58(),
    );
    expect(ok).toBe(false);
  });

  it("rejects tampered challenge text", () => {
    const kp = Keypair.generate();
    const challenge = buildChallenge("JarPda111", "deadbeef", 0);
    const msg = new TextEncoder().encode(challenge);
    const sig = nacl.sign.detached(msg, kp.secretKey);
    const ok = verifyWalletSignature(
      "different-challenge",
      bs58.encode(sig),
      kp.publicKey.toBase58(),
    );
    expect(ok).toBe(false);
  });
});
