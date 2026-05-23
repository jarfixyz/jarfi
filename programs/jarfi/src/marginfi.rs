//! MarginFi v2 CPI helper module.
//!
//! Hand-rolled CPI bindings for the three MarginFi v2 instructions jarfi needs:
//!   - `marginfi_account_initialize`  (one-time, per auto-staked jar)
//!   - `lending_account_deposit`      (contribute_spl)
//!   - `lending_account_withdraw`     (withdraw, refund)
//!
//! Plus a hand-rolled reader (`read_asset_shares_u64`) over the `MarginfiAccount`
//! account data so we can compute deposit-time `asset_shares` deltas without
//! taking a build dependency on the marginfi-v2 crate.
//!
//! ----------------------------------------------------------------------------
//! Source provenance
//! ----------------------------------------------------------------------------
//! All offsets, account orderings and discriminators are derived from
//! `mrgnlabs/marginfi-v2` at tag **`mrgn-0.1.2`** (commit
//! `b16719aae59545aabacd98ca7b8f2ef47e505a94`). Tip-of-`main` differs in
//! several breaking ways (renamed `initialize_account`, new `MarginfiGroup`
//! constraints, expanded `Balance` struct, restructured `Bank`), but the
//! devnet program at `A7vUDErNPCTt9qrB6SSM4F6GkxzUe9d8P3cXSmRg4eY4` and
//! mainnet `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA` were both compiled
//! from the `mrgn-0.1.x` line, so we target that layout.
//!
//! Files cross-referenced:
//!   - programs/marginfi/src/instructions/marginfi_account/initialize.rs
//!   - programs/marginfi/src/instructions/marginfi_account/deposit.rs
//!   - programs/marginfi/src/instructions/marginfi_account/withdraw.rs
//!   - programs/marginfi/src/state/marginfi_account.rs (MarginfiAccount, LendingAccount, Balance)
//!   - programs/marginfi/src/state/marginfi_group.rs   (Bank)
//!   - programs/marginfi/src/constants.rs              (LIQUIDITY_VAULT_AUTHORITY_SEED = "liquidity_vault_auth")
//!
//! ----------------------------------------------------------------------------
//! Discriminators (sha256("global:<ix_name>")[0..8])
//! ----------------------------------------------------------------------------
//!   marginfi_account_initialize  = [43, 78, 61, 255, 148, 52, 249, 154]
//!     (computed in scripts/save-marginfi-spike.ts and double-checked
//!      against the deployed program's IDL hash)
//!   lending_account_deposit      = [171, 94, 235, 103, 82, 64, 212, 140]
//!   lending_account_withdraw     = [36, 72, 74, 19, 210, 210, 192, 192]
//!
//! ----------------------------------------------------------------------------
//! `marginfi_account` is NOT a PDA-with-seeds inside the MarginfiAccountInitialize
//! Accounts struct — it is `AccountLoader<'info, MarginfiAccount>` with the
//! `init` constraint and no `seeds = ...` clause:
//!
//!     pub marginfi_account: AccountLoader<'info, MarginfiAccount>,  // init, payer = fee_payer
//!
//! The `init` constraint requires the account to be marked as a signer in the
//! transaction (so that system_program::create_account succeeds inside the
//! marginfi program). HOWEVER, MarginFi does not enforce *how* that signature
//! was produced — Solana itself accepts a PDA signature provided by an outer
//! `invoke_signed`. So jarfi can derive the marginfi_account address as a PDA
//! owned by jarfi (seeds: ["marginfi", jar_pubkey]), pass it as a signer in the
//! AccountMeta list, and provide the seeds to `invoke_signed` from the
//! `account_initialize` helper. This is what the helper API below expects.
//!
//! If a future MarginFi version adds a `seeds = ...` constraint that pins
//! marginfi_account to *its own* PDA derivation, this approach will break and
//! we will need to switch to passing a fresh client-side `Keypair`. As of
//! `mrgn-0.1.2` no such constraint exists.
//!
//! ----------------------------------------------------------------------------
//! Account orderings (verbatim from `mrgn-0.1.2`)
//! ----------------------------------------------------------------------------
//! MarginfiAccountInitialize: marginfi_group, marginfi_account, authority,
//!                            fee_payer, system_program
//! LendingAccountDeposit:     group, marginfi_account, authority, bank,
//!                            signer_token_account, liquidity_vault, token_program
//! LendingAccountWithdraw:    group, marginfi_account, authority, bank,
//!                            destination_token_account,
//!                            bank_liquidity_vault_authority (mut),
//!                            liquidity_vault, token_program
//!
//! Note for withdraw: `bank_liquidity_vault_authority` is `mut` in `mrgn-0.1.2`
//! (see `#[account(mut, seeds = [...], bump = ...)]`), so the AccountMeta is
//! `new()`, not `new_readonly()`.
//!
//! ----------------------------------------------------------------------------
//! Layout constants (in `MarginfiAccount` account data, including 8-byte disc)
//! ----------------------------------------------------------------------------
//!   header (disc + group + authority)            =   8 + 32 + 32 =   72 bytes
//!   `LendingAccount.balances` start              = 72
//!   `Balance` entry size                         =  104 bytes (16 entries)
//!     within an entry:
//!       +0   active           : u8
//!       +1   bank_pk          : Pubkey (32)
//!       +33  bank_asset_tag   : u8
//!       +34..+40              : _pad0 [u8; 6]
//!       +40  asset_shares     : WrappedI80F48 (16 — i128 LE, scale 2^48)
//!       +56  liability_shares : WrappedI80F48 (16)
//!       +72  emissions_outstanding : WrappedI80F48 (16)
//!       +88  last_update      : u64
//!       +96  _padding         : [u64; 1]
//!
//! `Bank` (account data; including 8-byte disc):
//!     +8   mint                  : Pubkey
//!     +40  mint_decimals         : u8
//!     +41  group                 : Pubkey (32)
//!     +73  _pad0                 : [u8; 7]
//!     +80  asset_share_value     : WrappedI80F48 (16) <-- ASSET_SHARE_VALUE_OFFSET
//!     +96  liability_share_value : WrappedI80F48 (16)
//!     +112 liquidity_vault       : Pubkey
//!     ...
//!
//! `WrappedI80F48` is a 16-byte little-endian `i128` representing a fixed-point
//! number with scale `2^48` — i.e. raw / 2^48 = real value.
//!
//! ----------------------------------------------------------------------------

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};

