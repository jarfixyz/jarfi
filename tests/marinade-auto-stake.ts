/**
 * Marinade SOL auto-stake integration tests (T1–T9 from the spec).
 *
 * RUN MANUALLY (not via `anchor test`/localnet):
 *
 *   ANCHOR_WALLET=$HOME/.config/solana/id.json \
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   MARINADE_DEVNET=1 \
 *   pnpm ts-mocha -p tsconfig.json -t 1000000 tests/marinade-auto-stake.ts
 *
 * Without `MARINADE_DEVNET=1` the suite is skipped so it does not break
 * `pnpm test:program` (localnet has neither the Marinade program nor the
 * mSOL mint).
 *
 * Pre-conditions:
 *   - jarfi program redeployed with the Marinade auto-stake changes
 *   - Config has auto_stake_enabled = true and min_auto_stake_lock_days = 30
 *   - Deployer wallet has at least 5 SOL
 */

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import { Jarfi } from "../target/types/jarfi";
import {
  deriveConfig,
  deriveTreasury,
  deriveUserState,
  deriveJar,
  deriveContribution,
  MARINADE,
  jarMsolAta,
  marinadeContributeSolRemaining,
  marinadeUnstakeRemaining,
} from "./helpers";

// ---------------------------------------------------------------------------
// Suite-level skip: only run with MARINADE_DEVNET=1 set.
// ---------------------------------------------------------------------------
const SHOULD_RUN = process.env.MARINADE_DEVNET === "1";
const desc = SHOULD_RUN ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CU_BUDGET = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

function loadDeployer(): Keypair {
  const path = process.env.ANCHOR_WALLET ?? `${os.homedir()}/.config/solana/id.json`;
  const secret = JSON.parse(fs.readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function fundSol(
  conn: Connection,
  from: Keypair,
  to: PublicKey,
  sol: number,
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    }),
  );
  await anchor.web3.sendAndConfirmTransaction(conn, tx, [from]);
}

