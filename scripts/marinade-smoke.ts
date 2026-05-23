/**
 * Marinade SOL auto-stake live-devnet smoke script.
 *
 * Usage:
 *   pnpm ts-node scripts/marinade-smoke.ts <keypair-path> [lock-seconds]
 *
 * Example (with admin-lowered min_auto_stake_lock_days for testing):
 *   pnpm ts-node scripts/marinade-smoke.ts ~/.config/solana/id.json 120
 *
 * Flow:
 *   STEP 1  Init user state (idempotent)
 *   STEP 2  Create TimeLocked SOL jar with auto_stake=true, pre-creating mSOL ATA
 *   STEP 3  Contribute 0.5 SOL (donor = owner in this smoke)
 *   STEP 4  Contribute 0.5 SOL again (second contribution)
 *   STEP 5  Assert mSOL ATA balance > 0
 *   STEP 6  (Optional) Wait for unlock, then withdraw and print SOL balance delta
 *
 * Pre-conditions:
 *   - jarfi program deployed on devnet with Marinade auto-stake changes
 *   - Config has auto_stake_enabled = true
 *   - Config admin has lowered min_auto_stake_lock_days to a small value (e.g. 1)
 *     if you want a short lock-seconds (default is 30 days = 2592000 s)
 *   - Owner wallet has at least 5 SOL on devnet
 */

