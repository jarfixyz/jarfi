import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { JarfiContract } from "../target/types/jarfi_contract";
import { expect } from "chai";

describe("jarfi-contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.jarfiContract as Program<JarfiContract>;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function makeJar(
    mode: number,
    unlockDate: anchor.BN,
    goalAmount: anchor.BN,
    childWallet: anchor.web3.PublicKey
  ) {
    const jar = anchor.web3.Keypair.generate();
    await program.methods
      .createJar(mode, unlockDate, goalAmount, childWallet)
      .accounts({
        jar: jar.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([jar])
      .rpc();
    return jar;
  }

  // ---------------------------------------------------------------------------
  // Original tests (updated with goalAmount arg)
  // ---------------------------------------------------------------------------

  it("creates a jar and accepts a deposit", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 30),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(20000))
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);

    expect(jarAccount.balance.toString()).to.equal("20000");
    expect(jarAccount.stakingShares.toString()).to.equal("0"); // set by recordMarinadeStake, not deposit
    expect(jarAccount.childWallet.toBase58()).to.equal(childWallet.publicKey.toBase58());
    expect(jarAccount.childSpendableBalance.toString()).to.equal("0");
    expect(jarAccount.unlocked).to.equal(false);
    expect(jarAccount.goalAmount.toString()).to.equal("0");
  });

  it("creates a jar and a quest", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 30),
      new anchor.BN(0),
      childWallet.publicKey
    );

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

  it("approves a quest and moves reward into child spendable balance", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const quest = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 30),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(10000))
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
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
      .accounts({ jar: jar.publicKey, quest: quest.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    const questAccount = await program.account.quest.fetch(quest.publicKey);

    expect(jarAccount.balance.toString()).to.equal("5000");
    expect(jarAccount.childSpendableBalance.toString()).to.equal("5000");
    expect(questAccount.lastPaid.toNumber()).to.be.greaterThan(0);
  });

  it("sets spending limits", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 30),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .setSpendingLimit(new anchor.BN(1000), new anchor.BN(5000))
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.dailyLimit.toString()).to.equal("1000");
    expect(jarAccount.weeklyLimit.toString()).to.equal("5000");
  });

  it("accepts a gift deposit with comment", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const contribution = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 30),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .giftDeposit(new anchor.BN(15000), "With love from grandma")
      .accounts({
        jar: jar.publicKey,
        contribution: contribution.publicKey,
        contributor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([contribution])
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    const contributionAccount = await program.account.contribution.fetch(contribution.publicKey);

    expect(jarAccount.balance.toString()).to.equal("15000");
    expect(contributionAccount.amount.toString()).to.equal("15000");
    expect(contributionAccount.comment).to.equal("With love from grandma");
    expect(contributionAccount.contributor.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
  });

  it("unlocks a date-based jar (mode=0) after unlock date", async () => {
    const childWallet1 = anchor.web3.Keypair.generate();
    const childWallet2 = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    // Past unlock date — should succeed
    const pastJar = await makeJar(
      0,
      new anchor.BN(now - 60),
      new anchor.BN(0),
      childWallet1.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(12000))
      .accounts({ jar: pastJar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .unlockJar()
      .accounts({ jar: pastJar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const unlockedJar = await program.account.jar.fetch(pastJar.publicKey);
    expect(unlockedJar.balance.toString()).to.equal("0");
    expect(unlockedJar.childSpendableBalance.toString()).to.equal("12000");
    expect(unlockedJar.unlocked).to.equal(true);

    // Future unlock date — should fail
    const futureJar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24),
      new anchor.BN(0),
      childWallet2.publicKey
    );

    let failedAsExpected = false;
    try {
      await program.methods
        .unlockJar()
        .accounts({ jar: futureJar.publicKey, owner: provider.wallet.publicKey })
        .rpc();
    } catch {
      failedAsExpected = true;
    }
    expect(failedAsExpected).to.equal(true);
  });

  // ---------------------------------------------------------------------------
  // Phase 1b — goal-based unlock (mode=1)
  // ---------------------------------------------------------------------------

  it("unlocks a goal-based jar (mode=1) when balance reaches goal", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);
    const goalAmount = new anchor.BN(10000);

    const jar = await makeJar(
      1,
      new anchor.BN(now + 60 * 60 * 24 * 365), // far future date — irrelevant for mode=1
      goalAmount,
      childWallet.publicKey
    );

    // Deposit exactly the goal amount
    await program.methods
      .deposit(goalAmount)
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .unlockJar()
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.unlocked).to.equal(true);
    expect(jarAccount.balance.toString()).to.equal("0");
    expect(jarAccount.childSpendableBalance.toString()).to.equal("10000");
  });

  it("blocks goal-based jar (mode=1) unlock when balance is below goal", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      1,
      new anchor.BN(now - 60), // past date — but mode=1 ignores date
      new anchor.BN(10000),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(5000)) // only half the goal
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    let failedAsExpected = false;
    try {
      await program.methods
        .unlockJar()
        .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
        .rpc();
    } catch {
      failedAsExpected = true;
    }
    expect(failedAsExpected).to.equal(true);
  });

  it("rejects goal-based jar creation (mode=1) with goal_amount = 0", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const jar = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    let failedAsExpected = false;
    try {
      await program.methods
        .createJar(1, new anchor.BN(now + 86400), new anchor.BN(0), childWallet.publicKey)
        .accounts({
          jar: jar.publicKey,
          owner: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([jar])
        .rpc();
    } catch {
      failedAsExpected = true;
    }
    expect(failedAsExpected).to.equal(true);
  });

  // ---------------------------------------------------------------------------
  // Phase 1b — combined unlock (mode=2, either/first)
  // ---------------------------------------------------------------------------

  it("unlocks a combined jar (mode=2) when goal is hit before date", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      2,
      new anchor.BN(now + 60 * 60 * 24 * 365), // far future date
      new anchor.BN(5000),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(5000)) // hits goal
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .unlockJar()
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.unlocked).to.equal(true);
  });

  it("unlocks a combined jar (mode=2) when date passes before goal is hit", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      2,
      new anchor.BN(now - 60), // date already passed
      new anchor.BN(999999),   // goal not yet reached
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(100)) // far below goal
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .unlockJar()
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.unlocked).to.equal(true);
  });

  it("blocks combined jar (mode=2) when neither condition is met", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      2,
      new anchor.BN(now + 60 * 60 * 24), // date in future
      new anchor.BN(10000),               // goal not reached
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(100))
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    let failedAsExpected = false;
    try {
      await program.methods
        .unlockJar()
        .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
        .rpc();
    } catch {
      failedAsExpected = true;
    }
    expect(failedAsExpected).to.equal(true);
  });

  // ---------------------------------------------------------------------------
  // Phase 1c — emergency_withdraw
  // ---------------------------------------------------------------------------

  it("emergency_withdraw clears balance and marks jar as unlocked", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    // Locked for a year — should not be unlockable normally
    const jar = await makeJar(
      0,
      new anchor.BN(now + 60 * 60 * 24 * 365),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(50000))
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .emergencyWithdraw()
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    const jarAccount = await program.account.jar.fetch(jar.publicKey);
    expect(jarAccount.balance.toString()).to.equal("0");
    expect(jarAccount.stakingShares.toString()).to.equal("0");
    expect(jarAccount.unlocked).to.equal(true);
  });

  it("blocks emergency_withdraw on an already-unlocked jar", async () => {
    const childWallet = anchor.web3.Keypair.generate();
    const now = Math.floor(Date.now() / 1000);

    const jar = await makeJar(
      0,
      new anchor.BN(now - 60),
      new anchor.BN(0),
      childWallet.publicKey
    );

    await program.methods
      .deposit(new anchor.BN(1000))
      .accounts({ jar: jar.publicKey, depositor: provider.wallet.publicKey })
      .rpc();

    // Unlock normally first
    await program.methods
      .unlockJar()
      .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
      .rpc();

    // Emergency withdraw on already-unlocked jar should fail
    let failedAsExpected = false;
    try {
      await program.methods
        .emergencyWithdraw()
        .accounts({ jar: jar.publicKey, owner: provider.wallet.publicKey })
        .rpc();
    } catch {
      failedAsExpected = true;
    }
    expect(failedAsExpected).to.equal(true);
  });
});
