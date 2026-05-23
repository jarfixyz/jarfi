import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  createFundedKeypair,
  expectRevert,
} from "./helpers";

describe("update_config", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  let admin: anchor.web3.Keypair;

  before(async () => {
    const [config] = deriveConfig(program.programId);
    const cfg = await program.account.config.fetch(config);
    admin = (global as any).__jarfiAdmin__;
    expect(admin, "admin fixture must exist from 01").to.not.be.undefined;
  });

  it("admin can update withdraw_fee_bps within cap", async () => {
    const [config] = deriveConfig(program.programId);
    await program.methods
      .updateConfig(null, 250, null, null, null, null)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
    const cfg = await program.account.config.fetch(config);
    expect(cfg.withdrawFeeBps).to.equal(250);
  });

  it("rejects withdraw_fee_bps above 5% cap", async () => {
    const [config] = deriveConfig(program.programId);
    await expectRevert(
      program.methods
        .updateConfig(null, 501, null, null, null, null)
        .accounts({ admin: admin.publicKey, config })
        .signers([admin])
        .rpc(),
      "FeeTooHigh"
    );
  });

  it("rejects creation_fee above 0.1 SOL cap", async () => {
    const [config] = deriveConfig(program.programId);
    await expectRevert(
      program.methods
        .updateConfig(new BN(100_000_001), null, null, null, null, null)
        .accounts({ admin: admin.publicKey, config })
        .signers([admin])
        .rpc(),
      "CreationFeeTooHigh"
    );
  });

  it("rejects updates from a non-admin signer", async () => {
    const stranger = await createFundedKeypair(provider, 1);
    const [config] = deriveConfig(program.programId);
    await expectRevert(
      program.methods
        .updateConfig(null, 100, null, null, null, null)
        .accounts({ admin: stranger.publicKey, config })
        .signers([stranger])
        .rpc(),
      "NotAdmin"
    );
  });

  it("admin can pause and unpause", async () => {
    const [config] = deriveConfig(program.programId);
    await program.methods
      .updateConfig(null, null, null, true, null, null)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
    let cfg = await program.account.config.fetch(config);
    expect(cfg.paused).to.equal(true);

    await program.methods
      .updateConfig(null, null, null, false, null, null)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
    cfg = await program.account.config.fetch(config);
    expect(cfg.paused).to.equal(false);
  });
});