import { AnchorProvider, BN, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import type { Jarfi } from "../target/types/jarfi";
import {
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
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Marinade constants (mainnet/devnet identical)
// ---------------------------------------------------------------------------
const MARINADE_PROGRAM = new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
const MARINADE_STATE   = new PublicKey("8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC");
const MSOL_MINT        = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
const MSOL_MINT_AUTH   = new PublicKey("3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM");
const RESERVE_PDA      = new PublicKey("Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN");
const LIQ_SOL_LEG      = new PublicKey("UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q");
const LIQ_MSOL_LEG     = new PublicKey("7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE");
const LIQ_MSOL_LEG_AUTH = new PublicKey("EyaSjUtSgo9aRD1f8LWXwdvkpDTmXAW54yoSHZRF14WL");
const TREASURY_MSOL    = new PublicKey("8ZUcztoAEhpAeC2ixWewJKQJsSUGYSGPVAjkhDJYf5Gd");

const PROGRAM_ID = new PublicKey("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");
const RPC = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";

function marinadeContributeSolRemaining(jar: PublicKey) {
  return [
    { pubkey: MARINADE_PROGRAM,   isSigner: false, isWritable: false },
    { pubkey: MARINADE_STATE,     isSigner: false, isWritable: true  },
    { pubkey: MSOL_MINT,          isSigner: false, isWritable: true  },
    { pubkey: LIQ_SOL_LEG,        isSigner: false, isWritable: true  },
    { pubkey: LIQ_MSOL_LEG,       isSigner: false, isWritable: true  },
    { pubkey: LIQ_MSOL_LEG_AUTH,  isSigner: false, isWritable: false },
    { pubkey: RESERVE_PDA,        isSigner: false, isWritable: true  },
    { pubkey: MSOL_MINT_AUTH,     isSigner: false, isWritable: false },
    { pubkey: getAssociatedTokenAddressSync(MSOL_MINT, jar, true), isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
  ];
}

function marinadeUnstakeRemaining(jar: PublicKey) {
  return [
    { pubkey: MARINADE_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: MARINADE_STATE,   isSigner: false, isWritable: true  },
    { pubkey: MSOL_MINT,        isSigner: false, isWritable: true  },
    { pubkey: LIQ_SOL_LEG,     isSigner: false, isWritable: true  },
    { pubkey: LIQ_MSOL_LEG,    isSigner: false, isWritable: true  },
    { pubkey: TREASURY_MSOL,   isSigner: false, isWritable: true  },
    { pubkey: getAssociatedTokenAddressSync(MSOL_MINT, jar, true), isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // ---------------------------------------------------------------------------
  // Parse args
  // ---------------------------------------------------------------------------
  const keypairPath = process.argv[2];
  if (!keypairPath) {
    console.error("Usage: pnpm ts-node scripts/marinade-smoke.ts <keypair-path> [lock-seconds]");
    process.exit(1);
  }
  const lockSeconds = process.argv[3] ? parseInt(process.argv[3], 10) : 2_592_000; // default 30 days
  console.log(`Lock duration: ${lockSeconds}s`);

  // ---------------------------------------------------------------------------
  // Setup provider
  // ---------------------------------------------------------------------------
  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  const owner = Keypair.fromSecretKey(Uint8Array.from(secret));
  const conn = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(owner), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const idl = JSON.parse(readFileSync(resolve("target/idl/jarfi.json"), "utf8")) as Idl;
  const program = new Program(idl, provider) as unknown as Program<Jarfi>;

  // PDAs
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID);
  const [userState] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), owner.publicKey.toBuffer()],
    PROGRAM_ID,
  );

  const solBal = await conn.getBalance(owner.publicKey);
  console.log(`owner: ${owner.publicKey.toBase58()}`);
  console.log(`balance: ${(solBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  // ---------------------------------------------------------------------------
  // STEP 1: Init user state (idempotent)
  // ---------------------------------------------------------------------------
  console.log("\nSTEP 1: init_user_state");
  const usAcc = await program.account.userState.fetchNullable(userState);
  let jarCount = usAcc ? (usAcc as any).jarCount as BN : new BN(0);
  if (!usAcc) {
    const sig = await program.methods
      .initUserState()
      .accounts({
        owner: owner.publicKey,
        userState,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log("  sig:", sig);
  } else {
    console.log("  already initialized, jarCount:", jarCount.toString());
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Create TimeLocked SOL jar with auto_stake=true
  // ---------------------------------------------------------------------------
  console.log("\nSTEP 2: create_jar (TimeLocked, SOL, auto_stake=true)");
  const [jar] = PublicKey.findProgramAddressSync(
    [Buffer.from("jar"), owner.publicKey.toBuffer(), jarCount.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  );
  const msolAtaPubkey = getAssociatedTokenAddressSync(MSOL_MINT, jar, true);
  const unlockTimestamp = new BN(Math.floor(Date.now() / 1000) + lockSeconds);

  const createAtaIx = createAssociatedTokenAccountInstruction(
    owner.publicKey,
    msolAtaPubkey,
    jar,
    MSOL_MINT,
  );

  const sig2 = await program.methods
    .createJar(
      { timeLocked: {} } as any,
      { sol: {} } as any,
      new BN(2 * LAMPORTS_PER_SOL),
      unlockTimestamp,
      "https://r2.jarfi.app/metadata/marinade-smoke.json",
      Array.from(Buffer.alloc(32, 0x42)),
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
    .preInstructions([createAtaIx])
    .signers([owner])
    .rpc({ commitment: "confirmed" });

  console.log("  sig:", sig2);
  console.log("  jar:", jar.toBase58());
  console.log("  mSOL ATA:", msolAtaPubkey.toBase58());
  const jarAcc: any = await program.account.jar.fetch(jar);
  console.log("  stakeProtocol:", jarAcc.stakeProtocol, "(expected 2 = MarinadeSol)");

  // ---------------------------------------------------------------------------
  // STEP 3: Contribute 0.5 SOL
  // ---------------------------------------------------------------------------
  console.log("\nSTEP 3: contribute_sol (0.5 SOL)");
  const [contribution1] = PublicKey.findProgramAddressSync(
    [Buffer.from("contrib"), jar.toBuffer(), owner.publicKey.toBuffer()],
    PROGRAM_ID,
  );
  const sig3 = await program.methods
    .contributeSol(new BN(0.5 * LAMPORTS_PER_SOL))
    .accounts({
      donor: owner.publicKey,
      jar,
      contribution: contribution1,
      config,
      systemProgram: SystemProgram.programId,
    } as any)
    .remainingAccounts(marinadeContributeSolRemaining(jar))
    .rpc({ commitment: "confirmed" });
  console.log("  sig:", sig3);

  // ---------------------------------------------------------------------------
  // STEP 4: Contribute 0.5 SOL again (update existing contribution)
  // ---------------------------------------------------------------------------
  console.log("\nSTEP 4: contribute_sol again (0.5 SOL, same donor)");
  const sig4 = await program.methods
    .contributeSol(new BN(0.5 * LAMPORTS_PER_SOL))
    .accounts({
      donor: owner.publicKey,
      jar,
      contribution: contribution1,
      config,
      systemProgram: SystemProgram.programId,
    } as any)
    .remainingAccounts(marinadeContributeSolRemaining(jar))
    .rpc({ commitment: "confirmed" });
  console.log("  sig:", sig4);

  // ---------------------------------------------------------------------------
  // STEP 5: Assert mSOL ATA balance > 0
  // ---------------------------------------------------------------------------
  console.log("\nSTEP 5: assert mSOL ATA balance > 0");
  const msolBalInfo = await conn.getTokenAccountBalance(msolAtaPubkey);
  const msolBal = Number(msolBalInfo.value.amount);
  console.log("  mSOL balance:", msolBalInfo.value.uiAmountString, "mSOL");
  if (msolBal === 0) {
    throw new Error("ASSERTION FAILED: mSOL ATA balance is 0 — Marinade deposit did not execute");
  }
  console.log("  PASS: mSOL ATA balance > 0");

  const jarAccFinal: any = await program.account.jar.fetch(jar);
  console.log("  jar.principalTotal:", jarAccFinal.principalTotal.toString(), "lamports");
  console.log("  jar.sharesTotal:", jarAccFinal.sharesTotal.toString(), "mSOL lamports");

  const contrib1Acc: any = await program.account.contribution.fetch(contribution1);
  console.log("  contribution.shares:", contrib1Acc.shares.toString());

  // ---------------------------------------------------------------------------
  // STEP 6: Optional withdraw after unlock
  // ---------------------------------------------------------------------------
  const shouldWithdraw = lockSeconds <= 300; // only auto-wait if lock is short (<=5 min)
  if (shouldWithdraw) {
    const nowSec = Math.floor(Date.now() / 1000);
    const waitSec = unlockTimestamp.toNumber() - nowSec + 2;
    if (waitSec > 0) {
      console.log(`\nSTEP 6: waiting ${waitSec}s for lock to expire...`);
      await sleep(waitSec * 1000);
    }

    console.log("\nSTEP 6: withdraw (liquid_unstake)");
    const ownerBefore = await conn.getBalance(owner.publicKey);

    const sig6 = await program.methods
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
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(marinadeUnstakeRemaining(jar))
      .rpc({ commitment: "confirmed" });
    console.log("  sig:", sig6);

    const ownerAfter = await conn.getBalance(owner.publicKey);
    const delta = ownerAfter - ownerBefore;
    console.log("  SOL delta:", (delta / LAMPORTS_PER_SOL).toFixed(6), "SOL");
    console.log("  (expected ~0.97 SOL after ~1 SOL principal minus Marinade unstake fee ~0.3%)");

    const jarAccWithdrawn: any = await program.account.jar.fetch(jar);
    console.log("  jar.status:", JSON.stringify(jarAccWithdrawn.status));
  } else {
    console.log(`\nSTEP 6: SKIPPED (lock=${lockSeconds}s > 300s; run again with a shorter lock or wait manually)`);
    console.log(`  Unlock at: ${new Date(unlockTimestamp.toNumber() * 1000).toISOString()}`);
  }

  console.log("\nSmoke complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