// -----------------------------------------------------------------------------
// Discriminators
// -----------------------------------------------------------------------------

pub const MARGINFI_ACCOUNT_INITIALIZE_IX: [u8; 8] = [43, 78, 61, 255, 148, 52, 249, 154];
pub const LENDING_ACCOUNT_DEPOSIT_IX: [u8; 8] = [171, 94, 235, 103, 82, 64, 212, 140];
pub const LENDING_ACCOUNT_WITHDRAW_IX: [u8; 8] = [36, 72, 74, 19, 210, 210, 192, 192];

// -----------------------------------------------------------------------------
// MarginfiAccount layout constants (see file header)
// -----------------------------------------------------------------------------

/// Bytes from start of MarginfiAccount account data to the first `Balance` entry.
pub const MARGINFI_ACCOUNT_HEADER: usize = 8 /*disc*/ + 32 /*group*/ + 32 /*authority*/;
/// Size in bytes of one `Balance` struct (`#[repr(C)]`, 8-byte aligned).
pub const BALANCE_ENTRY_SIZE: usize = 104;
/// Number of balance slots in `LendingAccount.balances` (MAX_LENDING_ACCOUNT_BALANCES).
pub const BALANCE_ENTRIES: usize = 16;

/// Within a `Balance` entry: byte offset of `bank_pk`.
pub const BALANCE_BANK_PK_OFFSET: usize = 1;
/// Within a `Balance` entry: byte offset of `asset_shares` (WrappedI80F48 / i128 LE).
pub const BALANCE_ASSET_SHARES_OFFSET: usize = 40;

// -----------------------------------------------------------------------------
// Bank layout constants
// -----------------------------------------------------------------------------

/// Byte offset (in Bank account data, including the 8-byte Anchor discriminator)
/// of `Bank.asset_share_value`. WrappedI80F48 = 16 LE bytes, scale 2^48.
///
/// Derivation:  8 (disc) + 32 (mint) + 1 (mint_decimals) + 32 (group) + 7 (_pad0)
///            = 80
pub const ASSET_SHARE_VALUE_OFFSET: usize = 80;

// -----------------------------------------------------------------------------
// marginfi_account_initialize
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct InitializeAccounts<'info> {
    pub marginfi_program: AccountInfo<'info>,
    pub marginfi_group: AccountInfo<'info>,
    /// PDA owned by jarfi, signed via `invoke_signed`. Anchor's `init`
    /// constraint on this account in MarginFi requires a signature; the
    /// PDA seeds in `seeds` argument satisfy that.
    pub marginfi_account: AccountInfo<'info>,
    /// Jar PDA, signed via `invoke_signed` seeds.
    pub authority: AccountInfo<'info>,
    /// Tx fee payer (creator wallet).
    pub fee_payer: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
}

