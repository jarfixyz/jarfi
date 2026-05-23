import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  createFundedKeypair,
  deriveConfig,
  deriveTreasury,
  expectRevert,
} from "./helpers";

describe("withdraw_treasury", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("admin drains a portion of treasury to destination", async () => {
    const admin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);
    const dest = anchor.web3.Keypair.generate();

    const treasuryBefore = await provider.connection.getBalance(treasury);
    expect(treasuryBefore).to.be.greaterThan(0);

    // Must drain at least rent-exempt minimum (890_880 for 0-byte account) to destination.
    // Use 1_000_000 lamports which is above rent-exempt threshold and well below treasury balance.
    const amount = new BN(Math.min(treasuryBefore, 1_000_000));

    await program.methods
      .withdrawTreasury(amount)
      .accounts({
        admin: admin.publicKey,
        config,
        treasury,
        destination: dest.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const destBal = await provider.connection.getBalance(dest.publicKey);
    expect(destBal).to.equal(amount.toNumber());

    const treasuryAfter = await provider.connection.getBalance(treasury);
    expect(treasuryBefore - treasuryAfter).to.equal(amount.toNumber());
  });

  it("non-admin cannot drain treasury", async () => {
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);
    const stranger = await createFundedKeypair(provider, 1);
    const dest = anchor.web3.Keypair.generate();

    await expectRevert(
      program.methods
        .withdrawTreasury(new BN(1))
        .accounts({
          admin: stranger.publicKey,
          config,
          treasury,
          destination: dest.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
      "NotAdmin"
    );
  });

  it("rejects zero amount", async () => {
    const admin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);
    const dest = anchor.web3.Keypair.generate();

    await expectRevert(
      program.methods
        .withdrawTreasury(new BN(0))
        .accounts({
          admin: admin.publicKey,
          config,
          treasury,
          destination: dest.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc(),
      "ZeroAmount"
    );
  });
});
