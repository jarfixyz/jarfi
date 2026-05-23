/**
 * Kamino Lend — addresses captured 2026-05-06
 *
 * Mainnet:
 *   program:     KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
 *   market:      7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF   (Kamino "Main" market)
 *   reserve:     D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59   (USDC reserve)
 *   supply:      Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6   (liquidity_supply_vault, decoded from on-chain Reserve)
 *   coll_mint:   11111111111111111111111111111111   (Pubkey::default — main pool USDC reserve does NOT mint a cToken;
 *                                                   deposits flow through Obligations via
 *                                                   deposit_reserve_liquidity_and_obligation_collateral, not via
 *                                                   the standalone deposit_reserve_liquidity → kUSDC path.)
 *   usdc_mint:   EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 *
 *   Sanity-derived (would-be) PDAs if the reserve used the canonical seeds:
 *     reserve_liq_supply  PDA: JCdAwUu36ka4C9BjeZfMRSx549PmBSqEMzppjjzsMQRZ  (NOT the actual supply; not initialized)
 *     reserve_coll_mint   PDA: 847kVN2ycaJxTMz3XDjFKGpVRhE2PdwmDrugMBg7C318  (NOT initialized)
 *   These PDAs return null on getAccountInfo — confirming the main USDC reserve was created with
 *   keypair-backed vaults (older flow) and has no collateral mint.
 *
 * Devnet:
 *   program:     KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD   (the BPF program is deployed; verified executable)
 *   market:      not deployed — getProgramAccounts(KLend, dataSize=4656) returns [] on devnet.
 *                The mainnet "Main" market pubkey (7u3He...) is just a 2.5 SOL system-owned wallet on devnet.
 *   reserve / supply / coll_mint: n/a (no markets, no reserves).
 *   usdc_mint:   no canonical Kamino devnet USDC mint (Circle's devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
 *                exists but is not wired into any Kamino reserve since none exist).
 *
 * Instruction discriminators (8 bytes each, hex):
 *   refresh_reserve:             02da8aeb4fc91966   [2, 218, 138, 235, 79, 201, 25, 102]
 *   deposit_reserve_liquidity:   a9c91e7e06cd6644   [169, 201, 30, 126, 6, 205, 102, 68]
 *   redeem_reserve_collateral:   ea75b57db98edc1d   [234, 117, 181, 125, 185, 142, 220, 29]
 *   (computed as first 8 bytes of sha256("global:<snake_case_method>"); klend uses Anchor sighash convention.)
 *
 * Sources:
 *   - https://github.com/Kamino-Finance/klend  (declare_id! production = KLend2g3cP87...; staging = SLendK7y...)
 *   - https://github.com/kamino-finance/klend-sdk README (main market = 7u3He...PfF)
 *   - kamino.com/lending/reserve/7u3He…/D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 (USDC reserve)
 *   - On-chain decode of Reserve account at D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 via mainnet RPC
 *     (offsets: 8 disc + 8 version + 16 last_update + 8 pad → 32 lending_market, 64 farm_coll, 96 farm_debt,
 *     128 liquidity{mint, supply_vault, fee_vault, …}, then +376+1200 → collateral{mint, …}).
 *   - klend programs/klend/src/utils/seeds.rs (LIQUIDITY_VAULT="reserve_liq_supply", COLL_MINT="reserve_coll_mint").
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PAYER = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8")),
  ),
);

// From Task 0.1 findings (mainnet — devnet has no Kamino markets).
const KAMINO_PROGRAM = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const RESERVE = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
const SUPPLY = new PublicKey("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6");
// NOTE: zero pubkey on the main USDC reserve. Standalone deposit_reserve_liquidity is not viable here.
const COLL_MINT = new PublicKey("11111111111111111111111111111111");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// PDA: lending_market_authority — seeds: ["lma", lending_market]
const [LENDING_MARKET_AUTH] = PublicKey.findProgramAddressSync(
  [Buffer.from("lma"), MARKET.toBuffer()],
  KAMINO_PROGRAM,
);

// Anchor discriminators (sha256("global:<name>")[0..8]).
const DISC_REFRESH_RESERVE = Buffer.from([2, 218, 138, 235, 79, 201, 25, 102]);
const DISC_DEPOSIT_RESERVE_LIQUIDITY = Buffer.from([169, 201, 30, 126, 6, 205, 102, 68]);
const DISC_REDEEM_RESERVE_COLLATERAL = Buffer.from([234, 117, 181, 125, 185, 142, 220, 29]);

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

/** refresh_reserve: no args. */
function ixRefreshReserve(): TransactionInstruction {
  return new TransactionInstruction({
    programId: KAMINO_PROGRAM,
    keys: [
      { pubkey: RESERVE, isSigner: false, isWritable: true },
      { pubkey: MARKET, isSigner: false, isWritable: false },
      // Optional oracle accounts — pass program id as the "None" sentinel per klend convention.
      { pubkey: KAMINO_PROGRAM, isSigner: false, isWritable: false }, // pyth_oracle (None)
      { pubkey: KAMINO_PROGRAM, isSigner: false, isWritable: false }, // switchboard_price_oracle (None)
      { pubkey: KAMINO_PROGRAM, isSigner: false, isWritable: false }, // switchboard_twap_oracle (None)
      { pubkey: KAMINO_PROGRAM, isSigner: false, isWritable: false }, // scope_prices (None)
    ],
    data: DISC_REFRESH_RESERVE,
  });
}

