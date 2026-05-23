// One-shot migration: grow Config from v1 (88 bytes) to v2 (120 bytes) to make
// room for the new `allowed_usdc_mint` field. After every deployed Config has
// been migrated, the admin calls `update_config` with `new_allowed_usdc_mint`
// to set the canonical mint. This instruction can be removed in a future
// release once all environments are migrated.
//
// Admin is verified manually against the raw bytes because `Account<Config>`
// deserialization would fail on the old 88-byte layout.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::JarError;
use crate::state::Config;

const V1_SIZE: usize = 88;
const V2_SIZE: usize = 120;
/// Post-MarginFi, pre-`min_auto_stake_lock_days` size. Required so accounts
/// migrated under the Task-3 binary (before Task 4) can be migrated again to
/// pick up the new 2-byte tail field.
const PRE_TASK4_SIZE: usize = 217;
const ADMIN_OFFSET: usize = 8 + 1; // discriminator + version
const PUBKEY_LEN: usize = 32;

#[derive(Accounts)]
pub struct MigrateConfigV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: validated manually against raw data below.
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateConfigV2>) -> Result<()> {
    let config_ai = &ctx.accounts.config;
    let admin_ai = &ctx.accounts.admin;

    {
        let data = config_ai.try_borrow_data()?;
        require!(
            data.len() == V1_SIZE
                || data.len() == V2_SIZE
                || data.len() == PRE_TASK4_SIZE
                || data.len() == Config::SIZE,
            JarError::MigrationNotNeeded
        );
        let stored_admin = Pubkey::try_from(&data[ADMIN_OFFSET..ADMIN_OFFSET + PUBKEY_LEN])
            .map_err(|_| error!(JarError::MigrationNotNeeded))?;
        require!(stored_admin == admin_ai.key(), JarError::NotAdmin);
    }

    let rent = Rent::get()?;
    let new_min_lamports = rent.minimum_balance(Config::SIZE);
    let current_lamports = config_ai.lamports();
    if new_min_lamports > current_lamports {
        let delta = new_min_lamports - current_lamports;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: admin_ai.to_account_info(),
                    to: config_ai.to_account_info(),
                },
            ),
            delta,
        )?;
    }

    // Capture pre-resize length so we only zero-fill *newly added* bytes.
    let pre_resize_len = config_ai.data_len();

    // Determine real end of V2 data (variable-width Option<Pubkey>) — only
    // relevant when migrating directly from a raw V2 layout (88 or 120 bytes).
    // Layout up to allowed_usdc_mint:
    //   disc(8) + version(1) + admin(32) + pending_admin_tag(1)
    //   [+ pending_admin_pubkey(32)] + treasury_bump(1) + creation_fee(8)
    //   + withdraw_fee_bps(2) + fee_enabled(1) + paused(1) + bump(1)
    //   + allowed_usdc_mint(32)
    // Without Some pubkey: end = 88. With: end = 120.
    let v2_actual_end: usize = {
        let data = config_ai.try_borrow_data()?;
        let pending_tag = data[8 + 1 + 32];
        let extra = if pending_tag == 1 { 32 } else { 0 };
        8 + 1 + 32 + 1 + extra + 1 + 8 + 2 + 1 + 1 + 1 + 32
    };

    config_ai.resize(Config::SIZE)?;

    // Zero-fill from whichever is later:
    //   - v2_actual_end (when migrating from raw V2, where the bytes between
    //     v2_actual_end and the old size are pre-marginfi noise we want gone),
    //   - pre_resize_len (when re-migrating after a previous resize, where
    //     the bytes up to pre_resize_len already hold meaningful state like
    //     marginfi_program/group/usdc_bank that we must NOT clobber).
    let zero_start = core::cmp::max(v2_actual_end, pre_resize_len);
    if zero_start < Config::SIZE {
        let mut data = config_ai.try_borrow_mut_data()?;
        for byte in data.iter_mut().skip(zero_start) {
            *byte = 0;
        }
    }

    Ok(())
}
