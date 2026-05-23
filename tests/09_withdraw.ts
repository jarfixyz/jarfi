import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveTreasury,
  expectRevert,
  createFundedKeypair,
} from "./helpers";

describe("withdraw", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("flexible: partial withdraw transfers funds minus fee", async () => {
    const { owner, jar } = (global as any).__flexSolJar__ as {
      owner: anchor.web3.Keypair;
      jar: anchor.web3.PublicKey;
    };
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    const cfg = await program.account.config.fetch(config);
    const feeBps = cfg.withdrawFeeBps;

    const jarBefore = await provider.connection.getBalance(jar);
    const ownerBefore = await provider.connection.getBalance(owner.publicKey);
    const treasuryBefore = await provider.connection.getBalance(treasury);

    const amount = new BN(400_000_000);

    await program.methods
      .withdraw(amount)
      .accounts({
        owner: owner.publicKey,
        jar,
        config,
        treasury,
        jarVault: null,
        ownerTokenAccount: null,
        treasuryTokenAccount: null,
        vaultMint: null,
        tokenProgram: null,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const jarAfter = await provider.connection.getBalance(jar);
    const ownerAfter = await provider.connection.getBalance(owner.publicKey);
    const treasuryAfter = await provider.connection.getBalance(treasury);

    const feeExpected = Math.floor((amount.toNumber() * feeBps) / 10_000);
    const netExpected = amount.toNumber() - feeExpected;

    expect(jarBefore - jarAfter).to.equal(amount.toNumber());
    expect(treasuryAfter - treasuryBefore).to.equal(feeExpected);
    const ownerDelta = ownerAfter - ownerBefore;
    expect(ownerDelta).to.be.greaterThan(netExpected - 10_000);
    expect(ownerDelta).to.be.lessThanOrEqual(netExpected);

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.status).to.deep.equal({ active: {} });
  });

  it("flexible: full withdraw (amount = null) transitions to Withdrawn", async () => {
    const { owner, jar } = (global as any).__flexSolJar__ as {
      owner: anchor.web3.Keypair;
      jar: anchor.web3.PublicKey;
    };
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    await program.methods
      .withdraw(null)
      .accounts({
        owner: owner.publicKey,
        jar,
        config,
        treasury,
        jarVault: null,
        ownerTokenAccount: null,
        treasuryTokenAccount: null,
        vaultMint: null,
        tokenProgram: null,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.status).to.deep.equal({ withdrawn: {} });
  });

  it("time-locked: rejects withdraw before unlock", async () => {
    const { owner, jar } = (global as any).__timeLockedSolJar__ as {
      owner: anchor.web3.Keypair;
      jar: anchor.web3.PublicKey;
    };
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    await expectRevert(
      program.methods
        .withdraw(null)
        .accounts({
          owner: owner.publicKey,
          jar,
          config,
          treasury,
          jarVault: null,
          ownerTokenAccount: null,
          treasuryTokenAccount: null,
          vaultMint: null,
          tokenProgram: null,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc(),
      "StillLocked"
    );
  });

  it("non-owner cannot withdraw", async () => {
    const { jar } = (global as any).__timeLockedSolJar__ as {
      jar: anchor.web3.PublicKey;
    };
    const stranger = await createFundedKeypair(provider, 1);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    await expectRevert(
      program.methods
        .withdraw(null)
        .accounts({
          owner: stranger.publicKey,
          jar,
          config,
          treasury,
          jarVault: null,
          ownerTokenAccount: null,
          treasuryTokenAccount: null,
          vaultMint: null,
          tokenProgram: null,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
      "NotOwner"
    );
  });
});
