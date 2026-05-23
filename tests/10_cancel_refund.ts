import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveTreasury,
  deriveUserState,
  deriveJar,
  deriveContribution,
  createFundedKeypair,
  expectRevert,
} from "./helpers";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("cancel_jar + refund", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  let owner: anchor.web3.Keypair;
  let jar: anchor.web3.PublicKey;
  let donor1: anchor.web3.Keypair;
  let donor2: anchor.web3.Keypair;

  before(async () => {
    owner = await createFundedKeypair(provider, 5);
    const [userState] = deriveUserState(owner.publicKey, program.programId);
    await program.methods
      .initUserState()
      .accounts({
        owner: owner.publicKey,
        userState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const jarId = new BN(0);
    [jar] = deriveJar(owner.publicKey, jarId, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    const unlock = new BN(Math.floor(Date.now() / 1000) + 86_400);
    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(2_000_000_000),
        unlock,
        "uri",
        Array.from(Buffer.alloc(32, 1)),
        false
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault: null,
        vaultMint: null,
        config,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    donor1 = await createFundedKeypair(provider, 5);
    donor2 = await createFundedKeypair(provider, 5);
    const [c1] = deriveContribution(jar, donor1.publicKey, program.programId);
    const [c2] = deriveContribution(jar, donor2.publicKey, program.programId);

    await program.methods
      .contributeSol(new BN(500_000_000))
      .accounts({
        donor: donor1.publicKey,
        jar,
        contribution: c1,
        config,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor1])
      .rpc();

    await program.methods
      .contributeSol(new BN(300_000_000))
      .accounts({
        donor: donor2.publicKey,
        jar,
        contribution: c2,
        config,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor2])
      .rpc();

    (global as any).__cancelRefundFixture__ = { owner, jar, donor1, donor2 };
  });

  it("owner can cancel a time-locked jar before unlock", async () => {
    await program.methods
      .cancelJar()
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.status).to.deep.equal({ cancelled: {} });
  });

  it("non-owner cannot cancel", async () => {
    const stranger = await createFundedKeypair(provider, 1);
    await expectRevert(
      program.methods
        .cancelJar()
        .accounts({ owner: stranger.publicKey, jar })
        .signers([stranger])
        .rpc(),
      "NotOwner"
    );
  });

  it("owner can refund donor1 after cancel", async () => {
    const [contribPda] = deriveContribution(jar, donor1.publicKey, program.programId);
    const before = await provider.connection.getBalance(donor1.publicKey);

    await program.methods
      .refund()
      .accounts({
        owner: owner.publicKey,
        jar,
        donor: donor1.publicKey,
        contribution: contribPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const after = await provider.connection.getBalance(donor1.publicKey);
    expect(after - before).to.equal(500_000_000);

    const contrib = await program.account.contribution.fetch(contribPda);
    expect(contrib.amount.toNumber()).to.equal(0);
    expect(contrib.refunded).to.equal(true);

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.totalContributed.toNumber()).to.equal(300_000_000);
    expect(jarAcc.totalContributors).to.equal(1);
  });

  it("non-owner cannot refund", async () => {
    const stranger = await createFundedKeypair(provider, 1);
    const [contribPda] = deriveContribution(jar, donor2.publicKey, program.programId);
    await expectRevert(
      program.methods
        .refund()
        .accounts({
          owner: stranger.publicKey,
          jar,
          donor: donor2.publicKey,
          contribution: contribPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
      "NotOwner"
    );
  });

  it("refund fails on already-refunded contribution", async () => {
    const [contribPda] = deriveContribution(jar, donor1.publicKey, program.programId);
    await expectRevert(
      program.methods
        .refund()
        .accounts({
          owner: owner.publicKey,
          jar,
          donor: donor1.publicKey,
          contribution: contribPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc(),
      "AlreadyRefunded"
    );
  });
});
