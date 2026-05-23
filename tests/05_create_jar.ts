import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveTreasury,
  deriveUserState,
  deriveJar,
  deriveJarVault,
  createFundedKeypair,
  createUsdcMint,
  expectRevert,
} from "./helpers";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

describe("create_jar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  const JAR_TYPE_FLEXIBLE = { flexible: {} };
  const JAR_TYPE_TIME_LOCKED = { timeLocked: {} };
  const ASSET_SOL = { sol: {} };
  const ASSET_USDC = { usdc: {} };

  const hash32 = (seed: string): number[] => {
    const buf = Buffer.alloc(32);
    Buffer.from(seed.padEnd(32, "x")).copy(buf, 0, 0, 32);
    return Array.from(buf);
  };

  it("creates a Flexible SOL jar", async () => {
    const owner = await createFundedKeypair(provider, 5);
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
    const [jar] = deriveJar(owner.publicKey, jarId, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    const goalAmount = new BN(2_000_000_000);
    const metadataUri = "https://r2.jarfi.app/metadata/test1.json";
    const metadataHash = hash32("flex-sol-1");

    const treasuryBefore = await provider.connection.getBalance(treasury);

    await program.methods
      .createJar(
        JAR_TYPE_FLEXIBLE as any,
        ASSET_SOL as any,
        goalAmount,
        new BN(0),
        metadataUri,
        metadataHash,
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

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.version).to.equal(1);
    expect(jarAcc.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(jarAcc.id.toNumber()).to.equal(0);
    expect(jarAcc.goalAmount.toNumber()).to.equal(2_000_000_000);
    expect(jarAcc.unlockTimestamp.toNumber()).to.equal(0);
    expect(jarAcc.totalContributed.toNumber()).to.equal(0);
    expect(jarAcc.totalContributors).to.equal(0);
    expect(jarAcc.metadataUri).to.equal(metadataUri);
    expect(Array.from(jarAcc.metadataHash)).to.deep.equal(metadataHash);

    const usAfter = await program.account.userState.fetch(userState);
    expect(usAfter.jarCount.toNumber()).to.equal(1);

    const treasuryAfter = await provider.connection.getBalance(treasury);
    expect(treasuryAfter - treasuryBefore).to.be.greaterThan(0);

    (global as any).__flexSolJar__ = { owner, jar, userState };
  });

  it("creates a Time-locked SOL jar with future unlock", async () => {
    const owner = await createFundedKeypair(provider, 5);
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
    const [jar] = deriveJar(owner.publicKey, jarId, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    const now = Math.floor(Date.now() / 1000);
    const unlock = new BN(now + 3600);

    await program.methods
      .createJar(
        JAR_TYPE_TIME_LOCKED as any,
        ASSET_SOL as any,
        new BN(1_000_000_000),
        unlock,
        "https://r2.jarfi.app/metadata/tl.json",
        hash32("tl-1"),
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

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.jarType).to.deep.equal(JAR_TYPE_TIME_LOCKED);
    expect(jarAcc.unlockTimestamp.toNumber()).to.equal(unlock.toNumber());

    (global as any).__timeLockedSolJar__ = { owner, jar, userState };
  });

  it("creates a Flexible USDC jar with vault", async () => {
    const owner = await createFundedKeypair(provider, 5);
    const admin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;
    const mint = await createUsdcMint(provider, admin);

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
    const [jar] = deriveJar(owner.publicKey, jarId, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);
    const jarVault = getAssociatedTokenAddressSync(mint, jar, true);

    await program.methods
      .updateConfig(null, null, null, null, mint, null)
      .accounts({ admin: admin.publicKey, config })
      .signers([admin])
      .rpc();

    await program.methods
      .createJar(
        JAR_TYPE_FLEXIBLE as any,
        ASSET_USDC as any,
        new BN(500_000_000),
        new BN(0),
        "https://r2.jarfi.app/metadata/usdc.json",
        hash32("usdc-1"),
        false
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault,
        vaultMint: mint,
        config,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.asset).to.deep.equal(ASSET_USDC);

    (global as any).__usdcJar__ = { owner, jar, mint, userState, jarVault };
  });

  it("rejects unlock in the past", async () => {
    const owner = await createFundedKeypair(provider, 5);
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

    const [jar] = deriveJar(owner.publicKey, new BN(0), program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    const past = new BN(Math.floor(Date.now() / 1000) - 10);

    await expectRevert(
      program.methods
        .createJar(
          JAR_TYPE_TIME_LOCKED as any,
          ASSET_SOL as any,
          new BN(0),
          past,
          "uri",
          hash32("x"),
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
        .rpc(),
      "UnlockInPast"
    );
  });

  it("rejects unlock_timestamp != 0 on Flexible jar", async () => {
    const owner = await createFundedKeypair(provider, 5);
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

    const [jar] = deriveJar(owner.publicKey, new BN(0), program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    await expectRevert(
      program.methods
        .createJar(
          JAR_TYPE_FLEXIBLE as any,
          ASSET_SOL as any,
          new BN(0),
          new BN(Math.floor(Date.now() / 1000) + 3600),
          "uri",
          hash32("x"),
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
        .rpc(),
      "UnlockNotAllowed"
    );
  });
});
