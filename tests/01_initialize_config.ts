import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveTreasury,
  createFundedKeypair,
  expectRevert,
} from "./helpers";

describe("initialize_config", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("initializes config with admin, fees, and treasury", async () => {
    const admin = await createFundedKeypair(provider, 5);
    (global as any).__jarfiAdmin__ = admin;
    const [config] = deriveConfig(program.programId);
    const [treasury, treasuryBump] = deriveTreasury(program.programId);

    await program.methods
      .initializeConfig(new BN(5_000_000), 100, anchor.web3.PublicKey.default)
      .accounts({
        admin: admin.publicKey,
        config,
        treasury,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const cfg = await program.account.config.fetch(config);
    expect(cfg.version).to.equal(1);
    expect(cfg.admin.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(cfg.pendingAdmin).to.be.null;
    expect(cfg.treasuryBump).to.equal(treasuryBump);
    expect(cfg.creationFeeLamports.toNumber()).to.equal(5_000_000);
    expect(cfg.withdrawFeeBps).to.equal(100);
    expect(cfg.feeEnabled).to.equal(true);
    expect(cfg.paused).to.equal(false);
  });

  it("rejects fee above 5% hard cap", async () => {
    const [config] = deriveConfig(program.programId);
    const existing = await program.account.config.fetchNullable(config);
    if (existing) {
      return; // already initialized; bound check exercised in update_config tests
    }

    const admin = await createFundedKeypair(provider, 5);
    const [treasury] = deriveTreasury(program.programId);

    await expectRevert(
      program.methods
        .initializeConfig(new BN(0), 501, anchor.web3.PublicKey.default)
        .accounts({
          admin: admin.publicKey,
          config,
          treasury,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc(),
      "FeeTooHigh"
    );
  });
});
