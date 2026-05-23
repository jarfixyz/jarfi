import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Jarfi } from "../target/types/jarfi";
import { deriveUserState, createFundedKeypair } from "./helpers";

describe("init_user_state", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as anchor.Program<Jarfi>;

  it("creates UserState PDA with jar_count = 0", async () => {
    const owner = await createFundedKeypair(provider, 2);
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

    const state = await program.account.userState.fetch(userState);
    expect(state.version).to.equal(1);
    expect(state.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(state.jarCount.toNumber()).to.equal(0);
  });
});
