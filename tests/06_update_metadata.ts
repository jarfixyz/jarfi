import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import { createFundedKeypair, expectRevert } from "./helpers";

describe("update_metadata", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  const hash32 = (seed: string): number[] => {
    const buf = Buffer.alloc(32);
    Buffer.from(seed.padEnd(32, "x")).copy(buf, 0, 0, 32);
    return Array.from(buf);
  };

  it("owner can update metadata uri and hash", async () => {
    const { owner, jar } = (global as any).__flexSolJar__ as {
      owner: anchor.web3.Keypair;
      jar: anchor.web3.PublicKey;
    };

    const newUri = "https://r2.jarfi.app/metadata/test1-v2.json";
    const newHash = hash32("flex-sol-1-v2");

    await program.methods
      .updateMetadata(newUri, newHash)
      .accounts({ owner: owner.publicKey, jar })
      .signers([owner])
      .rpc();

    const jarAcc = await program.account.jar.fetch(jar);
    expect(jarAcc.metadataUri).to.equal(newUri);
    expect(Array.from(jarAcc.metadataHash)).to.deep.equal(newHash);
  });

  it("non-owner cannot update metadata", async () => {
    const { jar } = (global as any).__flexSolJar__ as {
      jar: anchor.web3.PublicKey;
    };
    const stranger = await createFundedKeypair(provider, 1);
    await expectRevert(
      program.methods
        .updateMetadata("uri", hash32("x"))
        .accounts({ owner: stranger.publicKey, jar })
        .signers([stranger])
        .rpc(),
      "NotOwner"
    );
  });
});
