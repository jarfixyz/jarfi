import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  createFundedKeypair,
  deriveConfig,
  deriveTreasury,
  deriveJar,
  deriveUserState,
  expectRevert,
} from "./helpers";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("close_jar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  let owner: anchor.web3.Keypair;
  let jar: anchor.web3.PublicKey;

  const createFlexSolJar = async (
    ownerKp: anchor.web3.Keypair,
    id: BN
  ): Promise<anchor.web3.PublicKey> => {
    const [userState] = deriveUserState(ownerKp.publicKey, program.programId);
    const [jarPda] = deriveJar(ownerKp.publicKey, id, program.programId);
    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    await program.methods
      .createJar(
        { flexible: {} } as any,
        { sol: {} } as any,
        new BN(1_000_000_000),
        new BN(0),
        "ipfs://bafy/close",
        Array.from(Buffer.alloc(32, 0)),
        false
      )
      .accounts({
        owner: ownerKp.publicKey,
        userState,
        jar: jarPda,
        jarVault: null,
        vaultMint: null,
        config,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();

    return jarPda;
  };

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

    jar = await createFlexSolJar(owner, new BN(0));

    const [config] = deriveConfig(program.programId);
    const [treasury] = deriveTreasury(program.programId);

    // Full withdraw to reach Withdrawn state (flexible, empty — drains any residual rent-above-min)
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
  });

  it("owner can close a withdrawn jar", async () => {
    await program.methods
      .closeJar()
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    const acct = await provider.connection.getAccountInfo(jar);
    expect(acct).to.equal(null);
  });

  it("cannot close an active jar", async () => {
    const jar2 = await createFlexSolJar(owner, new BN(1));

    await expectRevert(
      program.methods
        .closeJar()
        .accounts({ owner: owner.publicKey, jar: jar2 })
        .signers([owner])
        .rpc(),
      "CloseNotAllowed"
    );
  });
});
