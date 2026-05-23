//! Marinade liquid staking CPI helper module.
//!
//! Hand-rolled CPI bindings for the two Marinade instructions jarfi needs:
//!   - `deposit`         (contribute_sol auto-staked path)
//!   - `liquid_unstake`  (withdraw, refund, cancel_jar pre-unstake, close_jar dust)
//!
//! No external Marinade SDK dependency — discriminators and account orderings
//! are pinned to the on-chain program at `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD`
//! (identical mainnet and devnet deployment).
//!
//! All pubkeys and discriminators below were verified live against devnet on
//! 2026-05-11 via `scripts/verify-marinade-constants.ts`. The State byte
//! layout (`msol_mint` @ 8..40, `treasury_msol_account` @ 104..136) was
//! cross-checked against Marinade's open-source state struct.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};

// -----------------------------------------------------------------------------
// Program and account pubkeys (mainnet and devnet share the same addresses)
// -----------------------------------------------------------------------------

pub const MARINADE_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");

pub const MARINADE_STATE: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC");

pub const MSOL_MINT: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");

/// PDA [state, "st_mint"]
pub const MSOL_MINT_AUTHORITY: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM");

/// PDA [state, "reserve"]
pub const RESERVE_PDA: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN");

/// PDA [state, "liq_sol"]
pub const LIQ_POOL_SOL_LEG_PDA: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q");

/// SPL token account (mSOL leg of the liquidity pool).
pub const LIQ_POOL_MSOL_LEG: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE");

/// PDA [state, "liq_st_sol_authority"]
pub const LIQ_POOL_MSOL_LEG_AUTH: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("EyaSjUtSgo9aRD1f8LWXwdvkpDTmXAW54yoSHZRF14WL");

/// SPL token account; decoded from State data on devnet.
pub const TREASURY_MSOL_ACCOUNT: Pubkey =
    anchor_lang::solana_program::pubkey::pubkey!("8ZUcztoAEhpAeC2ixWewJKQJsSUGYSGPVAjkhDJYf5Gd");

// -----------------------------------------------------------------------------
// Instruction discriminators — sha256("global:<ix>")[0..8]
// Verified by scripts/verify-marinade-constants.ts on 2026-05-11.
// -----------------------------------------------------------------------------

pub const DEPOSIT_IX:        [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
pub const LIQUID_UNSTAKE_IX: [u8; 8] = [30,  30, 119, 240, 191, 227, 12, 16];

// -----------------------------------------------------------------------------
// deposit (deposit SOL → mint mSOL)
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct DepositSolAccounts<'info> {
    pub marinade_program: AccountInfo<'info>,
    pub state: AccountInfo<'info>,
    pub msol_mint: AccountInfo<'info>,
    pub liq_pool_sol_leg_pda: AccountInfo<'info>,
    pub liq_pool_msol_leg: AccountInfo<'info>,
    pub liq_pool_msol_leg_authority: AccountInfo<'info>,
    pub reserve_pda: AccountInfo<'info>,
    /// Jar PDA — signs SOL out via invoke_signed.
    pub transfer_from: AccountInfo<'info>,
    /// Jar's mSOL ATA — receives mSOL.
    pub mint_to: AccountInfo<'info>,
    pub msol_mint_authority: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

/// CPI: Marinade `deposit(lamports)`. SOL flows from `transfer_from` (jar PDA);
/// mSOL is minted to `mint_to` (jar's mSOL ATA).
pub fn deposit_sol<'info>(
    accounts: &DepositSolAccounts<'info>,
    lamports: u64,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&DEPOSIT_IX);
    data.extend_from_slice(&lamports.to_le_bytes());

    let metas = vec![
        AccountMeta::new(*accounts.state.key, false),
        AccountMeta::new(*accounts.msol_mint.key, false),
        AccountMeta::new(*accounts.liq_pool_sol_leg_pda.key, false),
        AccountMeta::new(*accounts.liq_pool_msol_leg.key, false),
        AccountMeta::new_readonly(*accounts.liq_pool_msol_leg_authority.key, false),
        AccountMeta::new(*accounts.reserve_pda.key, false),
        AccountMeta::new(*accounts.transfer_from.key, true),
        AccountMeta::new(*accounts.mint_to.key, false),
        AccountMeta::new_readonly(*accounts.msol_mint_authority.key, false),
        AccountMeta::new_readonly(*accounts.system_program.key, false),
        AccountMeta::new_readonly(*accounts.token_program.key, false),
    ];

    let ix = Instruction {
        program_id: *accounts.marinade_program.key,
        accounts: metas,
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.state.clone(),
            accounts.msol_mint.clone(),
            accounts.liq_pool_sol_leg_pda.clone(),
            accounts.liq_pool_msol_leg.clone(),
            accounts.liq_pool_msol_leg_authority.clone(),
            accounts.reserve_pda.clone(),
            accounts.transfer_from.clone(),
            accounts.mint_to.clone(),
            accounts.msol_mint_authority.clone(),
            accounts.system_program.clone(),
            accounts.token_program.clone(),
            accounts.marinade_program.clone(),
        ],
        seeds,
    )?;
    Ok(())
}

