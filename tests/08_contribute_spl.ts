import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveContribution,
  createFundedKeypair,
  mintUsdcTo,
} from "./helpers";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

describe("contribute_spl", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("donor can contribute USDC to a USDC jar", async () => {
    const fix = (global as any).__usdcJar__ as {
      owner: anchor.web3.Keypair;
      jar: anchor.web3.PublicKey;
      mint: anchor.web3.PublicKey;
      jarVault: anchor.web3.PublicKey;
    };
    const admin = (global as any).__jarfiAdmin__ as anchor.web3.Keypair;

    const donor = await createFundedKeypair(provider, 2);
    const donorAta = await mintUsdcTo(
      provider,
      fix.mint,
      admin,
      donor.publicKey,
      BigInt(1_000_000_000)
    );

    const [contribution] = deriveContribution(
      fix.jar,
      donor.publicKey,
      program.programId
    );
    const [config] = deriveConfig(program.programId);

    const amount = new BN(250_000_000);

    await program.methods
      .contributeSpl(amount)
      .accounts({
        donor: donor.publicKey,
        jar: fix.jar,
        contribution,
        config,
        donorTokenAccount: donorAta,
        jarVault: fix.jarVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const jarAcc = await program.account.jar.fetch(fix.jar);
    expect(jarAcc.totalContributed.toNumber()).to.equal(250_000_000);
    expect(jarAcc.totalContributors).to.equal(1);

    (global as any).__usdcDonor1__ = { donor, donorAta };
  });
});
