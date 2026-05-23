import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  createFundedKeypair,
  deriveConfig,
  deriveContribution,
  deriveJar,
  deriveTreasury,
  deriveUserState,
} from "./helpers";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("integration: flexible SOL jar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("create -> contribute x3 -> withdraw -> close", async () => {
    const owner = await createFundedKeypair(provider, 5);
    const d1 = await createFundedKeypair(provider, 3);
    const d2 = await createFundedKeypair(provider, 3);
    const d3 = await createFundedKeypair(provider, 3);

    const [userState] = deriveUserState(owner.publicKey, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

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

    await program.methods
      .createJar(
        { flexible: {} } as any,
        { sol: {} } as any,
        new BN(3_000_000_000),
        new BN(0),
        "ipfs://bafy/integration",
        Array.from(Buffer.alloc(32, 0)),
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

    for (const donor of [d1, d2, d3]) {
      const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);
      await program.methods
        .contributeSol(new BN(1_000_000_000))
        .accounts({
          donor: donor.publicKey,
          jar,
          contribution,
          config,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([donor])
        .rpc();
    }

    const jarState = await program.account.jar.fetch(jar);
    expect(jarState.totalContributed.toNumber()).to.equal(3_000_000_000);
    expect(jarState.totalContributors).to.equal(3);

    const ownerBefore = await provider.connection.getBalance(owner.publicKey);
    await program.methods
      .withdraw(null)
      .accounts({
        owner: owner.publicKey,
        jar,
        config,
        treasury,
        jarVault: null,
        ownerTokenAccount: null,
        treasuryTokenAccount: null,
        vaultMint: null,
        tokenProgram: null,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
    const ownerAfter = await provider.connection.getBalance(owner.publicKey);

    // net ~= 3 SOL - 2.5% = 2.925 SOL. Allow for tx fees.
    const netReceived = ownerAfter - ownerBefore;
    expect(netReceived).to.be.greaterThan(2_900_000_000);

    const jarAfter = await program.account.jar.fetch(jar);
    expect(jarAfter.status).to.deep.equal({ withdrawn: {} });

    await program.methods
      .closeJar()
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    const closed = await provider.connection.getAccountInfo(jar);
    expect(closed).to.equal(null);
  });
});
