import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  createFundedKeypair,
  expectRevert,
} from "./helpers";

describe("admin transfer (propose + accept)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("propose stores pending_admin; accept rotates admin", async () => {
    const currentAdmin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;
    const [config] = deriveConfig(program.programId);

    const newAdmin = await createFundedKeypair(provider, 2);

    await program.methods
      .proposeAdmin(newAdmin.publicKey)
      .accounts({ admin: currentAdmin.publicKey, config })
      .signers([currentAdmin])
      .rpc();

    let cfg = await program.account.config.fetch(config);
    expect(cfg.pendingAdmin?.toBase58()).to.equal(newAdmin.publicKey.toBase58());

    await program.methods
      .acceptAdmin()
      .accounts({ newAdmin: newAdmin.publicKey, config })
      .signers([newAdmin])
      .rpc();

    cfg = await program.account.config.fetch(config);
    expect(cfg.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());
    expect(cfg.pendingAdmin).to.be.null;

    await program.methods
      .proposeAdmin(currentAdmin.publicKey)
      .accounts({ admin: newAdmin.publicKey, config })
      .signers([newAdmin])
      .rpc();
    await program.methods
      .acceptAdmin()
      .accounts({ newAdmin: currentAdmin.publicKey, config })
      .signers([currentAdmin])
      .rpc();
  });

  it("rejects propose from non-admin", async () => {
    const stranger = await createFundedKeypair(provider, 1);
    const [config] = deriveConfig(program.programId);
    await expectRevert(
      program.methods
        .proposeAdmin(stranger.publicKey)
        .accounts({ admin: stranger.publicKey, config })
        .signers([stranger])
        .rpc(),
      "NotAdmin"
    );
  });

  it("rejects accept from non-pending signer", async () => {
    const admin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;
    const [config] = deriveConfig(program.programId);

    const pending = await createFundedKeypair(provider, 1);
    await program.methods
      .proposeAdmin(pending.publicKey)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();

    const stranger = await createFundedKeypair(provider, 1);
    await expectRevert(
      program.methods
        .acceptAdmin()
        .accounts({ newAdmin: stranger.publicKey, config })
        .signers([stranger])
        .rpc(),
      "NotPendingAdmin"
    );

    await program.methods
      .proposeAdmin(admin.publicKey)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();
  });
});