/// CPI: `marginfi::marginfi_account_initialize()`.
///
/// `seeds` must contain BOTH:
///   - jar PDA seeds   (signs `authority`)
///   - marginfi_account PDA seeds (signs the new account creation)
pub fn account_initialize<'info>(
    accounts: &InitializeAccounts<'info>,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = Instruction {
        program_id: *accounts.marginfi_program.key,
        accounts: vec![
            AccountMeta::new_readonly(*accounts.marginfi_group.key, false),
            AccountMeta::new(*accounts.marginfi_account.key, true),
            AccountMeta::new_readonly(*accounts.authority.key, true),
            AccountMeta::new(*accounts.fee_payer.key, true),
            AccountMeta::new_readonly(*accounts.system_program.key, false),
        ],
        data: MARGINFI_ACCOUNT_INITIALIZE_IX.to_vec(),
    };
    invoke_signed(
        &ix,
        &[
            accounts.marginfi_group.clone(),
            accounts.marginfi_account.clone(),
            accounts.authority.clone(),
            accounts.fee_payer.clone(),
            accounts.system_program.clone(),
            accounts.marginfi_program.clone(),
        ],
        seeds,
    )?;
    Ok(())
}

// -----------------------------------------------------------------------------
// lending_account_deposit
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct DepositAccounts<'info> {
    pub marginfi_program: AccountInfo<'info>,
    pub marginfi_group: AccountInfo<'info>,
    pub marginfi_account: AccountInfo<'info>,
    /// Jar PDA, signed via `invoke_signed` seeds.
    pub authority: AccountInfo<'info>,
    pub bank: AccountInfo<'info>,
    /// Source — jar's USDC ATA.
    pub signer_token_account: AccountInfo<'info>,
    /// Bank's liquidity vault — PDA["liquidity_vault", bank].
    pub bank_liquidity_vault: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

/// CPI: `marginfi::lending_account_deposit(amount, deposit_up_to_limit: Option<bool>)`.
///
/// We always pass `deposit_up_to_limit = None` (tag byte = 0). Jar contributions
/// already check token balance up-front, so deposit-up-to-limit semantics are
/// not needed. `Option<bool>` bytewise: 1 byte tag (0 = None, 1 = Some), then
/// 1 byte value when Some.
pub fn deposit<'info>(
    accounts: &DepositAccounts<'info>,
    amount: u64,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 8 + 1);
    data.extend_from_slice(&LENDING_ACCOUNT_DEPOSIT_IX);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(0); // Option<bool>::None
    let ix = Instruction {
        program_id: *accounts.marginfi_program.key,
        accounts: vec![
            AccountMeta::new_readonly(*accounts.marginfi_group.key, false),
            AccountMeta::new(*accounts.marginfi_account.key, false),
            AccountMeta::new_readonly(*accounts.authority.key, true),
            AccountMeta::new(*accounts.bank.key, false),
            AccountMeta::new(*accounts.signer_token_account.key, false),
            AccountMeta::new(*accounts.bank_liquidity_vault.key, false),
            AccountMeta::new_readonly(*accounts.token_program.key, false),
        ],
        data,
    };
    invoke_signed(
        &ix,
        &[
            accounts.marginfi_group.clone(),
            accounts.marginfi_account.clone(),
            accounts.authority.clone(),
            accounts.bank.clone(),
            accounts.signer_token_account.clone(),
            accounts.bank_liquidity_vault.clone(),
            accounts.token_program.clone(),
            accounts.marginfi_program.clone(),
        ],
        seeds,
    )?;
    Ok(())
}

// -----------------------------------------------------------------------------
// lending_account_withdraw
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct WithdrawAccounts<'info> {
    pub marginfi_program: AccountInfo<'info>,
    pub marginfi_group: AccountInfo<'info>,
    pub marginfi_account: AccountInfo<'info>,
    /// Jar PDA.
    pub authority: AccountInfo<'info>,
    pub bank: AccountInfo<'info>,
    /// Destination — jar's USDC ATA.
    pub destination_token_account: AccountInfo<'info>,
    /// PDA["liquidity_vault_auth", bank]. Note seed is "liquidity_vault_auth"
    /// (NOT "liquidity_vault_authority" — that's the *constant name*, not the
    /// seed bytes). `mut` per `mrgn-0.1.2`.
    pub bank_liquidity_vault_authority: AccountInfo<'info>,
    /// PDA["liquidity_vault", bank].
    pub bank_liquidity_vault: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

