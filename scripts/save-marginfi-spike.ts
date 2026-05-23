/**
 * Save (Solend) and MarginFi devnet feasibility — addresses captured 2026-05-06
 *
 * This is a *read-only* inspection script. It does NOT submit any transactions.
 * It exists to document the addresses gathered during the second protocol-reselection
 * spike and to let anyone re-verify on-chain in one shot:
 *
 *   $ npx tsx scripts/save-marginfi-spike.ts
 *
 * ---------------------------------------------------------------------------
 *
 * Candidate A — Save / Solend  (cToken model: deposit_reserve_liquidity / redeem_reserve_collateral)
 *
 *   Mainnet:
 *     program:        So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo
 *     main market:    GvjoVKNjBvQcFaSKUW1gTE7DxhSpjHbE69umVR5nPuQp
 *     usdc reserve:   FNNkz4RCQezSSS71rW2tvqZH1LCkTzaiG7Nd1LeA5x5y
 *     usdc supply:    HixjFJoeD2ggqKgFHQxrcJFjVvE5nXKuUPYNijFg7Kc5
 *     usdc cMint:     E2PSSXsXJGdpqhhaV3rYPpuy1inRCQAWxcdykA1DTmYr
 *     usdc mint:      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 *     (source: https://api.solend.fi/v1/markets/configs)
 *
 *   Devnet:
 *     program:        NOT DEPLOYED.  getAccountInfo(So1end…CpAo, devnet) → null.
 *                     (Verified 2026-05-06 via `solana program show … --url devnet`.)
 *                     No alternate Solend devnet program ID is published in the official Save
 *                     Solana program library, the docs site (docs.save.finance), or the
 *                     api.solend.fi market-config endpoint. Both `deployment=devnet` and
 *                     `deployment=beta` query strings return mainnet-only entries.
 *
 *   Verdict: NOT VIABLE on devnet. (Save would require us to either run a localnet validator
 *   with a recompiled spl-token-lending or fall back to mainnet smoke testing.)
 *
 * ---------------------------------------------------------------------------
 *
 * Candidate B — MarginFi v2  (account-based model: lending_account_deposit / lending_account_withdraw)
 *
 *   Mainnet:
 *     program (production): MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA
 *     group   (production): 4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8
 *     program (staging):    stag8sTKds2h4KzjUw3zKTsxbqvT4XKHdaR9X9E6Rct
 *     group   (staging):    FCPfpHA69EbS8f9KKSreTRkXbzFpunsKuYf5qNmnJjpo
 *
 *   Devnet (label "dev" in mrgn-ts/packages/marginfi-client-v2/src/configs.json):
 *     program:        A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4   (executable on devnet ✓)
 *     group:          52NC7T3NTPFFwoxJDFk9mbKcA7675DJ39H1iPNz5RjSV   (owned by program ✓)
 *     usdc bank:      GhV6ZftLXv3o38CHMhX6nu8GkxS3kvrHSSCVpGFTysUC
 *     usdc mint:      F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd   (6 decimals, live SPL mint,
 *                                                                      supply 200,772 USDC,
 *                                                                      mint authority
 *                                                                      Fx1bCAyYpLMPVAjfq1pxbqKKkvDR3iYEpam1KbThRDYQ)
 *     usdc liq.vault: J9SAzLYETfcXBdrvswRaNUiGaMtmLiucwEJKEFW8d3FA   (derived: PDA["liquidity_vault", bank])
 *     usdc liq.auth:  Fx99GAAXXk43peMfHxS2S7xTubazffA5h7ftmTEJK2bk   (derived: PDA["liquidity_vault_auth", bank])
 *     other banks:    9cK3zLUhY1umtbyXQsBcBvEyzxbevMSDax1Sorfp9WVE  (mint 4Bn9Wn1s…, 9 dec)
 *                     2KvZHa7nPDBwLRz2yasXDnHsbyhrpzWkqEp6mEAnGeLJ  (wSOL)
 *
 *   Devnet (label "dev.1") — STALE: configured group `2eophx2kdM71vgKQnZXmA7GGCVZ1voRMxU2F4Gcournb`
 *     is NOT owned by program `neetcne…cBQ`; it is owned by `31nJ1cwn…aZu`. We do NOT use this
 *     deployment.
 *
 *   Required CPIs for jarfi’s deposit-then-redeem cycle:
 *     - marginfi_account_initialize (once per jar; or marginfi_account_initialize_pda)
 *     - lending_account_deposit
 *     - lending_account_withdraw
 *
 *   Anchor sighash discriminators (sha256("global:<name>")[0..8]):
 *     marginfi_account_initialize : 2b 4e 3d ff 94 34 f9 9a   [43,78,61,255,148,52,249,154]
 *     lending_account_deposit     : ab 5e eb 67 52 40 d4 8c   [171,94,235,103,82,64,212,140]
 *     lending_account_withdraw    : 24 48 4a 13 d2 d2 c0 c0   [36,72,74,19,210,210,192,192]
 *
 *   LendingAccountDeposit account list (in order, per programs/marginfi/src/instructions/marginfi_account/deposit.rs):
 *     0  group                MarginfiGroup       readonly
 *     1  marginfi_account     MarginfiAccount     writable
 *     2  authority            Signer              readonly, signer
 *     3  bank                 Bank                writable
 *     4  signer_token_account TokenAccount        writable  (user’s USDC ATA)
 *     5  liquidity_vault      TokenAccount        writable  (bank PDA, derived above)
 *     6  token_program        spl-token / token-2022
 *
 *   Verdict: VIABLE on devnet. Program is live, dev group is live, USDC bank is live,
 *   USDC mint has supply and a known mint authority that we can ask MarginFi to mint from
 *   (or, alternatively, the marginfi front-end faucet at https://app.marginfi.com — the
 *    `dev` deployment is the one their public devnet UI talks to).
 *
 * ---------------------------------------------------------------------------
 *
 * Sources:
 *   - https://github.com/mrgnlabs/mrgn-ts/blob/main/packages/marginfi-client-v2/src/configs.json
 *   - https://github.com/mrgnlabs/marginfi-v2/blob/main/Anchor.toml
 *   - https://github.com/mrgnlabs/marginfi-v2/blob/main/programs/marginfi/src/lib.rs
 *   - https://github.com/mrgnlabs/marginfi-v2/blob/main/programs/marginfi/src/state/bank.rs
 *   - https://api.solend.fi/v1/markets/configs   (production / beta — mainnet only, no devnet)
 *   - On-chain decode of Bank `GhV6Zft…ysUC` on devnet (offsets per type-crate/src/types/bank.rs)
 */