/** deposit_reserve_liquidity(liquidity_amount: u64). */
function ixDepositReserveLiquidity(
  owner: PublicKey,
  ownerLiquidityAta: PublicKey,
  ownerCollateralAta: PublicKey,
  amount: bigint,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: KAMINO_PROGRAM,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: RESERVE, isSigner: false, isWritable: true },
      { pubkey: MARKET, isSigner: false, isWritable: false },
      { pubkey: LENDING_MARKET_AUTH, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SUPPLY, isSigner: false, isWritable: true },
      { pubkey: COLL_MINT, isSigner: false, isWritable: true },
      { pubkey: ownerLiquidityAta, isSigner: false, isWritable: true },
      { pubkey: ownerCollateralAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC_DEPOSIT_RESERVE_LIQUIDITY, u64LE(amount)]),
  });
}

/** redeem_reserve_collateral(collateral_amount: u64). */
function ixRedeemReserveCollateral(
  owner: PublicKey,
  ownerLiquidityAta: PublicKey,
  ownerCollateralAta: PublicKey,
  amount: bigint,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: KAMINO_PROGRAM,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: MARKET, isSigner: false, isWritable: false },
      { pubkey: LENDING_MARKET_AUTH, isSigner: false, isWritable: false },
      { pubkey: RESERVE, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: COLL_MINT, isSigner: false, isWritable: true },
      { pubkey: SUPPLY, isSigner: false, isWritable: true },
      { pubkey: ownerCollateralAta, isSigner: false, isWritable: true },
      { pubkey: ownerLiquidityAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC_REDEEM_RESERVE_COLLATERAL, u64LE(amount)]),
  });
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  console.log("RPC:", RPC);
  console.log("payer:", PAYER.publicKey.toBase58());

  // Pre-flight: does Kamino have any market on this cluster?
  const klendAcc = await conn.getAccountInfo(KAMINO_PROGRAM);
  if (!klendAcc || !klendAcc.executable) {
    console.error("BLOCKED: Kamino program not deployed on this cluster.");
    process.exit(2);
  }
  const reserveAcc = await conn.getAccountInfo(RESERVE);
  if (!reserveAcc) {
    console.error(
      "BLOCKED: USDC reserve does not exist on this cluster. Kamino has no devnet markets.",
    );
    console.error("See SPIKE RESULT block at the bottom of this file.");
    process.exit(3);
  }

  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, PAYER.publicKey);
  const collAta = getAssociatedTokenAddressSync(COLL_MINT, PAYER.publicKey);
  const startUsdc = await getAccount(conn, usdcAta)
    .then((a) => a.amount)
    .catch(() => 0n);
  console.log("start USDC (raw):", startUsdc.toString());

  const depositAmount = 1_000_000n; // 1 USDC

  const depositTx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(
      createAssociatedTokenAccountIdempotentInstruction(
        PAYER.publicKey,
        collAta,
        PAYER.publicKey,
        COLL_MINT,
      ),
    )
    .add(ixRefreshReserve())
    .add(ixDepositReserveLiquidity(PAYER.publicKey, usdcAta, collAta, depositAmount));

  console.log("sending deposit…");
  const depSig = await sendAndConfirmTransaction(conn, depositTx, [PAYER], {
    commitment: "confirmed",
  });
  console.log("deposit sig:", depSig);

  const collBal = await getAccount(conn, collAta).then((a) => a.amount);
  console.log("kUSDC received:", collBal.toString());

  console.log("waiting 30s for accrual…");
  await new Promise((r) => setTimeout(r, 30_000));

  const redeemTx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(ixRefreshReserve())
    .add(ixRedeemReserveCollateral(PAYER.publicKey, usdcAta, collAta, collBal));

  console.log("sending redeem…");
  const redSig = await sendAndConfirmTransaction(conn, redeemTx, [PAYER], {
    commitment: "confirmed",
  });
  console.log("redeem sig:", redSig);

  const endUsdc = await getAccount(conn, usdcAta).then((a) => a.amount);
  console.log("end USDC (raw):", endUsdc.toString());
  console.log("delta:", (endUsdc - startUsdc).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// === SPIKE RESULT (2026-05-06) ===
// DEVNET NOT VIABLE.
//
// Two independent blockers found:
//
// 1) Kamino has no lending markets deployed on devnet. The klend BPF program at
//    KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD IS uploaded on devnet (executable=true), but
//    `getProgramAccounts(KLend, dataSize=4656)` returns []. The mainnet "Main" market pubkey
//    7u3He…PfF is just a system-owned 2.5 SOL wallet on devnet — not a LendingMarket account.
//    No reserves, no supply vaults, no test USDC liquidity. There is no documented Kamino
//    devnet faucet/market in the klend or klend-sdk repos.
//
// 2) Even on mainnet, the canonical USDC main-pool reserve (D6q6wu…BmgJ59) was created with
//    `collateral.mint_pubkey == Pubkey::default()` (decoded directly from the on-chain Reserve
//    account: offset 1704 = all zeros). That means the standalone `deposit_reserve_liquidity`
//    → mint kUSDC → `redeem_reserve_collateral` flow this spike was designed to validate is
//    NOT supported on the main USDC reserve. The current Kamino main pool routes deposits
//    through Obligations via `deposit_reserve_liquidity_and_obligation_collateral` (and the
//    matching withdraw) — there is no cToken in the user's wallet at any point.
//
// The script was therefore not executed end-to-end on devnet; the pre-flight check exits with
// code 3 because the reserve account does not exist on devnet. On mainnet the deposit ix would
// fail at the `reserve_collateral_mint` account check (zero pubkey ≠ a valid mint).
//
// Decision: build Mock Kamino in Phase 3.
//   - The Mock Kamino can keep the Phase-2 jarfi CPI helper signature simple
//     (refresh + deposit + redeem, with a real cToken mint) and let us iterate on devnet.
//   - For the Phase 7 mainnet smoke test we will need to either:
//       (a) target a different Kamino reserve that DOES expose a cToken collateral mint
//           (verify by decoding the Reserve account's collateral.mint_pubkey before use), OR
//       (b) switch the jarfi CPI helper to the obligation-based flow
//           (`deposit_reserve_liquidity_and_obligation_collateral` +
//            `withdraw_obligation_collateral_and_redeem_reserve_collateral`) — this is a bigger
//           helper because it needs an Obligation PDA per jar.
//   - The 3 discriminators captured above remain valid for klend regardless of which path we pick;
//     option (b) just adds two more discriminators to derive when we get there.
//
// Mainnet addresses captured here are still the correct anchor points for a future Phase 7
// smoke test once the helper path is decided.