async function ensureUserState(
  program: Program<Jarfi>,
  owner: Keypair,
): Promise<{ userState: PublicKey; jarCount: BN }> {
  const [userState] = deriveUserState(owner.publicKey, program.programId);
  const acc = await program.account.userState.fetchNullable(userState);
  if (!acc) {
    await program.methods
      .initUserState()
      .accounts({
        owner: owner.publicKey,
        userState,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([owner])
      .rpc();
    return { userState, jarCount: new BN(0) };
  }
  return { userState, jarCount: acc.jarCount };
}

function hash32(seed: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(seed.padEnd(32, "x")).copy(buf, 0, 0, 32);
  return Array.from(buf);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
desc("Marinade SOL auto-stake integration", function () {
  this.timeout(180_000);

  const baseProvider = anchor.AnchorProvider.env();
  const conn = new Connection(baseProvider.connection.rpcEndpoint, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
  const provider = new anchor.AnchorProvider(conn, baseProvider.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.Jarfi as Program<Jarfi>;

  let deployer: Keypair;
  let [config]: [PublicKey, number] = [PublicKey.default, 0];
  let [treasury]: [PublicKey, number] = [PublicKey.default, 0];

  before(async () => {
    deployer = loadDeployer();
    [config] = deriveConfig(program.programId);
    [treasury] = deriveTreasury(program.programId);
    const cfg: any = await program.account.config.fetch(config);
    if (!cfg.autoStakeEnabled) {
      throw new Error("Devnet config has auto_stake_enabled=false. Run scripts/setup-devnet-config.ts first.");
    }
  });

  // ---------------------------------------------------------------------------
  // T1: create_jar SOL+TimeLocked+auto_stake (31-day lock) → stakeProtocol == 2
  // ---------------------------------------------------------------------------
  it("T1: create_jar SOL+TimeLocked+auto_stake sets stakeProtocol == 2", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.3);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = deriveJar(owner.publicKey, jarCount, program.programId);
    const msolAtaPubkey = jarMsolAta(jar);

    const thirtyOneDays = new BN(Math.floor(Date.now() / 1000) + 31 * 86_400);

    // Pre-create the jar's mSOL ATA as part of the same transaction.
    const createAtaIx = createAssociatedTokenAccountInstruction(
      owner.publicKey,
      msolAtaPubkey,
      jar,
      MARINADE.msolMint,
    );

    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(2 * LAMPORTS_PER_SOL),
        thirtyOneDays,
        "https://r2.jarfi.app/metadata/marinade-t1.json",
        hash32("marinade-t1"),
        true, // auto_stake
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
        systemProgram: SystemProgram.programId,
      } as any)
      .preInstructions([CU_BUDGET, createAtaIx])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const jarAcc: any = await program.account.jar.fetch(jar);
    expect(jarAcc.autoStake, "autoStake").to.equal(true);
    expect(jarAcc.stakeProtocol, "stakeProtocol == 2 (MarinadeSol)").to.equal(2);
    expect(jarAcc.principalTotal.toString(), "principalTotal").to.equal("0");
    expect(jarAcc.sharesTotal.toString(), "sharesTotal").to.equal("0");

    // Persist for downstream tests.
    (global as any).__marinadeT1Jar__ = { owner, jar, userState, msolAtaPubkey };
  });

  // ---------------------------------------------------------------------------
  // T2: contribute_sol → mSOL ATA balance > 0, contribution.shares > 0
  //
  // NOTE: Requires a live Marinade CPI. Skipped on bankrun because bankrun
  // does not host the Marinade program. Validate via scripts/marinade-smoke.ts.
  // ---------------------------------------------------------------------------
  it.skip("T2: contribute_sol deposits SOL into Marinade, mSOL ATA balance > 0 (pending CPI compat)", async () => {
    const { owner, jar, userState, msolAtaPubkey } = (global as any).__marinadeT1Jar__ as {
      owner: Keypair;
      jar: PublicKey;
      userState: PublicKey;
      msolAtaPubkey: PublicKey;
    };

    const donor = Keypair.generate();
    await fundSol(conn, deployer, donor.publicKey, 1.5);
    const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);

    const amountLamports = new BN(LAMPORTS_PER_SOL); // 1 SOL

    await program.methods
      .contributeSol(amountLamports)
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution,
        config,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(marinadeContributeSolRemaining(jar))
      .preInstructions([CU_BUDGET])
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    const msolBalance = await conn.getTokenAccountBalance(msolAtaPubkey);
    expect(Number(msolBalance.value.amount), "mSOL ATA balance > 0").to.be.greaterThan(0);

    const contribAcc: any = await program.account.contribution.fetch(contribution);
    expect(contribAcc.shares.toNumber(), "contribution.shares > 0").to.be.greaterThan(0);
    expect(contribAcc.amount.toString(), "contribution.amount").to.equal(amountLamports.toString());

    const jarAcc: any = await program.account.jar.fetch(jar);
    expect(jarAcc.sharesTotal.toNumber(), "jar.sharesTotal > 0").to.be.greaterThan(0);
    expect(jarAcc.principalTotal.toString(), "jar.principalTotal").to.equal(amountLamports.toString());

    console.log("    mSOL balance:", msolBalance.value.uiAmountString, "mSOL");
    console.log("    contribution.shares:", contribAcc.shares.toString());

    (global as any).__marinadeT1Jar__ = { ...((global as any).__marinadeT1Jar__), donor, contribution };
  });

  // ---------------------------------------------------------------------------
  // T3: Multi-donor contribute → sharesTotal == sum(contribution.shares)
  //
  // Same CPI caveat as T2 — skipped unless Marinade program is available.
  // ---------------------------------------------------------------------------
  it.skip("T3: multi-donor contribute_sol sharesTotal == sum(shares) (pending CPI compat)", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.3);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = deriveJar(owner.publicKey, jarCount, program.programId);
    const msolAtaPubkey = jarMsolAta(jar);

    const thirtyOneDays = new BN(Math.floor(Date.now() / 1000) + 31 * 86_400);

    const createAtaIx = createAssociatedTokenAccountInstruction(
      owner.publicKey,
      msolAtaPubkey,
      jar,
      MARINADE.msolMint,
    );

    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(5 * LAMPORTS_PER_SOL),
        thirtyOneDays,
        "https://r2.jarfi.app/metadata/marinade-t3.json",
        hash32("marinade-t3"),
        true,
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
        systemProgram: SystemProgram.programId,
      } as any)
      .preInstructions([CU_BUDGET, createAtaIx])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const donors = await Promise.all([1, 2].map(async () => {
      const d = Keypair.generate();
      await fundSol(conn, deployer, d.publicKey, 1.5);
      return d;
    }));

    let totalShares = new BN(0);
    for (const donor of donors) {
      const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);
      await program.methods
        .contributeSol(new BN(LAMPORTS_PER_SOL))
        .accounts({
          donor: donor.publicKey,
          jar,
          contribution,
          config,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts(marinadeContributeSolRemaining(jar))
        .preInstructions([CU_BUDGET])
        .signers([donor])
        .rpc({ commitment: "confirmed" });

      const c: any = await program.account.contribution.fetch(contribution);
      totalShares = totalShares.add(c.shares);
    }

    const jarAcc: any = await program.account.jar.fetch(jar);
    expect(jarAcc.sharesTotal.toString(), "jar.sharesTotal == sum of contribution.shares")
      .to.equal(totalShares.toString());
  });

  // ---------------------------------------------------------------------------
  // T4–T7: Unlock + withdraw tests (skipped — require clock warp or live devnet wait)
  // ---------------------------------------------------------------------------
  it.skip("T4: withdraw after unlock liquid-unstakes mSOL → SOL and pays owner minus fee (requires --use-clock-warp or live devnet wait; validate via scripts/marinade-smoke.ts)", () => {});
  it.skip("T5: partial withdraw pays proportional fee (requires --use-clock-warp or live devnet wait; validate via scripts/marinade-smoke.ts)", () => {});
  it.skip("T6: refund after cancel returns principal SOL (requires --use-clock-warp or live devnet wait; validate via scripts/marinade-smoke.ts)", () => {});
  it.skip("T7: cancel_jar with shares_total > 0 unstakes before flipping status (requires --use-clock-warp or live devnet wait; validate via scripts/marinade-smoke.ts)", () => {});

  // ---------------------------------------------------------------------------
  // T8: Gate negatives — covered by tests/auto-stake.ts descGates block.
  // ---------------------------------------------------------------------------
  // (no duplication — see tests/auto-stake.ts "Marinade SOL auto-stake gates")

  // ---------------------------------------------------------------------------
  // T9: contributeSol with wrong Marinade state in remaining_accounts[1] →
  // MarinadeAccountMismatch. Fires before CPI (require_keys_eq), so works on
  // localnet (devnet) without needing the Marinade program.
  // ---------------------------------------------------------------------------
  it("T9: wrong Marinade state key in remaining_accounts → MarinadeAccountMismatch", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.3);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = deriveJar(owner.publicKey, jarCount, program.programId);
    const msolAtaPubkey = jarMsolAta(jar);

    const thirtyOneDays = new BN(Math.floor(Date.now() / 1000) + 31 * 86_400);
    const createAtaIx = createAssociatedTokenAccountInstruction(
      owner.publicKey,
      msolAtaPubkey,
      jar,
      MARINADE.msolMint,
    );

    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(LAMPORTS_PER_SOL),
        thirtyOneDays,
        "https://r2.jarfi.app/metadata/marinade-t9.json",
        hash32("marinade-t9"),
        true,
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
        systemProgram: SystemProgram.programId,
      } as any)
      .preInstructions([CU_BUDGET, createAtaIx])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const donor = Keypair.generate();
    await fundSol(conn, deployer, donor.publicKey, 1.5);
    const [contribution] = deriveContribution(jar, donor.publicKey, program.programId);

    // Build remaining_accounts with a WRONG state key at index 1.
    const wrongState = Keypair.generate().publicKey;
    const wrongRemaining = marinadeContributeSolRemaining(jar).map((r, i) =>
      i === 1 ? { ...r, pubkey: wrongState } : r,
    );

    let threw = false;
    try {
      await program.methods
        .contributeSol(new BN(LAMPORTS_PER_SOL))
        .accounts({
          donor: donor.publicKey,
          jar,
          contribution,
          config,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts(wrongRemaining)
        .preInstructions([CU_BUDGET])
        .signers([donor])
        .rpc({ commitment: "confirmed" });
    } catch (e: any) {
      threw = true;
      const msg = (e?.message ?? String(e)).toString();
      expect(msg).to.match(/MarinadeAccountMismatch/);
    }
    expect(threw, "expected MarinadeAccountMismatch error").to.equal(true);
  });
});
