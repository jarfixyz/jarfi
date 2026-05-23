import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveContribution,
  createFundedKeypair,
  expectRevert,
} from "./helpers";

describe("contribute_sol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  let jar: anchor.web3.PublicKey;
  let owner: anchor.web3.Keypair;
  let donor: anchor.web3.Keypair;
  let config: anchor.web3.PublicKey;

  before(async () => {
    const fix = (global as any).__flexSolJar__;
    jar = fix.jar;
    owner = fix.owner;
    donor = await createFundedKeypair(provider, 10);
    [config] = deriveConfig(program.programId);
  });

  it("first contribution creates Contribution PDA and increments counters", async () => {
    const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);

    const amount = new BN(500_000_000);
    const jarBefore = await provider.connection.getBalance(jar);

    await program.methods
      .contributeSol(amount)
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution,
        config,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.totalContributed.toNumber()).to.equal(500_000_000);
    expect(jarAcc.totalContributors).to.equal(1);

    const contrib = await program.account.contribution.fetch(contribution);
    expect(contrib.amount.toNumber()).to.equal(500_000_000);
    expect(contrib.refunded).to.equal(false);

    const jarAfter = await provider.connection.getBalance(jar);
    expect(jarAfter - jarBefore).to.equal(500_000_000);
  });

  it("repeat contribution from same donor updates PDA, does not double-count contributors", async () => {
    const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);

    await program.methods
      .contributeSol(new BN(200_000_000))
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution,
        config,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.totalContributed.toNumber()).to.equal(700_000_000);
    expect(jarAcc.totalContributors).to.equal(1);

    const contrib = await program.account.contribution.fetch(contribution);
    expect(contrib.amount.toNumber()).to.equal(700_000_000);
  });

  it("second donor increments total_contributors to 2", async () => {
    const donor2 = await createFundedKeypair(provider, 3);
    const [contribution2] = deriveContribution(jar, donor2.publicKey, program.programId);

    await program.methods
      .contributeSol(new BN(300_000_000))
      .accounts({
        donor: donor2.publicKey,
        jar,
        contribution: contribution2,
        config,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor2])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.totalContributors).to.equal(2);
    expect(jarAcc.totalContributed.toNumber()).to.equal(1_000_000_000);

    (global as any).__flexSolDonors__ = { donor1: donor, donor2 };
  });

  it("rejects zero amount", async () => {
    const donor3 = await createFundedKeypair(provider, 2);
    const [contribution3] = deriveContribution(jar, donor3.publicKey, program.programId);
    await expectRevert(
      program.methods
        .contributeSol(new BN(0))
        .accounts({
          donor: donor3.publicKey,
          jar,
          contribution: contribution3,
          config,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([donor3])
        .rpc(),
      "ZeroAmount"
    );
  });
});