// -----------------------------------------------------------------------------
// read_token_amount — helper for computing pre/post deposit deltas
// -----------------------------------------------------------------------------

/// Reads `amount: u64` (little-endian) from a SPL token account at offset 64
/// (after `mint: Pubkey @ 0..32` and `owner: Pubkey @ 32..64`). Returns 0 if
/// the account data is too short (e.g. uninitialized).
pub fn read_token_amount(token_account: &AccountInfo) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    if data.len() < 72 {
        return Ok(0);
    }
    let bytes: [u8; 8] = data[64..72].try_into()
        .map_err(|_| error!(crate::errors::JarError::MarinadeAccountMismatch))?;
    Ok(u64::from_le_bytes(bytes))
}

// -----------------------------------------------------------------------------
// liquid_unstake (burn mSOL → return SOL)
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct LiquidUnstakeAccounts<'info> {
    pub marinade_program: AccountInfo<'info>,
    pub state: AccountInfo<'info>,
    pub msol_mint: AccountInfo<'info>,
    pub liq_pool_sol_leg_pda: AccountInfo<'info>,
    pub liq_pool_msol_leg: AccountInfo<'info>,
    pub treasury_msol_account: AccountInfo<'info>,
    /// Jar's mSOL ATA (mSOL burned from here).
    pub get_msol_from: AccountInfo<'info>,
    /// Jar PDA — authority over the mSOL ATA, signed via invoke_signed.
    pub get_msol_from_authority: AccountInfo<'info>,
    /// Jar PDA — SOL destination.
    pub transfer_sol_to: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

/// CPI: Marinade `liquid_unstake(msol_amount)`. Burns mSOL from `get_msol_from`,
/// delivers SOL (after liq-pool fee) to `transfer_sol_to`.
pub fn liquid_unstake<'info>(
    accounts: &LiquidUnstakeAccounts<'info>,
    msol_amount: u64,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&LIQUID_UNSTAKE_IX);
    data.extend_from_slice(&msol_amount.to_le_bytes());

    let metas = vec![
        AccountMeta::new(*accounts.state.key, false),
        AccountMeta::new(*accounts.msol_mint.key, false),
        AccountMeta::new(*accounts.liq_pool_sol_leg_pda.key, false),
        AccountMeta::new(*accounts.liq_pool_msol_leg.key, false),
        AccountMeta::new(*accounts.treasury_msol_account.key, false),
        AccountMeta::new(*accounts.get_msol_from.key, false),
        AccountMeta::new_readonly(*accounts.get_msol_from_authority.key, true),
        AccountMeta::new(*accounts.transfer_sol_to.key, false),
        AccountMeta::new_readonly(*accounts.system_program.key, false),
        AccountMeta::new_readonly(*accounts.token_program.key, false),
    ];

    let ix = Instruction {
        program_id: *accounts.marinade_program.key,
        accounts: metas,
        data,
    };

    invoke_signed(
        &ix,
        &[
            accounts.state.clone(),
            accounts.msol_mint.clone(),
            accounts.liq_pool_sol_leg_pda.clone(),
            accounts.liq_pool_msol_leg.clone(),
            accounts.treasury_msol_account.clone(),
            accounts.get_msol_from.clone(),
            accounts.get_msol_from_authority.clone(),
            accounts.transfer_sol_to.clone(),
            accounts.system_program.clone(),
            accounts.token_program.clone(),
            accounts.marinade_program.clone(),
        ],
        seeds,
    )?;
    Ok(())
}
