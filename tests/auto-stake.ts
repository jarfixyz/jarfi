/**
 * Phase 4 — auto-stake integration tests against MarginFi devnet.
 *
 * RUN MANUALLY (not via `anchor test`/localnet):
 *
 *   ANCHOR_WALLET=$HOME/.config/solana/id.json \
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   AUTO_STAKE_DEVNET=1 \
 *   pnpm ts-mocha -p tsconfig.json -t 1000000 tests/auto-stake.ts
 *
 * Without `AUTO_STAKE_DEVNET=1` the suite is skipped so it does not break
 * `pnpm test:program` (which spins up a localnet validator that has neither
 * the MarginFi devnet program nor the F9j USDC mint).
 *
 * Pre-conditions (already done in the operator runbook for this devnet):
 *   - jarfi program redeployed at the latest `target/deploy/jarfi.so`
 *   - `scripts/migrate-config-v3.ts` has resized the Config account to V3
 *   - `scripts/setup-devnet-config.ts` has written the MarginFi addresses and
 *     enabled `auto_stake_enabled = true`
 *   - The deployer wallet (`~/.config/solana/id.json`) has at least 1000 F9j
 *     USDC at its ATA and 5+ SOL.
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
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { MARINADE, jarMsolAta } from "./helpers";
import * as fs from "fs";
import * as os from "os";
import { Jarfi } from "../target/types/jarfi";

// ---------------------------------------------------------------------------
// Suite-level skip: only run with AUTO_STAKE_DEVNET=1 set.
// ---------------------------------------------------------------------------
const SHOULD_RUN = process.env.AUTO_STAKE_DEVNET === "1";

// ---------------------------------------------------------------------------
// Devnet MarginFi addresses (Phase 0 spike).
// ---------------------------------------------------------------------------
export const MARGINFI_PROGRAM = new PublicKey("A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4");
export const MARGINFI_GROUP = new PublicKey("52NC7T3NTPFFwoxJDFk9mbKcA7675DJ39H1iPNz5RjSV");
export const USDC_BANK = new PublicKey("GhV6ZftLXv3o38CHMhX6nu8GkxS3kvrHSSCVpGFTysUC");
export const USDC_MINT = new PublicKey("F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd");
export const FAUCET_PROGRAM = new PublicKey("4bXpkKSV8swHSnwqtzuboGPaPDeEgAn4Vt8GfarV5rZt");
export const FAUCET_MINT_AUTHORITY = new PublicKey("Fx1bCAyYpLMPVAjfq1pxbqKKkvDR3iYEpam1KbThRDYQ");
export const FAUCET_CONFIG = new PublicKey("3ThaREisq3etoy9cvdzRgKypHsa8iTjMxj19AjETA1Fy");

// USDC bank's Pyth oracle on devnet (decoded from bank.config.oracle_keys[0]).
// Required as an extra remaining_account by MarginFi's withdraw ix for risk-engine
// price lookup. Not needed for deposit.
export const USDC_BANK_ORACLE = new PublicKey("5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7");

export const CU_BUDGET = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

// ---------------------------------------------------------------------------
// PDA helpers
// ---------------------------------------------------------------------------
export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}
export function treasuryPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury")], programId)[0];
}
export function userStatePda(owner: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("user"), owner.toBuffer()], programId)[0];
}
export function jarPda(owner: PublicKey, id: BN, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("jar"), owner.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId,
  );
}
export function contributionPda(jar: PublicKey, donor: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("contrib"), jar.toBuffer(), donor.toBuffer()],
    programId,
  )[0];
}
export function marginfiAccountPda(jar: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("marginfi"), jar.toBuffer()], programId)[0];
}
export function bankLiquidityVaultPda(bank: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_vault"), bank.toBuffer()],
    MARGINFI_PROGRAM,
  )[0];
}
export function bankLiquidityVaultAuthorityPda(bank: PublicKey): PublicKey {
  // MarginFi 0.1.2 seed is "liquidity_vault_auth" (16 chars), NOT "liquidity_vault_authority".
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_vault_auth"), bank.toBuffer()],
    MARGINFI_PROGRAM,
  )[0];
}

// ---------------------------------------------------------------------------
// remaining_accounts builders for create / deposit / withdraw branches.
// ---------------------------------------------------------------------------
export function createJarRemainingAccounts(jar: PublicKey, programId: PublicKey) {
  return [
    { pubkey: MARGINFI_PROGRAM, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccountPda(jar, programId), isWritable: true, isSigner: false },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
  ];
}
export function depositRemainingAccounts(jar: PublicKey, programId: PublicKey) {
  return [
    { pubkey: MARGINFI_PROGRAM, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccountPda(jar, programId), isWritable: true, isSigner: false },
    { pubkey: USDC_BANK, isWritable: true, isSigner: false },
    { pubkey: bankLiquidityVaultPda(USDC_BANK), isWritable: true, isSigner: false },
  ];
}
export function withdrawRemainingAccounts(jar: PublicKey, programId: PublicKey) {
  return [
    { pubkey: MARGINFI_PROGRAM, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccountPda(jar, programId), isWritable: true, isSigner: false },
    { pubkey: USDC_BANK, isWritable: true, isSigner: false },
    { pubkey: bankLiquidityVaultAuthorityPda(USDC_BANK), isWritable: true, isSigner: false },
    { pubkey: bankLiquidityVaultPda(USDC_BANK), isWritable: true, isSigner: false },
    // Forwarded into MarginFi's withdraw `remaining_accounts` for the risk
    // engine. For each active balance, MarginFi expects (bank, oracle) pairs.
    { pubkey: USDC_BANK, isWritable: false, isSigner: false },
    { pubkey: USDC_BANK_ORACLE, isWritable: false, isSigner: false },
  ];
}

// ---------------------------------------------------------------------------
// Funding helpers — drip USDC and SOL from the deployer wallet to test donors.
// ---------------------------------------------------------------------------
function loadDeployer(): Keypair {
  const path = process.env.ANCHOR_WALLET ?? `${os.homedir()}/.config/solana/id.json`;
  const secret = JSON.parse(fs.readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function ensureDeployerHasUsdc(conn: Connection, deployer: Keypair, minAmount: bigint): Promise<void> {
  const ata = getAssociatedTokenAddressSync(USDC_MINT, deployer.publicKey);
  const bal = await conn.getTokenAccountBalance(ata).catch(() => null);
  const have = bal ? BigInt(bal.value.amount) : 0n;
  if (have >= minAmount) return;

  // Top up by spawning the existing mint script.
  // (The faucet program mints 1000 USDC per call; loop until enough.)
  while (true) {
    const amount = 1_000_000_000n; // 1000 USDC
    const data = Buffer.alloc(9);
    data.writeUInt8(1, 0);
    data.writeBigUInt64LE(amount, 1);
    const tx = new Transaction()
      .add(createAssociatedTokenAccountIdempotentInstruction(deployer.publicKey, ata, deployer.publicKey, USDC_MINT))
      .add({
        programId: FAUCET_PROGRAM,
        keys: [
          { pubkey: FAUCET_MINT_AUTHORITY, isWritable: false, isSigner: false },
          { pubkey: USDC_MINT, isWritable: true, isSigner: false },
          { pubkey: ata, isWritable: true, isSigner: false },
          { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
          { pubkey: FAUCET_CONFIG, isWritable: false, isSigner: false },
        ],
        data,
      } as any);
    await anchor.web3.sendAndConfirmTransaction(conn, tx, [deployer]);
    const b = await conn.getTokenAccountBalance(ata);
    if (BigInt(b.value.amount) >= minAmount) return;
  }
}

export async function fundSol(conn: Connection, deployer: Keypair, recipient: PublicKey, sol: number): Promise<void> {
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: deployer.publicKey,
    toPubkey: recipient,
    lamports: Math.floor(sol * LAMPORTS_PER_SOL),
  }));
  await anchor.web3.sendAndConfirmTransaction(conn, tx, [deployer]);
}

export async function fundDevnetUsdc(
  conn: Connection,
  deployer: Keypair,
  recipient: PublicKey,
  amount: bigint,
): Promise<PublicKey> {
  await ensureDeployerHasUsdc(conn, deployer, amount + 1n);
  const fromAta = getAssociatedTokenAddressSync(USDC_MINT, deployer.publicKey);
  const toAta = getAssociatedTokenAddressSync(USDC_MINT, recipient);
  const tx = new Transaction()
    .add(createAssociatedTokenAccountIdempotentInstruction(deployer.publicKey, toAta, recipient, USDC_MINT))
    .add(createTransferCheckedInstruction(fromAta, USDC_MINT, toAta, deployer.publicKey, amount, 6));
  await anchor.web3.sendAndConfirmTransaction(conn, tx, [deployer]);
  return toAta;
}

export async function usdcBalance(conn: Connection, owner: PublicKey, allowOwnerOff = false): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(USDC_MINT, owner, allowOwnerOff);
  const acc = await conn.getAccountInfo(ata);
  if (!acc) return 0n;
  const b = await conn.getTokenAccountBalance(ata);
  return BigInt(b.value.amount);
}

// ---------------------------------------------------------------------------
// User-state helper: idempotent init for a fresh keypair.
// ---------------------------------------------------------------------------
export async function ensureUserState(
  program: Program<Jarfi>,
  owner: Keypair,
): Promise<{ userState: PublicKey; jarCount: BN }> {
  const userState = userStatePda(owner.publicKey, program.programId);
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

export function hash32(seed: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(seed.padEnd(32, "x")).copy(buf, 0, 0, 32);
  return Array.from(buf);
}

// ---------------------------------------------------------------------------
// Suite (gated). Phase 4 tasks 4.2–4.5 attach `it(...)` cases below.
// ---------------------------------------------------------------------------
const desc = SHOULD_RUN ? describe : describe.skip;

desc("auto-stake (devnet, MarginFi)", function () {
  this.timeout(180_000);

  const baseProvider = anchor.AnchorProvider.env();
  // Force confirmed commitment + skipPreflight=false; devnet's processed RPC
  // sometimes returns "Blockhash not found" mid-simulation.
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

  before(async () => {
    deployer = loadDeployer();
    const cfg = await program.account.config.fetch(configPda(program.programId));
    if (!cfg.autoStakeEnabled) {
      throw new Error(
        "Devnet config has auto_stake_enabled=false. Run scripts/setup-devnet-config.ts first.",
      );
    }
  });

  it("smoke: deployer is funded and config is wired", async () => {
    const sol = await conn.getBalance(deployer.publicKey);
    expect(sol).to.be.greaterThan(LAMPORTS_PER_SOL);
    const usdc = await usdcBalance(conn, deployer.publicKey);
    expect(usdc > 10_000_000n).to.equal(true); // >= 10 USDC
    const cfg: any = await program.account.config.fetch(configPda(program.programId));
    expect(cfg.allowedUsdcMint.toBase58()).to.equal(USDC_MINT.toBase58());
    expect(cfg.marginfiProgram.toBase58()).to.equal(MARGINFI_PROGRAM.toBase58());
    expect(cfg.marginfiUsdcBank.toBase58()).to.equal(USDC_BANK.toBase58());
  });

  it("create_jar(auto_stake=true) initializes marginfi_account; contribute_spl deposits into bank", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.2);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program.programId);
    const jarVault = getAssociatedTokenAddressSync(USDC_MINT, jar, true);

    const sig = await program.methods
      .createJar(
        { flexible: {} } as any,
        { usdc: {} } as any,
        new BN(1_000_000_000), // 1000 USDC goal
        new BN(0),
        "https://r2.jarfi.app/metadata/auto-stake-test.json",
        hash32("auto-stake-create-1"),
        true, // auto_stake
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault,
        vaultMint: USDC_MINT,
        config: configPda(program.programId),
        treasury: treasuryPda(program.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(createJarRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    console.log("    create_jar sig:", sig);

    const jarAcc: any = await program.account.jar.fetch(jar);
    expect(jarAcc.autoStake).to.equal(true);
    expect(jarAcc.stakeProtocol).to.equal(1);
    expect(jarAcc.principalTotal.toString()).to.equal("0");
    expect(jarAcc.sharesTotal.toString()).to.equal("0");
    const expectedMfiAcc = marginfiAccountPda(jar, program.programId);
    expect(jarAcc.marginfiAccount.toBase58()).to.equal(expectedMfiAcc.toBase58());

    // marginfi_account should have been initialized on-chain (owned by mfi prog).
    const mfiInfo = await conn.getAccountInfo(expectedMfiAcc);
    expect(mfiInfo, "marginfi_account exists").to.not.be.null;
    expect(mfiInfo!.owner.toBase58()).to.equal(MARGINFI_PROGRAM.toBase58());

    // Contribute 50 USDC.
    const donor = Keypair.generate();
    await fundSol(conn, deployer, donor.publicKey, 0.05);
    const donorAta = await fundDevnetUsdc(conn, deployer, donor.publicKey, 50_000_000n);
    const contrib = contributionPda(jar, donor.publicKey, program.programId);
    const sig2 = await program.methods
      .contributeSpl(new BN(50_000_000))
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution: contrib,
        config: configPda(program.programId),
        donorTokenAccount: donorAta,
        jarVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(depositRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([donor])
      .rpc({ commitment: "confirmed" });
    console.log("    contribute_spl sig:", sig2);

    const jarAfter: any = await program.account.jar.fetch(jar);
    expect(jarAfter.principalTotal.toString()).to.equal("50000000");
    expect(jarAfter.totalContributed.toString()).to.equal("50000000");
    expect(jarAfter.sharesTotal.toNumber()).to.be.greaterThan(0);

    const contribAcc: any = await program.account.contribution.fetch(contrib);
    expect(contribAcc.amount.toString()).to.equal("50000000");
    expect(contribAcc.shares.toNumber()).to.be.greaterThan(0);
    console.log("    contribution.shares:", contribAcc.shares.toString());
    console.log("    jar.sharesTotal:    ", (await program.account.jar.fetch(jar) as any).sharesTotal.toString());

    // Jar vault USDC should be near zero (deposited into MarginFi).
    const vaultBal = await conn.getTokenAccountBalance(jarVault);
    expect(vaultBal.value.amount).to.equal("0");

    // Persist for downstream tests in this file run.
    (global as any).__autoStakeTest__ = { owner, jar, donor, jarVault, contrib };
  });

  // KNOWN BLOCKER (devnet, external): the deployed MarginFi program at
  // `A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4` is built from
  // `marginfi-program-v1.0.0` (NOT `mrgn-0.1.2` and NOT `main`). In that error
  // enum, `Custom(6017)` is `StaleOracle`, not `BankReduceOnly`. The USDC
  // bank's Pyth oracle (`5SSk…Xgy7`) has been frozen at publish_time
  // 2024-08-30 for over a year, while the bank's `oracle_max_age` is 0 which
  // resolves to the default 60s for Pyth. So `lending_account_withdraw`
  // unconditionally fails inside `RiskEngine::check_account_init_health` once
  // it tries to fetch the price feed for our active USDC balance.
  //
  // The deposit path works because v1.0.0's `lending_account_deposit` does
  // not call the risk engine after a deposit (deposits cannot make an account
  // unhealthy). Withdrawal cannot be unblocked from our side: we don't own
  // the bank, the oracle is external, and the group admin is the program
  // upgrade authority `3xo9…v55W`, not our deployer. Refresh of the Pyth
  // feed or admin reconfiguration of the bank's oracle is required before
  // these tests can pass.
  //
  // Flip AUTO_STAKE_DEVNET_WITHDRAW=1 to attempt the CPI once that external
  // dependency is resolved.
  const itw = process.env.AUTO_STAKE_DEVNET_WITHDRAW === "1" ? it : it.skip;

  itw("refund returns principal (yield ~0 on quiet devnet)", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.2);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program.programId);
    const jarVault = getAssociatedTokenAddressSync(USDC_MINT, jar, true);

    const unlock = new BN(Math.floor(Date.now() / 1000) + 24 * 3600);

    await program.methods
      .createJar(
        { timeLocked: {} } as any,
        { usdc: {} } as any,
        new BN(1_000_000_000),
        unlock,
        "https://r2.jarfi.app/metadata/auto-stake-refund.json",
        hash32("auto-stake-refund-1"),
        true,
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault,
        vaultMint: USDC_MINT,
        config: configPda(program.programId),
        treasury: treasuryPda(program.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(createJarRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const donor = Keypair.generate();
    await fundSol(conn, deployer, donor.publicKey, 0.05);
    const donorAta = await fundDevnetUsdc(conn, deployer, donor.publicKey, 50_000_000n);
    const contrib = contributionPda(jar, donor.publicKey, program.programId);

    await program.methods
      .contributeSpl(new BN(50_000_000))
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution: contrib,
        config: configPda(program.programId),
        donorTokenAccount: donorAta,
        jarVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(depositRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Cancel (only valid pre-unlock for TimeLocked).
    await program.methods
      .cancelJar()
      .accounts({ owner: owner.publicKey, jar } as any)
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const donorBefore = await usdcBalance(conn, donor.publicKey);

    await program.methods
      .refund()
      .accounts({
        payer: donor.publicKey,
        jar,
        donor: donor.publicKey,
        contribution: contrib,
        jarVault,
        donorTokenAccount: donorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(withdrawRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    const donorAfter = await usdcBalance(conn, donor.publicKey);
    const received = Number(donorAfter - donorBefore);
    console.log("    refund received:", received, "lamports of USDC");
    // Allow 1 USDC lamport tolerance for I80F48 rounding on quiet devnet.
    expect(received).to.be.greaterThanOrEqual(49_999_990);
    expect(received).to.be.lessThanOrEqual(50_000_010);

    const jarAfter: any = await program.account.jar.fetch(jar);
    expect(jarAfter.principalTotal.toString()).to.equal("0");
    expect(jarAfter.sharesTotal.toString()).to.equal("0");
  });

  // Same gating as the refund test: this exercises the withdraw_all CPI which
  // hits the same `BankReduceOnly` quirk on the deployed marginfi program until
  // we forward the additional accounts the newer withdraw flow expects.
  itw("successful withdraw drains MarginFi shares and pays creator + treasury fee", async () => {
    // Set withdrawFeeBps to 200 (already 250 by default — keep whatever the admin has).
    const cfg: any = await program.account.config.fetch(configPda(program.programId));
    const withdrawFeeBps = Number(cfg.withdrawFeeBps);

    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.2);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program.programId);
    const jarVault = getAssociatedTokenAddressSync(USDC_MINT, jar, true);

    await program.methods
      .createJar(
        { flexible: {} } as any,
        { usdc: {} } as any,
        new BN(50_000_000),
        new BN(0),
        "https://r2.jarfi.app/metadata/auto-stake-withdraw.json",
        hash32("auto-stake-withdraw-1"),
        true,
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault,
        vaultMint: USDC_MINT,
        config: configPda(program.programId),
        treasury: treasuryPda(program.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(createJarRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const donor = Keypair.generate();
    await fundSol(conn, deployer, donor.publicKey, 0.05);
    const donorAta = await fundDevnetUsdc(conn, deployer, donor.publicKey, 50_000_000n);
    const contrib = contributionPda(jar, donor.publicKey, program.programId);

    await program.methods
      .contributeSpl(new BN(50_000_000))
      .accounts({
        donor: donor.publicKey,
        jar,
        contribution: contrib,
        config: configPda(program.programId),
        donorTokenAccount: donorAta,
        jarVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(depositRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Owner ATA + treasury ATA must exist as writable accounts.
    const ownerAta = getAssociatedTokenAddressSync(USDC_MINT, owner.publicKey);
    const treasury = treasuryPda(program.programId);
    const treasuryAta = getAssociatedTokenAddressSync(USDC_MINT, treasury, true);
    const initTx = new Transaction()
      .add(createAssociatedTokenAccountIdempotentInstruction(deployer.publicKey, ownerAta, owner.publicKey, USDC_MINT))
      .add(createAssociatedTokenAccountIdempotentInstruction(deployer.publicKey, treasuryAta, treasury, USDC_MINT));
    await anchor.web3.sendAndConfirmTransaction(conn, initTx, [deployer]);

    const ownerBefore = await usdcBalance(conn, owner.publicKey);
    const treasuryBefore = await usdcBalance(conn, treasury, true);

    await program.methods
      .withdraw(null)
      .accounts({
        owner: owner.publicKey,
        jar,
        config: configPda(program.programId),
        treasury,
        jarVault,
        ownerTokenAccount: ownerAta,
        treasuryTokenAccount: treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(withdrawRemainingAccounts(jar, program.programId))
      .preInstructions([CU_BUDGET])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const ownerAfter = await usdcBalance(conn, owner.publicKey);
    const treasuryAfter = await usdcBalance(conn, treasury, true);
    const ownerDelta = Number(ownerAfter - ownerBefore);
    const treasuryDelta = Number(treasuryAfter - treasuryBefore);
    const gross = ownerDelta + treasuryDelta;
    console.log("    gross:", gross, "owner:", ownerDelta, "treasury:", treasuryDelta);
    // Expect ~50 USDC gross with tiny rounding tolerance.
    expect(gross).to.be.greaterThanOrEqual(49_999_990);
    expect(gross).to.be.lessThanOrEqual(50_000_010);
    const expectedFee = Math.floor(gross * (withdrawFeeBps / 10_000));
    expect(Math.abs(treasuryDelta - expectedFee)).to.be.lessThanOrEqual(2);
  });

  it("guard rails: rejects auto_stake on SOL jars (AutoStakeUnsupportedAsset)", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.1);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program.programId);

    let threw = false;
    try {
      await program.methods
        .createJar(
          { flexible: {} } as any,
          { sol: {} } as any,
          new BN(LAMPORTS_PER_SOL),
          new BN(0),
          "https://r2.jarfi.app/metadata/auto-stake-sol-reject.json",
          hash32("auto-stake-sol-reject"),
          true,
        )
        .accounts({
          owner: owner.publicKey,
          userState,
          jar,
          jarVault: null,
          vaultMint: null,
          config: configPda(program.programId),
          treasury: treasuryPda(program.programId),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts(createJarRemainingAccounts(jar, program.programId))
        .preInstructions([CU_BUDGET])
        .signers([owner])
        .rpc({ commitment: "confirmed" });
    } catch (e: any) {
      threw = true;
      const msg = (e?.message ?? String(e)).toString();
      expect(msg).to.match(/AutoStakeUnsupportedAsset|WrongAsset/);
    }
    expect(threw).to.equal(true);
  });

  it("guard rails: a non-auto-stake USDC jar still works unchanged", async () => {
    const owner = Keypair.generate();
    await fundSol(conn, deployer, owner.publicKey, 0.2);
    const { userState, jarCount } = await ensureUserState(program, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program.programId);
    const jarVault = getAssociatedTokenAddressSync(USDC_MINT, jar, true);

    await program.methods
      .createJar(
        { flexible: {} } as any,
        { usdc: {} } as any,
        new BN(10_000_000),
        new BN(0),
        "https://r2.jarfi.app/metadata/non-auto-stake-usdc.json",
        hash32("non-auto-stake-usdc"),
        false, // auto_stake = false
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault,
        vaultMint: USDC_MINT,
        config: configPda(program.programId),
        treasury: treasuryPda(program.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .preInstructions([CU_BUDGET])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const jarAcc: any = await program.account.jar.fetch(jar);
    expect(jarAcc.autoStake).to.equal(false);
    expect(jarAcc.stakeProtocol).to.equal(0);
    expect(jarAcc.sharesTotal.toString()).to.equal("0");
    expect(jarAcc.marginfiAccount.toBase58()).to.equal(PublicKey.default.toBase58());
  });
});

// ---------------------------------------------------------------------------
// Marinade SOL auto-stake gate tests
//
// These tests exercise create_jar guard rails that fire BEFORE any CPI, so
// they do not require the Marinade program to be present in the validator.
// They run on localnet alongside the numbered test suite.
//
// Gating: same AUTO_STAKE_DEVNET=1 env var as the MarginFi suite above so that
// they only run in environments with the jarfi program deployed.
// ---------------------------------------------------------------------------

const descGates = SHOULD_RUN ? describe : describe.skip;

descGates("Marinade SOL auto-stake gates", function () {
  this.timeout(120_000);

  const baseProvider = anchor.AnchorProvider.env();
  const conn2 = new Connection(baseProvider.connection.rpcEndpoint, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
  const provider2 = new anchor.AnchorProvider(conn2, baseProvider.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  anchor.setProvider(provider2);
  const program2 = anchor.workspace.Jarfi as Program<Jarfi>;

  let deployer2: Keypair;

  before(async () => {
    deployer2 = loadDeployer();
  });

  // Test #1: Flexible + Sol + auto_stake → AutoStakeRequiresTimeLocked
  it("Flexible SOL + auto_stake rejects with AutoStakeRequiresTimeLocked", async () => {
    const owner = Keypair.generate();
    await fundSol(conn2, deployer2, owner.publicKey, 0.1);
    const { userState, jarCount } = await ensureUserState(program2, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program2.programId);

    let threw = false;
    try {
      await program2.methods
        .createJar(
          { flexible: {} } as any,
          { sol: {} } as any,
          new BN(LAMPORTS_PER_SOL),
          new BN(0),
          "https://r2.jarfi.app/metadata/gate-test-1.json",
          hash32("marinade-gate-1"),
          true, // auto_stake
        )
        .accounts({
          owner: owner.publicKey,
          userState,
          jar,
          jarVault: null,
          vaultMint: null,
          config: configPda(program2.programId),
          treasury: treasuryPda(program2.programId),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .preInstructions([CU_BUDGET])
        .signers([owner])
        .rpc({ commitment: "confirmed" });
    } catch (e: any) {
      threw = true;
      const msg = (e?.message ?? String(e)).toString();
      expect(msg).to.match(/AutoStakeRequiresTimeLocked/);
    }
    expect(threw, "expected AutoStakeRequiresTimeLocked error").to.equal(true);
  });

  // Test #2: TimeLocked + Sol + auto_stake with lock < min_auto_stake_lock_days*86400 →
  // AutoStakeLockTooShort (5-day lock against 30-day default threshold)
  it("TimeLocked SOL + auto_stake with 5-day lock rejects with AutoStakeLockTooShort", async () => {
    const owner = Keypair.generate();
    await fundSol(conn2, deployer2, owner.publicKey, 0.1);
    const { userState, jarCount } = await ensureUserState(program2, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program2.programId);

    const fiveDaysFromNow = new BN(Math.floor(Date.now() / 1000) + 5 * 86_400);

    let threw = false;
    try {
      await program2.methods
        .createJar(
          { timeLocked: {} } as any,
          { sol: {} } as any,
          new BN(LAMPORTS_PER_SOL),
          fiveDaysFromNow,
          "https://r2.jarfi.app/metadata/gate-test-2.json",
          hash32("marinade-gate-2"),
          true, // auto_stake
        )
        .accounts({
          owner: owner.publicKey,
          userState,
          jar,
          jarVault: null,
          vaultMint: null,
          config: configPda(program2.programId),
          treasury: treasuryPda(program2.programId),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .preInstructions([CU_BUDGET])
        .signers([owner])
        .rpc({ commitment: "confirmed" });
    } catch (e: any) {
      threw = true;
      const msg = (e?.message ?? String(e)).toString();
      expect(msg).to.match(/AutoStakeLockTooShort/);
    }
    expect(threw, "expected AutoStakeLockTooShort error").to.equal(true);
  });

  // Test #3: TimeLocked + Sol + auto_stake with lock >= threshold (31 days) →
  // jar.stakeProtocol == 2. Requires pre-creating the mSOL ATA.
  // SKIP: bankrun can't host Marinade state; covered by scripts/marinade-smoke.ts
  it.skip("TimeLocked SOL + auto_stake with 31-day lock sets stakeProtocol == 2 (requires devnet/clock-warp; covered by smoke)", async () => {
    const owner = Keypair.generate();
    await fundSol(conn2, deployer2, owner.publicKey, 0.5);
    const { userState, jarCount } = await ensureUserState(program2, owner);
    const [jar] = jarPda(owner.publicKey, jarCount, program2.programId);

    const thirtyOneDaysFromNow = new BN(Math.floor(Date.now() / 1000) + 31 * 86_400);
    const msolAtaPubkey = jarMsolAta(jar);

    const createAtaIx = createAssociatedTokenAccountInstruction(
      owner.publicKey,
      msolAtaPubkey,
      jar,
      MARINADE.msolMint,
    );

    await program2.methods
      .createJar(
        { timeLocked: {} } as any,
        { sol: {} } as any,
        new BN(LAMPORTS_PER_SOL),
        thirtyOneDaysFromNow,
        "https://r2.jarfi.app/metadata/gate-test-3.json",
        hash32("marinade-gate-3"),
        true, // auto_stake
      )
      .accounts({
        owner: owner.publicKey,
        userState,
        jar,
        jarVault: null,
        vaultMint: null,
        config: configPda(program2.programId),
        treasury: treasuryPda(program2.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .preInstructions([CU_BUDGET, createAtaIx])
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const jarAcc: any = await program2.account.jar.fetch(jar);
    expect(jarAcc.stakeProtocol).to.equal(2);
  });
});