import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";

// --- Save (Solend) -----------------------------------------------------------
const SAVE_PROGRAM = new PublicKey("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo");

// --- MarginFi devnet "dev" deployment ---------------------------------------
const MFI_PROGRAM = new PublicKey("A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4");
const MFI_GROUP = new PublicKey("52NC7T3NTPFFwoxJDFk9mbKcA7675DJ39H1iPNz5RjSV");
const MFI_USDC_BANK = new PublicKey("GhV6ZftLXv3o38CHMhX6nu8GkxS3kvrHSSCVpGFTysUC");
const MFI_USDC_MINT = new PublicKey("F9jRT1xL7PCRepBuey5cQG5vWHFSbnvdWxJWKqtzMDsd");

async function inspectSave(conn: Connection) {
  console.log("\n=== Save / Solend on devnet ===");
  const acc = await conn.getAccountInfo(SAVE_PROGRAM);
  if (!acc) {
    console.log("program", SAVE_PROGRAM.toBase58(), "→ NOT DEPLOYED on devnet");
    return;
  }
  console.log("program present, executable=", acc.executable);
}

async function inspectMarginFi(conn: Connection) {
  console.log("\n=== MarginFi 'dev' on devnet ===");
  const program = await conn.getAccountInfo(MFI_PROGRAM);
  console.log("program executable:", !!program?.executable);

  const group = await conn.getAccountInfo(MFI_GROUP);
  console.log(
    "group present:",
    !!group,
    "owner=",
    group?.owner.toBase58(),
    "(expect", MFI_PROGRAM.toBase58(), ")",
  );

  const bank = await conn.getAccountInfo(MFI_USDC_BANK);
  if (!bank) {
    console.log("USDC bank not present!");
    return;
  }
  // Bank layout (after 8-byte Anchor disc):
  //   mint(32) | mint_decimals(1) | group(32) | pad0(7) |
  //   asset_share_value(16) | liability_share_value(16) | liquidity_vault(32) | …
  const mint = new PublicKey(bank.data.slice(8, 40));
  const decimals = bank.data[40];
  const grp = new PublicKey(bank.data.slice(41, 73));
  const liqVault = new PublicKey(bank.data.slice(112, 144));
  console.log("bank.mint            :", mint.toBase58());
  console.log("bank.mint_decimals   :", decimals);
  console.log("bank.group           :", grp.toBase58(), "(matches?", grp.equals(MFI_GROUP), ")");
  console.log("bank.liquidity_vault :", liqVault.toBase58());

  const [derivedLiqV] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_vault"), MFI_USDC_BANK.toBuffer()],
    MFI_PROGRAM,
  );
  const [derivedLiqAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_vault_auth"), MFI_USDC_BANK.toBuffer()],
    MFI_PROGRAM,
  );
  console.log("PDA(liquidity_vault) :", derivedLiqV.toBase58(), "(matches?", derivedLiqV.equals(liqVault), ")");
  console.log("PDA(liquidity_auth)  :", derivedLiqAuth.toBase58());

  const mintAcc = await conn.getAccountInfo(MFI_USDC_MINT);
  if (mintAcc) {
    const supply = mintAcc.data.readBigUInt64LE(36);
    const optAuth = mintAcc.data.readUInt32LE(0);
    const auth =
      optAuth === 1 ? new PublicKey(mintAcc.data.slice(4, 36)).toBase58() : "<frozen/none>";
    console.log("USDC mint supply     :", supply.toString(), "raw (=", Number(supply) / 1e6, "USDC)");
    console.log("USDC mint authority  :", auth);
  }
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  console.log("RPC:", RPC);
  await inspectSave(conn);
  await inspectMarginFi(conn);
  console.log("\nNo transactions sent. Inspection only.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
