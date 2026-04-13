import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { JarfiContract } from "../target/types/jarfi_contract";
import { expect } from "chai";

describe("jarfi-contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.jarfiContract as Program<JarfiContract>;

  it("creates a jar and accepts a deposit", async () => {
    const jar = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(0, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    await program.methods
      .deposit(new anchor.BN(20000))
      .accounts({
        jar: jar.publicKey,
        depositor: provider.wallet.publicKey,
      })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);

    expect(jarAccount.balance.toString()).to.equal("20000");
    expect(jarAccount.stakingShares.toString()).to.equal("20000");
  });

  it("creates a jar and a quest", async () => {
    const jar = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(0, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    await program.methods
      .createQuest("Weekly homework", new anchor.BN(3000000), 0)
      .accounts({
        jar: jar.publicKey,
        quest: quest.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([quest])
      .rpc();

    const questAccount = await program.account.quest.fetch(quest.publicKey);
    expect(questAccount.name).to.equal("Weekly homework");
  });

  it("approves a quest and updates jar balance + last_paid", async () => {
    const jar = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(0, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    await program.methods
      .createQuest("Reading", new anchor.BN(5000), 0)
      .accounts({
        jar: jar.publicKey,
        quest: quest.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([quest])
      .rpc();

    await program.methods
      .approveQuest()
      .accounts({
        jar: jar.publicKey,
        quest: quest.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    const questAccount = await program.account.quest.fetch(quest.publicKey);

    expect(jarAccount.balance.toString()).to.equal("5000");
    expect(questAccount.lastPaid.toNumber()).to.be.greaterThan(0);
  });

  it("sets spending limits", async () => {
    const jar = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(0, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    await program.methods
      .setSpendingLimit(new anchor.BN(1000), new anchor.BN(5000))
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.dailyLimit.toString()).to.equal("1000");
    expect(jarAccount.weeklyLimit.toString()).to.equal("5000");
  });

  it("accepts a gift deposit with comment", async () => {
    const jar = anchor.web3.Keypair.generate();
    const contribution = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(0, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    const amount = new anchor.BN(15000);
    const comment = "With love from grandma";

    await program.methods
      .giftDeposit(amount, comment)
      .accounts({
        jar: jar.publicKey,
        contribution: contribution.publicKey,
        contributor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([contribution])
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    const contributionAccount = await program.account.contribution.fetch(
      contribution.publicKey
    );

    expect(jarAccount.balance.toString()).to.equal("15000");
    expect(contributionAccount.jar.toBase58()).to.equal(jar.publicKey.toBase58());
    expect(contributionAccount.amount.toString()).to.equal("15000");
    expect(contributionAccount.comment).to.equal(comment);
    expect(contributionAccount.contributor.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
  });

  it("unlocks a jar only after unlock date", async () => {
    const pastJar = anchor.web3.Keypair.generate();
    const futureJar = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const pastUnlockDate = new anchor.BN(now - 60);
    const futureUnlockDate = new anchor.BN(now + 60 * 60 * 24);

    await program.methods
      .createJar(0, pastUnlockDate)
      .accounts({
        jar: pastJar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([pastJar])
      .rpc();

    await program.methods
      .unlockJar()
      .accounts({
        jar: pastJar.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    await program.methods
      .createJar(0, futureUnlockDate)
      .accounts({
        jar: futureJar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([futureJar])
      .rpc();

    let failedAsExpected = false;

    try {
      await program.methods
        .unlockJar()
        .accounts({
          jar: futureJar.publicKey,
          owner: provider.wallet.publicKey,
        })
        .rpc();
    } catch {
      failedAsExpected = true;
    }

    expect(failedAsExpected).to.equal(true);
  });
});