/// CPI: `marginfi::lending_account_withdraw(amount, withdraw_all: Option<bool>)`.
///
/// `Option<bool>` bytewise: 1 byte tag (0=None, 1=Some) + 1 byte value when Some.
/// We always pass Some(withdraw_all) for explicitness.
///
/// `extra_accounts` are appended to the CPI's account list as readonly,
/// non-signer entries — MarginFi's withdraw handler iterates remaining_accounts
/// to find the oracle (and any other risk-engine accounts), so callers MUST
/// pass at least the bank's oracle pubkey here.
pub fn withdraw<'info>(
    accounts: &WithdrawAccounts<'info>,
    amount: u64,
    withdraw_all: bool,
    seeds: &[&[&[u8]]],
    extra_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    let mut data = Vec::with_capacity(8 + 8 + 2);
    data.extend_from_slice(&LENDING_ACCOUNT_WITHDRAW_IX);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(1); // Option<bool>::Some
    data.push(if withdraw_all { 1 } else { 0 });

    let mut metas = vec![
        AccountMeta::new_readonly(*accounts.marginfi_group.key, false),
        AccountMeta::new(*accounts.marginfi_account.key, false),
        AccountMeta::new_readonly(*accounts.authority.key, true),
        AccountMeta::new(*accounts.bank.key, false),
        AccountMeta::new(*accounts.destination_token_account.key, false),
        AccountMeta::new(*accounts.bank_liquidity_vault_authority.key, false),
        AccountMeta::new(*accounts.bank_liquidity_vault.key, false),
        AccountMeta::new_readonly(*accounts.token_program.key, false),
    ];
    for ai in extra_accounts {
        metas.push(AccountMeta::new_readonly(*ai.key, false));
    }
    let ix = Instruction {
        program_id: *accounts.marginfi_program.key,
        accounts: metas,
        data,
    };
    let mut infos: Vec<AccountInfo<'info>> = vec![
        accounts.marginfi_group.clone(),
        accounts.marginfi_account.clone(),
        accounts.authority.clone(),
        accounts.bank.clone(),
        accounts.destination_token_account.clone(),
        accounts.bank_liquidity_vault_authority.clone(),
        accounts.bank_liquidity_vault.clone(),
        accounts.token_program.clone(),
        accounts.marginfi_program.clone(),
    ];
    for ai in extra_accounts {
        infos.push(ai.clone());
    }
    invoke_signed(&ix, &infos, seeds)?;
    Ok(())
}

// -----------------------------------------------------------------------------
// read_asset_shares_u64
// -----------------------------------------------------------------------------

/// Read the I80F48 `asset_shares` value from a `MarginfiAccount`'s position in
/// `usdc_bank` and return it as a u64 of integer shares (truncated toward zero,
/// clamped to `[0, u64::MAX]`).
///
/// Used to compute deposit-time deltas: caller reads pre-deposit value, CPIs
/// the deposit, then reads post-deposit value; the difference is the
/// `shares_delta` to record on the `Contribution`.
///
/// Returns 0 if the marginfi_account has no active balance for `usdc_bank`.
///
/// Layout constants are file-level (`MARGINFI_ACCOUNT_HEADER`, `BALANCE_ENTRY_SIZE`,
/// `BALANCE_ENTRIES`, `BALANCE_BANK_PK_OFFSET`, `BALANCE_ASSET_SHARES_OFFSET`).
pub fn read_asset_shares_u64(marginfi_account: &AccountInfo, usdc_bank: &Pubkey) -> Result<u64> {
    use std::convert::TryInto;
    let data = marginfi_account.try_borrow_data()?;
    let needed = MARGINFI_ACCOUNT_HEADER + BALANCE_ENTRIES * BALANCE_ENTRY_SIZE;
    if data.len() < needed {
        // Account too short — treat as no balance.
        return Ok(0);
    }
    for i in 0..BALANCE_ENTRIES {
        let off = MARGINFI_ACCOUNT_HEADER + i * BALANCE_ENTRY_SIZE;
        // active flag
        if data[off] != 1 {
            continue;
        }
        // bank_pk
        let bank_bytes: [u8; 32] = data[off + BALANCE_BANK_PK_OFFSET
            ..off + BALANCE_BANK_PK_OFFSET + 32]
            .try_into()
            .map_err(|_| error!(crate::errors::JarError::MarginFiAccountMismatch))?;
        if Pubkey::new_from_array(bank_bytes) != *usdc_bank {
            continue;
        }
        // asset_shares (WrappedI80F48 = i128 LE, scale 2^48)
        let raw_bytes: [u8; 16] = data[off + BALANCE_ASSET_SHARES_OFFSET
            ..off + BALANCE_ASSET_SHARES_OFFSET + 16]
            .try_into()
            .map_err(|_| error!(crate::errors::JarError::MarginFiAccountMismatch))?;
        let raw = i128::from_le_bytes(raw_bytes);
        // Drop 48 fractional bits (arithmetic shift right preserves sign on i128).
        let scaled: i128 = raw >> 48;
        let clamped: u64 = if scaled <= 0 {
            0
        } else if scaled > u64::MAX as i128 {
            u64::MAX
        } else {
            scaled as u64
        };
        return Ok(clamped);
    }
    Ok(0)
}
