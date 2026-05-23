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

describe("integration: time-locked cancel + refund", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("create -> contribute x2 -> cancel -> refund x2 -> close", async () => {
    const owner = await createFundedKeypair(provider, 5);
    const d1 = await createFundedKeypair(provider, 3);
    const d2 = await createFundedKeypair(provider, 3);

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
    const unlock = new BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);

    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(5_000_000_000),
        unlock,
        "ipfs://bafy/locked",
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

    for (const donor of [d1, d2]) {
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

    await program.methods
      .cancelJar()
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    for (const donor of [d1, d2]) {
      const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);
      await program.methods
        .refund()
        .accounts({
          owner: owner.publicKey,
          jar,
          donor: donor.publicKey,
          contribution,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
    }

    const jarState = await program.account.jar.fetch(jar);
    expect(jarState.totalContributors).to.equal(0);
    expect(jarState.totalContributed.toNumber()).to.equal(0);

    await program.methods
      .closeJar()
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    const closed = await provider.connection.getAccountInfo(jar);
    expect(closed).to.equal(null);
  });
});
