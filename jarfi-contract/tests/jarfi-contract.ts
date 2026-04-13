import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { JarfiContract } from "../target/types/jarfi_contract";
import { expect } from "chai";

describe("jarfi-contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.jarfiContract as Program<JarfiContract>;

  it("creates a jar and a quest", async () => {
    const jar = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);
    const mode = 0;

    await program.methods
      .createJar(mode, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    const questName = "Weekly homework";
    const amount = new anchor.BN(3000000);
    const frequency = 0;

    await program.methods
      .createQuest(questName, amount, frequency)
      .accounts({
        jar: jar.publicKey,
        quest: quest.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([quest])
      .rpc();

    const questAccount = await program.account.quest.fetch(quest.publicKey);

    expect(questAccount.jar.toBase58()).to.equal(jar.publicKey.toBase58());
    expect(questAccount.name).to.equal(questName);
    expect(questAccount.amount.toString()).to.equal(amount.toString());
    expect(questAccount.frequency).to.equal(frequency);
    expect(questAccount.lastPaid.toString()).to.equal("0");
    expect(questAccount.active).to.equal(true);
  });

  it("approves a quest and updates jar balance + last_paid", async () => {
    const jar = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const unlockDate = new anchor.BN(now + 60 * 60 * 24 * 30);
    const mode = 0;

    await program.methods
      .createJar(mode, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    const questName = "Reading";
    const amount = new anchor.BN(5000);
    const frequency = 0;

    await program.methods
      .createQuest(questName, amount, frequency)
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
    const mode = 0;

    await program.methods
      .createJar(mode, unlockDate)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();

    const dailyLimit = new anchor.BN(1000);
    const weeklyLimit = new anchor.BN(5000);

    await program.methods
      .setSpendingLimit(dailyLimit, weeklyLimit)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);

    expect(jarAccount.dailyLimit.toString()).to.equal("1000");
    expect(jarAccount.weeklyLimit.toString()).to.equal("5000");
  });

  it("unlocks a jar only after unlock date", async () => {
    const pastJar = anchor.web3.Keypair.generate();
    const futureJar = anchor.web3.Keypair.generate();

    const now = Math.floor(Date.now() / 1000);
    const pastUnlockDate = new anchor.BN(now - 60);
    const futureUnlockDate = new anchor.BN(now + 60 * 60 * 24);
    const mode = 0;

    await program.methods
      .createJar(mode, pastUnlockDate)
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
      .createJar(mode, futureUnlockDate)
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
